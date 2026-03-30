import { useCallback, useState } from 'react'
import { colors, typography } from '../../design/tokens'

export function CanvasWelcomeCard() {
  const [isHovered, setIsHovered] = useState(false)

  const handleOpenFolder = useCallback(async () => {
    const path = await window.api.fs.selectVault()
    if (path) {
      window.dispatchEvent(new CustomEvent('te:open-vault', { detail: path }))
    }
  }, [])

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-[1]"
      style={{ marginTop: -40 }}
    >
      <div
        style={{
          width: 360,
          padding: '32px 28px',
          borderRadius: 16,
          backgroundColor: 'var(--canvas-card-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--canvas-card-border)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontFamily: typography.fontFamily.mono,
            color: colors.text.muted,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 12
          }}
        >
          Thought Engine
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 500,
            fontFamily: typography.fontFamily.display,
            color: colors.text.primary,
            lineHeight: 1.4,
            marginBottom: 8
          }}
        >
          Open a folder to get started.
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontFamily: typography.fontFamily.body,
            color: colors.text.secondary,
            lineHeight: 1.6,
            marginBottom: 24
          }}
        >
          Point Thought Engine at any folder of markdown files. Your notes become an explorable
          knowledge graph with connections, clusters, and tensions.
        </p>
        <button
          type="button"
          onClick={handleOpenFolder}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            padding: '9px 20px',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: typography.fontFamily.body,
            color: '#fff',
            backgroundColor: isHovered ? colors.accent.hover : colors.accent.default,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'background-color 150ms ease-out',
            lineHeight: 1.5
          }}
        >
          Open Folder
        </button>
      </div>
    </div>
  )
}

export function EmptyCanvasHint({ rawFileCount }: { readonly rawFileCount: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
      <div
        style={{
          width: 420,
          maxWidth: 'calc(100% - 32px)',
          padding: '20px 22px',
          borderRadius: 18,
          backgroundColor: 'rgba(12, 12, 16, 0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 22px 48px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontFamily: typography.fontFamily.mono,
            color: colors.text.muted,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: 10
          }}
        >
          Vault Canvas
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 500,
            fontFamily: typography.fontFamily.display,
            color: colors.text.primary,
            lineHeight: 1.35,
            marginBottom: 8
          }}
        >
          Canvas is empty.
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontFamily: typography.fontFamily.body,
            color: colors.text.secondary,
            lineHeight: 1.6,
            marginBottom: 14
          }}
        >
          Drag notes in from the Files sidebar, or press Cmd+G to place a note without leaving the
          canvas.
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontFamily: typography.fontFamily.mono,
              color: colors.text.secondary,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 999,
              padding: '6px 10px'
            }}
          >
            Drag from Files
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily: typography.fontFamily.mono,
              color: colors.text.secondary,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 999,
              padding: '6px 10px'
            }}
          >
            Cmd+G import
          </span>
          {rawFileCount > 0 && (
            <span
              style={{
                fontSize: 11,
                fontFamily: typography.fontFamily.mono,
                color: colors.text.primary,
                backgroundColor: 'rgba(92, 184, 196, 0.1)',
                border: '1px solid rgba(92, 184, 196, 0.2)',
                borderRadius: 999,
                padding: '6px 10px'
              }}
            >
              {rawFileCount} file{rawFileCount !== 1 ? 's' : ''} ready for /connect-vault
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
