import type { DefectParetoRow } from '@/utils/dashboardDefectSummary'

interface DashboardDefectParetoProps {
  items: DefectParetoRow[]
  onSelect: (filterKey: string) => void
  title?: string
  hint?: string
}

export default function DashboardDefectPareto({
  items,
  onSelect,
  title = 'FAIL ??',
  hint = '?? ? ?????',
}: DashboardDefectParetoProps) {
  const max = items.length ? Math.max(...items.map((i) => i.count)) : 0

  return (
    <div className="hmi-panel flex min-h-0 flex-col overflow-hidden h-full">
      <div className="hmi-panel__head shrink-0">
        <span className="hmi-panel__title">{title}</span>
        {hint ? <span className="hmi-panel__meta">{hint}</span> : null}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--dash-text-secondary)] py-4 text-center">
            ??? FAIL ???? ????.
          </p>
        ) : (
          items.map((row) => {
            const pct = max ? Math.round((row.count / max) * 100) : 0
            return (
              <button
                type="button"
                key={row.filterKey}
                onClick={() => onSelect(row.filterKey)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className={
                      row.kind === 'missing'
                        ? 'text-xs font-semibold text-[var(--dash-danger)] truncate group-hover:underline'
                        : 'text-xs text-[var(--dash-text-secondary)] truncate group-hover:text-[var(--dash-text-primary)]'
                    }
                  >
                    {row.label}
                  </span>
                  {row.kind !== 'missing' && (
                    <span className="text-xs font-semibold tabular-nums text-[var(--dash-text-primary)] shrink-0">
                      {row.count}
                    </span>
                  )}
                </div>
                <div className="h-1.5 bg-[var(--dash-bg-secondary)] overflow-hidden">
                  <div
                    className={
                      row.kind === 'missing'
                        ? 'h-full bg-[var(--dash-danger)]'
                        : 'h-full bg-[var(--dash-danger)]/70'
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
