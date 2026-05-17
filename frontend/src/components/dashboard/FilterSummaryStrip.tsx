import clsx from 'clsx'
import type { InspectionLog, InspectionStats } from '@/types/inspection'
import { summarizeInspections } from '@/utils/inspectionSummary'

interface FilterSummaryStripProps {
  logs?: InspectionLog[]
  stats?: InspectionStats | null
  title: string
  subtitle?: string
  formatRate: (n: number) => string
  targetYieldPct?: number
}

function Cell({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'ok' | 'ng' | 'warn'
}) {
  return (
    <div className="px-3 py-2.5 min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--dash-text-tertiary)]">
        {label}
      </p>
      <p
        className={clsx(
          'mt-0.5 text-lg font-bold tabular-nums',
          tone === 'ok' && 'text-[var(--dash-success)]',
          tone === 'ng' && 'text-[var(--dash-danger)]',
          tone === 'warn' && 'text-[var(--dash-warning)]',
          tone === 'default' && 'text-[var(--dash-text-primary)]'
        )}
      >
        {value}
      </p>
    </div>
  )
}

export default function FilterSummaryStrip({
  logs,
  stats,
  title,
  subtitle,
  formatRate,
  targetYieldPct,
}: FilterSummaryStripProps) {
  const s = stats
    ? {
        total: stats.totalCount,
        pass: stats.passCount,
        fail: stats.failCount,
        yieldPct: stats.totalCount ? (stats.passCount / stats.totalCount) * 100 : null,
      }
    : summarizeInspections(logs ?? [])
  const yieldTone =
    s.yieldPct == null
      ? 'default'
      : targetYieldPct != null && s.yieldPct < targetYieldPct
        ? 'ng'
        : s.fail > 0
          ? 'warn'
          : 'ok'

  return (
    <div className="border border-[var(--dash-border)] bg-[var(--dash-surface)] rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--dash-border)] bg-[var(--dash-bg-secondary)]">
        <p className="text-xs font-semibold text-[var(--dash-text-primary)]">{title}</p>
        {subtitle && <p className="text-[10px] text-[var(--dash-text-tertiary)]">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--dash-border)]">
        <Cell
          label="수율"
          value={s.yieldPct != null ? formatRate(s.yieldPct) : '—'}
          tone={yieldTone}
        />
        <Cell label="검사 수" value={s.total.toLocaleString()} />
        <Cell label="PASS" value={s.pass.toLocaleString()} tone="ok" />
        <Cell label="FAIL" value={s.fail.toLocaleString()} tone={s.fail > 0 ? 'ng' : 'ok'} />
      </div>
    </div>
  )
}
