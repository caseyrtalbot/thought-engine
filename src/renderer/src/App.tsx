import { useState, useCallback, useMemo, useEffect } from 'react'
import { useVaultWorker } from './engine/useVaultWorker'
import { ThemeProvider } from './design/Theme'
import { SplitPane } from './design/components/SplitPane'
import { Sidebar } from './panels/sidebar/Sidebar'
import { EditorPanel } from './panels/editor/EditorPanel'
import { GraphPanel } from './panels/graph/GraphPanel'
import { GraphControls } from './panels/graph/GraphControls'
import { TerminalPanel } from './panels/terminal/TerminalPanel'
import { WelcomeScreen } from './panels/onboarding/WelcomeScreen'
import { CommandPalette, type CommandItem } from './design/components/CommandPalette'
import { useKeyboard } from './hooks/useKeyboard'
import { useVaultStore } from './store/vault-store'
import { useEditorStore } from './store/editor-store'
import { useGraphStore } from './store/graph-store'
import { colors } from './design/tokens'
import { Titlebar } from './components/Titlebar'
import { SettingsModal } from './components/SettingsModal'
import { PanelErrorBoundary } from './components/PanelErrorBoundary'

function StatusBar() {
  const vaultPath = useVaultStore((s) => s.vaultPath)
  const fileCount = useVaultStore((s) => s.files.length)
  const [gitBranch, setGitBranch] = useState<string | null>(null)
  const vaultName = vaultPath?.split('/').pop() ?? 'Thought Engine'

  useEffect(() => {
    if (!vaultPath) return
    window.api.vault
      .gitBranch(vaultPath)
      .then(setGitBranch)
      .catch(() => setGitBranch(null))
  }, [vaultPath])

  return (
    <div
      className="h-6 flex items-center px-3 text-[11px] border-t flex-shrink-0"
      style={{
        backgroundColor: colors.bg.surface,
        color: colors.text.muted,
        borderColor: colors.border.default
      }}
    >
      <span>{vaultName}</span>
      <span className="mx-2">&middot;</span>
      <span>{fileCount} notes</span>
      {gitBranch && (
        <>
          <span className="mx-2">&middot;</span>
          <span>{gitBranch}</span>
        </>
      )}
    </div>
  )
}

function ContentArea() {
  const contentView = useGraphStore((s) => s.contentView)
  const setActiveNote = useEditorStore((s) => s.setActiveNote)
  const setContentView = useGraphStore((s) => s.setContentView)

  const handleNodeClick = useCallback(
    (id: string) => {
      setActiveNote(id, null)
      setContentView('editor')
    },
    [setActiveNote, setContentView]
  )

  const handleNavigate = useCallback(
    (id: string) => {
      setActiveNote(id, null)
    },
    [setActiveNote]
  )

  return (
    <div className="h-full relative">
      <GraphControls />
      {contentView === 'graph' ? (
        <GraphPanel onNodeClick={handleNodeClick} />
      ) : (
        <EditorPanel onNavigate={handleNavigate} />
      )}
    </div>
  )
}

function ConnectedSidebar() {
  const files = useVaultStore((s) => s.files)
  const config = useVaultStore((s) => s.config)
  const activeWorkspace = useVaultStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useVaultStore((s) => s.setActiveWorkspace)
  const setActiveNote = useEditorStore((s) => s.setActiveNote)
  const activeNotePath = useEditorStore((s) => s.activeNotePath)

  const handleFileSelect = useCallback(
    (path: string) => {
      const file = files.find((f) => f.path === path)
      if (file) {
        setActiveNote(file.path, file.path)
      }
    },
    [files, setActiveNote]
  )

  const handleSearch = useCallback((_query: string) => {
    // TODO: wire to vault index search
  }, [])

  const handleToggleDirectory = useCallback((_path: string) => {
    // TODO: directory collapse state
  }, [])

  const treeItems = files.map((f) => ({
    path: f.path,
    filename: f.filename,
    title: f.title,
    modified: f.modified,
    isDirectory: false as const,
    depth: 0
  }))

  return (
    <Sidebar
      items={treeItems}
      workspaces={config?.workspaces ?? []}
      activeWorkspace={activeWorkspace}
      activeFilePath={activeNotePath}
      onSearch={handleSearch}
      onWorkspaceSelect={setActiveWorkspace}
      onFileSelect={handleFileSelect}
      onToggleDirectory={handleToggleDirectory}
    />
  )
}

const BUILT_IN_COMMANDS: CommandItem[] = [
  { id: 'cmd:new-note', label: 'New Note', category: 'command', shortcut: '\u2318N' },
  { id: 'cmd:toggle-view', label: 'Toggle Graph/Editor', category: 'command', shortcut: '\u2318G' },
  { id: 'cmd:toggle-sidebar', label: 'Toggle Sidebar', category: 'command', shortcut: '\u2318B' },
  { id: 'cmd:toggle-terminal', label: 'Toggle Terminal', category: 'command', shortcut: '\u2318`' },
  {
    id: 'cmd:toggle-mode',
    label: 'Toggle Source/Rich Mode',
    category: 'command',
    shortcut: '\u2318/'
  }
]

function WorkspaceShell() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const files = useVaultStore((s) => s.files)
  const vaultPath = useVaultStore((s) => s.vaultPath)
  const setActiveNote = useEditorStore((s) => s.setActiveNote)
  const contentView = useGraphStore((s) => s.contentView)
  const setContentView = useGraphStore((s) => s.setContentView)
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)
  const vaultName = vaultPath?.split('/').pop() ?? 'Thought Engine'

  const toggleView = useCallback(() => {
    setContentView(contentView === 'editor' ? 'graph' : 'editor')
  }, [contentView, setContentView])

  const toggleSourceMode = useCallback(() => {
    setMode(mode === 'rich' ? 'source' : 'rich')
  }, [mode, setMode])

  useKeyboard({
    onCommandPalette: () => setPaletteOpen(true),
    onToggleView: toggleView,
    onToggleSourceMode: toggleSourceMode,
    onEscape: () => setPaletteOpen(false)
  })

  const paletteItems = useMemo<CommandItem[]>(() => {
    const noteItems: CommandItem[] = files.map((f) => ({
      id: `note:${f.path}`,
      label: f.title,
      category: 'note'
    }))
    return [...noteItems, ...BUILT_IN_COMMANDS]
  }, [files])

  const handlePaletteSelect = useCallback(
    (item: CommandItem) => {
      if (item.id.startsWith('note:')) {
        const path = item.id.slice(5)
        setActiveNote(path, path)
        setContentView('editor')
      } else if (item.id === 'cmd:toggle-view') {
        toggleView()
      } else if (item.id === 'cmd:toggle-mode') {
        toggleSourceMode()
      }
    },
    [setActiveNote, setContentView, toggleView, toggleSourceMode]
  )

  return (
    <div
      className="h-screen w-screen flex flex-col"
      style={{ backgroundColor: colors.bg.base, color: colors.text.primary }}
    >
      <Titlebar vaultName={vaultName} onOpenSettings={() => setSettingsOpen(true)} />
      <div className="flex-1 overflow-hidden">
        <SplitPane
          left={
            <PanelErrorBoundary name="Sidebar">
              <ConnectedSidebar />
            </PanelErrorBoundary>
          }
          right={
            <SplitPane
              left={
                <PanelErrorBoundary name="Content">
                  <ContentArea />
                </PanelErrorBoundary>
              }
              right={
                <PanelErrorBoundary name="Terminal">
                  <TerminalPanel />
                </PanelErrorBoundary>
              }
              initialLeftWidth={580}
              minLeftWidth={300}
              minRightWidth={400}
            />
          }
          initialLeftWidth={240}
          minLeftWidth={0}
          minRightWidth={500}
        />
      </div>
      <StatusBar />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
        onSelect={handlePaletteSelect}
      />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div
      className="h-screen w-screen flex items-center justify-center"
      style={{ backgroundColor: colors.bg.base }}
    >
      <div className="text-center">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: colors.accent.default, borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: colors.text.muted }}>
          Loading vault...
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const vaultPath = useVaultStore((s) => s.vaultPath)
  const isLoading = useVaultStore((s) => s.isLoading)
  const loadVault = useVaultStore((s) => s.loadVault)
  const setWorkerResult = useVaultStore((s) => s.setWorkerResult)
  const setFiles = useVaultStore((s) => s.setFiles)

  const onWorkerResult = useCallback(
    (result: { artifacts: any[]; graph: any; errors: any[]; fileToId: Record<string, string> }) => {
      setWorkerResult(result)
      const files = useVaultStore.getState().files
      const updatedFiles = files.map((f) => {
        const id = result.fileToId[f.path]
        const artifact = id ? result.artifacts.find((a: any) => a.id === id) : undefined
        return artifact ? { ...f, title: artifact.title, modified: artifact.modified } : f
      })
      setFiles(updatedFiles)
    },
    [setWorkerResult, setFiles]
  )

  const { loadFiles, updateFile, removeFile } = useVaultWorker(onWorkerResult)

  const orchestrateLoad = useCallback(
    async (path: string) => {
      await window.api.vault.init(path)
      await loadVault(path)
      const state = useVaultStore.getState().state
      if (state) {
        if (state.contentView)
          useGraphStore.getState().setContentView(state.contentView as 'editor' | 'graph')
        if (state.selectedNodeId) useGraphStore.getState().setSelectedNode(state.selectedNodeId)
        if (state.lastOpenNote)
          useEditorStore.getState().setActiveNote(state.lastOpenNote, state.lastOpenNote)
      }
      window.api.config.write('app', 'lastVaultPath', path)
      await window.api.vault.watchStart(path)
      const filePaths = useVaultStore.getState().files.map((f) => f.path)
      const filesWithContent = await Promise.all(
        filePaths.map(async (p) => ({ path: p, content: await window.api.fs.readFile(p) }))
      )
      loadFiles(filesWithContent)
    },
    [loadVault, loadFiles]
  )

  useEffect(() => {
    window.api.config
      .read('app', 'lastVaultPath')
      .then((savedPath) => {
        if (typeof savedPath === 'string' && savedPath) orchestrateLoad(savedPath)
      })
      .catch(() => {})
  }, [orchestrateLoad])

  useEffect(() => {
    const unsub = window.api.on.fileChanged(async (data) => {
      if (data.event === 'unlink') {
        removeFile(data.path)
      } else {
        updateFile(data.path, await window.api.fs.readFile(data.path))
      }
    })
    return () => {
      unsub()
    }
  }, [updateFile, removeFile])

  return (
    <ThemeProvider>
      {isLoading ? (
        <LoadingSkeleton />
      ) : vaultPath ? (
        <WorkspaceShell />
      ) : (
        <WelcomeScreen onVaultSelected={orchestrateLoad} />
      )}
    </ThemeProvider>
  )
}
