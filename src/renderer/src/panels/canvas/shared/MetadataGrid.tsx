import { typography } from '../../../design/tokens'

export interface MetadataEntry {
  readonly key: string
  readonly value: string
}

interface MetadataGridProps {
  readonly entries: readonly MetadataEntry[]
}

export function MetadataGrid({ entries }: MetadataGridProps) {
  if (entries.length === 0) return null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'max-content 1fr',
        rowGap: 6,
        columnGap: 16,
        marginBottom: 20
      }}
    >
      {entries.map(({ key, value }) => (
        <div key={key} style={{ display: 'contents' }}>
          <span
            style={{
              fontFamily: typography.fontFamily.mono,
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              lineHeight: 1.5,
              userSelect: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            {key.replace(/_/g, '_')}
          </span>
          <span
            style={{
              fontFamily: typography.fontFamily.mono,
              fontSize: 13,
              color: 'var(--color-text-primary)',
              lineHeight: 1.5,
              wordBreak: 'break-word'
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}
