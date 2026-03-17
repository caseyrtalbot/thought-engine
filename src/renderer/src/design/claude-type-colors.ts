export const CLAUDE_TYPE_COLORS = {
  settings: '#f59e0b',
  agents: '#a78bfa',
  skills: '#22d3ee',
  rules: '#94a3b8',
  commands: '#34d399',
  teams: '#f472b6',
  memory: '#fb923c'
} as const

export type ClaudeTypeKey = keyof typeof CLAUDE_TYPE_COLORS
