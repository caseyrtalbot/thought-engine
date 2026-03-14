import { create } from 'zustand'
import type { SessionId } from '@shared/types'

interface TerminalSession {
  readonly id: SessionId
  readonly title: string
}

interface TerminalStore {
  readonly sessions: readonly TerminalSession[]
  readonly activeSessionId: SessionId | null

  addSession: (session: TerminalSession) => void
  removeSession: (id: SessionId) => void
  setActiveSession: (id: SessionId) => void
  renameSession: (id: SessionId, title: string) => void
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) =>
    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id
    })),
  removeSession: (id) =>
    set((s) => {
      const sessions = s.sessions.filter((t) => t.id !== id)
      const activeSessionId =
        s.activeSessionId === id ? (sessions[sessions.length - 1]?.id ?? null) : s.activeSessionId
      return { sessions, activeSessionId }
    }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  renameSession: (id, title) =>
    set((s) => ({
      sessions: s.sessions.map((t) => (t.id === id ? { ...t, title } : t))
    }))
}))
