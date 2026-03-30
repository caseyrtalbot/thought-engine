import { colors } from '../../design/tokens'

interface WorkspaceFilterProps {
  workspaces: string[]
  active: string | null
  onSelect: (workspace: string | null) => void
}

export function WorkspaceFilter({ workspaces, active, onSelect }: WorkspaceFilterProps) {
  return (
    <div className="workspace-filter text-xs">
      <button
        onClick={() => onSelect(null)}
        className="workspace-chip"
        style={{
          backgroundColor: active === null ? colors.accent.muted : 'transparent',
          color: active === null ? colors.accent.default : colors.text.secondary
        }}
      >
        All
      </button>
      {workspaces.map((ws) => (
        <button
          key={ws}
          onClick={() => onSelect(ws)}
          className="workspace-chip"
          style={{
            backgroundColor: active === ws ? colors.accent.muted : 'transparent',
            color: active === ws ? colors.accent.default : colors.text.secondary
          }}
        >
          {ws}
        </button>
      ))}
    </div>
  )
}
