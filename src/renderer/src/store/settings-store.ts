import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ThemeId, AccentColorId } from '../design/themes'

interface SettingsState {
  theme: ThemeId
  accentColor: AccentColorId
  fontSize: number
  fontFamily: string
  defaultEditorMode: 'rich' | 'source'
  autosaveInterval: number
  spellCheck: boolean
  terminalShell: string
  terminalFontSize: number
  scrollbackLines: number
}

interface SettingsActions {
  setTheme: (value: ThemeId) => void
  setAccentColor: (value: AccentColorId) => void
  setFontSize: (value: number) => void
  setFontFamily: (value: string) => void
  setDefaultEditorMode: (value: 'rich' | 'source') => void
  setAutosaveInterval: (value: number) => void
  setSpellCheck: (value: boolean) => void
  setTerminalShell: (value: string) => void
  setTerminalFontSize: (value: number) => void
  setScrollbackLines: (value: number) => void
}

type SettingsStore = SettingsState & SettingsActions

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'midnight',
      accentColor: 'teal',
      fontSize: 13,
      fontFamily: 'Inter',
      defaultEditorMode: 'rich',
      autosaveInterval: 1500,
      spellCheck: false,
      terminalShell: '',
      terminalFontSize: 13,
      scrollbackLines: 10000,

      setTheme: (value) => set({ theme: value }),
      setAccentColor: (value) => set({ accentColor: value }),
      setFontSize: (value) => set({ fontSize: value }),
      setFontFamily: (value) => set({ fontFamily: value }),
      setDefaultEditorMode: (value) => set({ defaultEditorMode: value }),
      setAutosaveInterval: (value) => set({ autosaveInterval: value }),
      setSpellCheck: (value) => set({ spellCheck: value }),
      setTerminalShell: (value) => set({ terminalShell: value }),
      setTerminalFontSize: (value) => set({ terminalFontSize: value }),
      setScrollbackLines: (value) => set({ scrollbackLines: value }),
    }),
    {
      name: 'thought-engine-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
