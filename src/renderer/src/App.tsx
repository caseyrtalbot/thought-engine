import { useCallback } from 'react'
import { ThemeProvider } from './design/Theme'
import { SplitPane } from './design/components/SplitPane'
import { Sidebar } from './panels/sidebar/Sidebar'
import { EditorPanel } from './panels/editor/EditorPanel'
import { GraphPanel } from './panels/graph/GraphPanel'
import { GraphControls } from './panels/graph/GraphControls'
import { TerminalPanel } from './panels/terminal/TerminalPanel'
import { useVaultStore } from './store/vault-store'
import { useEditorStore } from './store/editor-store'
import { useGraphStore } from './store/graph-store'
import { colors } from './design/tokens'

function StatusBar() {
  const { vaultPath, files } = useVaultStore()
  const vaultName = vaultPath?.split('/').pop() ?? 'Thought Engine'

  return (
    <div
      className="h-6 flex items-center px-3 text-[11px] text-[#5A5A5E] border-t border-[#2A2A2E]"
      style={{ backgroundColor: colors.bg.surface }}
    >
      <span>{vaultName}</span>
      <span className="mx-2">·</span>
      <span>{files.length} notes</span>
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

export default function App() {
  return (
    <ThemeProvider>
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
                initialLeftWidth={600}
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
      </div>
    </ThemeProvider>
  )
}
