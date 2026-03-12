import { useRef, useEffect, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { useTerminalStore } from '../../store/terminal-store'
import { useVaultStore } from '../../store/vault-store'
import { TerminalTabs } from './TerminalTabs'
import { colors } from '../../design/tokens'
import 'xterm/css/xterm.css'

const ipcRenderer = window.electron.ipcRenderer

interface TerminalInstance {
  terminal: Terminal
  fitAddon: FitAddon
  sessionId: string
}

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const instancesRef = useRef<Map<string, TerminalInstance>>(new Map())
  const activeContainerRef = useRef<HTMLDivElement>(null)

  const { sessions, activeSessionId, addSession, removeSession } = useTerminalStore()
  const { vaultPath } = useVaultStore()

  const createTerminalInstance = useCallback(async () => {
    const cwd = vaultPath || process.cwd?.() || '/'
    const sessionId: string = await ipcRenderer.invoke('terminal:create', { cwd })
    const title = `Shell ${sessions.length + 1}`

    addSession({ id: sessionId, title })

    const term = new Terminal({
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 13,
      theme: {
        background: colors.bg.base,
        foreground: colors.text.primary,
        cursor: colors.accent.default,
        selectionBackground: colors.accent.muted,
      },
      scrollback: 10000,
      cursorBlink: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const searchAddon = new SearchAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.loadAddon(searchAddon)

    term.onData((data) => {
      ipcRenderer.invoke('terminal:write', { sessionId, data })
    })

    instancesRef.current.set(sessionId, { terminal: term, fitAddon, sessionId })

    return sessionId
  }, [vaultPath, sessions.length, addSession])

  const handleNewTab = useCallback(() => {
    createTerminalInstance()
  }, [createTerminalInstance])

  // Mount/unmount terminal DOM when active session changes
  useEffect(() => {
    const container = activeContainerRef.current
    if (!container || !activeSessionId) return

    const instance = instancesRef.current.get(activeSessionId)
    if (!instance) return

    // Clear previous content
    container.innerHTML = ''
    instance.terminal.open(container)
    instance.fitAddon.fit()
  }, [activeSessionId])

  // Listen for data and exit events from main process
  useEffect(() => {
    const unsubData = ipcRenderer.on('terminal:data', (_event, payload: { sessionId: string; data: string }) => {
      const instance = instancesRef.current.get(payload.sessionId)
      if (instance) {
        instance.terminal.write(payload.data)
      }
    })

    const unsubExit = ipcRenderer.on('terminal:exit', (_event, payload: { sessionId: string; code: number }) => {
      const instance = instancesRef.current.get(payload.sessionId)
      if (instance) {
        instance.terminal.writeln(`\r\n[Process exited with code ${payload.code}]`)
        instancesRef.current.delete(payload.sessionId)
      }
      removeSession(payload.sessionId)
    })

    return () => {
      unsubData()
      unsubExit()
    }
  }, [removeSession])

  // Auto-fit on resize
  useEffect(() => {
    const container = activeContainerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      if (!activeSessionId) return
      const instance = instancesRef.current.get(activeSessionId)
      if (!instance) return

      instance.fitAddon.fit()
      const { cols, rows } = instance.terminal
      ipcRenderer.invoke('terminal:resize', { sessionId: activeSessionId, cols, rows })
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [activeSessionId])

  // Create initial terminal session on mount
  useEffect(() => {
    if (sessions.length === 0) {
      createTerminalInstance()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup all terminals on unmount
  useEffect(() => {
    return () => {
      for (const [sessionId, instance] of instancesRef.current) {
        instance.terminal.dispose()
        ipcRenderer.invoke('terminal:kill', { sessionId })
      }
      instancesRef.current.clear()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col"
      style={{ backgroundColor: colors.bg.base }}
    >
      <TerminalTabs onNewTab={handleNewTab} />
      <div
        ref={activeContainerRef}
        className="flex-1 overflow-hidden"
        style={{ padding: '4px 0 0 4px' }}
      />
    </div>
  )
}
