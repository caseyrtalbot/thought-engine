import { ThemeProvider } from './design/Theme'
import { SplitPane } from './design/components/SplitPane'
import { colors } from './design/tokens'

function SidebarPlaceholder() {
  return <div className="h-full p-4 text-[#8B8B8E]">Sidebar</div>
}

function ContentPlaceholder() {
  return <div className="h-full p-4 text-[#8B8B8E]">Content</div>
}

function TerminalPlaceholder() {
  return <div className="h-full p-4 text-[#8B8B8E]">Terminal</div>
}

function StatusBar() {
  return (
    <div
      className="h-6 flex items-center px-3 text-[11px] text-[#5A5A5E] border-t border-[#2A2A2E]"
      style={{ backgroundColor: colors.bg.surface }}
    >
      Thought Engine
    </div>
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
            left={<SidebarPlaceholder />}
            right={
              <SplitPane
                left={<ContentPlaceholder />}
                right={<TerminalPlaceholder />}
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
