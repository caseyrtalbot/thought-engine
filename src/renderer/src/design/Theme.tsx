import { createContext, useContext, type ReactNode } from 'react'
import { colors, spacing, typography, transitions } from './tokens'

interface ThemeContextType {
  colors: typeof colors
  spacing: typeof spacing
  typography: typeof typography
  transitions: typeof transitions
}

const ThemeContext = createContext<ThemeContextType>({
  colors,
  spacing,
  typography,
  transitions,
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ colors, spacing, typography, transitions }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
