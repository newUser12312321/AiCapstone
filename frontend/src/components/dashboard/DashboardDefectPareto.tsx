interface DashboardDefectParetoProps {
  items: [label: string, count: number][]
  onSelect: (label: string) => void
}

export default function DashboardDefectPareto({ items, onSelect }: DashboardDefectParetoProps) {
  const max = items.length ? Math.max(...items.map(([, c]) => c)) : 0

  return (
    <div className="hmi-panel flex min-h-0 flex-col overflow-hidden h-full">
      <div className="hmi-panel__head shrink-0">
        <span className="hmi-panel__title">FAIL 유형</span>
        <span className="hmi-panel__meta">당일 · 클릭→이력</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--dash-text-secondary)] py-4 text-center">
            집계할 FAIL 데이터가 없습니다.
          </p>
        ) : (
          items.map(([label, count]) => {
            const pct = max ? Math.round((count / max) * 100) : 0
            return (
              <button
                type="button"
                key={label}
                onClick={() => onSelect(label)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs text-[var(--dash-text-secondary)] truncate group-hover:text-[var(--dash-text-primary)]">
                    {label}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-[var(--dash-text-primary)] shrink-0">
                    {count}
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--dash-bg-secondary)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--dash-danger)]"
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
