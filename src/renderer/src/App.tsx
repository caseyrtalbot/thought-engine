import { useState, useCallback, useMemo, useEffect } from 'react'
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

function StatusBar() {
  const { vaultPath, files } = useVaultStore()
  const [gitBranch, setGitBranch] = useState<string | null>(null)
  const vaultName = vaultPath?.split('/').pop() ?? 'Thought Engine'

  useEffect(() => {
    if (!vaultPath) return
    window.electron.ipcRenderer
      .invoke('vault:git-branch', { vaultPath })
      .then(setGitBranch)
      .catch(() => setGitBranch(null))
  }, [vaultPath])

  return (
    <div
      className="h-6 flex items-center px-3 text-[11px] text-[#5A5A5E] border-t border-[#2A2A2E]"
      style={{ backgroundColor: colors.bg.surface }}
    >
      <span>{vaultName}</span>
      <span className="mx-2">&middot;</span>
      <span>{files.length} notes</span>
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
  const { contentView } = useGraphStore()
  const { setActiveNote } = useEditorStore()
  const { setContentView } = useGraphStore()

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
  const { files, config, activeWorkspace, setActiveWorkspace } = useVaultStore()
  const { setActiveNote, activeNotePath } = useEditorStore()

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
  const { files } = useVaultStore()
  const { setActiveNote } = useEditorStore()
  const { contentView, setContentView } = useGraphStore()
  const { mode, setMode } = useEditorStore()

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
      <div className="flex-1 overflow-hidden">
        <SplitPane
          left={<ConnectedSidebar />}
          right={
            <SplitPane
              left={<ContentArea />}
              right={<TerminalPanel />}
              initialLeftWidth={580}
              minLeftWidth={300}
              minRightWidth={320}
            />
          }
          initialLeftWidth={260}
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
    </div>
  )
}

export default function App() {
  const { vaultPath, loadVault } = useVaultStore()

  const handleVaultSelected = useCallback(
    (path: string) => {
      loadVault(path)
    },
    [loadVault]
  )

  return (
    <ThemeProvider>
      {vaultPath ? <WorkspaceShell /> : <WelcomeScreen onVaultSelected={handleVaultSelected} />}
    </ThemeProvider>
  )
}
