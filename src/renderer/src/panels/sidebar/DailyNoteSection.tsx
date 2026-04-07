import { useState, useMemo, useCallback } from 'react'
import { colors } from '../../design/tokens'
import { useSettingsStore } from '../../store/settings-store'
import { useVaultStore } from '../../store/vault-store'
import { extractDailyNoteDates, localDateStr } from '../../utils/daily-notes'

interface DailyNoteSectionProps {
  onOpenDate: (dateStr: string) => void
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function formatMonthYear(year: number, month: number): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ]
  return `${months[month]} ${year}`
}

export function DailyNoteSection({ onOpenDate }: DailyNoteSectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [viewDate, setViewDate] = useState(() => new Date())

  const vaultPath = useVaultStore((s) => s.vaultPath)
  const files = useVaultStore((s) => s.files)
  const dailyNoteFolder = useSettingsStore((s) => s.dailyNoteFolder)

  const noteDates = useMemo(
    () =>
      vaultPath ? extractDailyNoteDates(files, vaultPath, dailyNoteFolder) : new Set<string>(),
    [files, vaultPath, dailyNoteFolder]
  )

  const todayStr = localDateStr()

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const totalDays = daysInMonth(year, month)
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const prevMonth = useCallback(() => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }, [])

  const nextMonth = useCallback(() => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }, [])

  const goToToday = useCallback(() => {
    setViewDate(new Date())
    onOpenDate(todayStr)
  }, [onOpenDate, todayStr])

  const handleDayClick = useCallback(
    (day: number) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      onOpenDate(dateStr)
    },
    [year, month, onOpenDate]
  )

  // Build calendar grid cells
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  return (
    <div className="px-3 pt-1 pb-2">
      {/* Header */}
      <button
        className="flex items-center gap-1.5 w-full text-left mb-1"
        style={{
          color: colors.text.secondary,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span
          className="text-[9px] transition-transform"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
        <span className="text-[11px] font-medium tracking-wide uppercase">Daily Notes</span>
      </button>

      {!collapsed && (
        <div>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={prevMonth}
              style={{
                background: 'none',
                border: 'none',
                color: colors.text.muted,
                cursor: 'pointer',
                fontSize: '11px',
                padding: '2px 4px'
              }}
            >
              ‹
            </button>
            <span style={{ color: colors.text.secondary, fontSize: '11px', fontWeight: 500 }}>
              {formatMonthYear(year, month)}
            </span>
            <button
              onClick={nextMonth}
              style={{
                background: 'none',
                border: 'none',
                color: colors.text.muted,
                cursor: 'pointer',
                fontSize: '11px',
                padding: '2px 4px'
              }}
            >
              ›
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-0 mb-0.5">
            {WEEKDAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="text-center"
                style={{ color: colors.text.muted, fontSize: '9px', lineHeight: '16px' }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} />
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const hasNote = noteDates.has(dateStr)
              const isToday = dateStr === todayStr

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(day)}
                  style={{
                    background: isToday ? 'var(--color-accent-default)' : 'none',
                    border: 'none',
                    borderRadius: '4px',
                    color: isToday
                      ? '#fff'
                      : hasNote
                        ? 'var(--color-accent-default)'
                        : colors.text.muted,
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: hasNote || isToday ? 600 : 400,
                    lineHeight: '20px',
                    padding: 0,
                    textAlign: 'center' as const,
                    position: 'relative' as const
                  }}
                >
                  {day}
                  {hasNote && !isToday && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '1px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '3px',
                        height: '3px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-accent-default)'
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Today button */}
          <button
            onClick={goToToday}
            className="w-full mt-1.5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '4px',
              color: colors.text.secondary,
              cursor: 'pointer',
              fontSize: '10px',
              padding: '3px 0',
              textAlign: 'center'
            }}
          >
            Today
          </button>
        </div>
      )}
    </div>
  )
}
