import clsx from 'clsx'
import type { InspectionStats } from '@/types/inspection'
import { buildHistoryPath, getLocalDateString } from '@/utils/historyNavigation'

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function statsToDay(stats: InspectionStats | null | undefined) {
  if (!stats || stats.totalCount === 0) {
    return { total: 0, pass: 0, fail: 0, yieldPct: null as number | null, failRate: null as number | null }
  }
  const yieldPct = (stats.passCount / stats.totalCount) * 100
  return {
    total: stats.totalCount,
    pass: stats.passCount,
    fail: stats.failCount,
    yieldPct,
    failRate: stats.failRate,
  }
}

interface KpiCellProps {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'ok' | 'warn' | 'ng'
}

function KpiCell({ label, value, sub, tone = 'default' }: KpiCellProps) {
  return (
    <div className="px-4 py-3 min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--dash-text-tertiary)]">
        {label}
      </p>
      <p
        className={clsx(
          'mt-1 text-2xl font-bold tabular-nums leading-none',
          tone === 'ok' && 'text-[var(--dash-success)]',
          tone === 'ng' && 'text-[var(--dash-danger)]',
          tone === 'warn' && 'text-[var(--dash-warning)]',
          tone === 'default' && 'text-[var(--dash-text-primary)]'
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-xs text-[var(--dash-text-secondary)]">{sub}</p>}
    </div>
  )
}

export interface DashboardKpiStripProps {
  dayStats?: InspectionStats | null
  isLoading?: boolean
  targetYieldPct: number
  formatRate: (n: number) => string
  cumulative?: { total: number; pass: number; fail: number; failRate: number }
}

export default function DashboardKpiStrip({
  dayStats,
  isLoading,
  targetYieldPct,
  formatRate,
  cumulative,
}: DashboardKpiStripProps) {
  if (isLoading) {
    return <div className="h-[120px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] animate-pulse" />
  }

  const day = statsToDay(dayStats)
  const dateLabel = startOfLocalDay().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })

  const yieldTone =
    day.yieldPct == null
      ? 'default'
      : day.yieldPct >= targetYieldPct
        ? 'ok'
        : day.yieldPct >= targetYieldPct - 2
          ? 'warn'
          : 'ng'

  return (
    <div className="border border-[var(--dash-border)] bg-[var(--dash-surface)] rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-4 py-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--dash-text-primary)]">검사 현황</h2>
          <p className="text-xs text-[var(--dash-text-tertiary)]">{dateLabel} · 당일 집계</p>
        </div>
        {cumulative != null && cumulative.total > 0 && (
          <p className="text-xs text-[var(--dash-text-secondary)] tabular-nums">
            누적 {cumulative.total.toLocaleString()}건 · PASS {cumulative.pass.toLocaleString()} · FAIL{' '}
            {cumulative.fail.toLocaleString()} (불량률 {formatRate(cumulative.failRate)})
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--dash-border)]">
        <KpiCell
          label="당일 수율"
          value={day.yieldPct != null ? formatRate(day.yieldPct) : '—'}
          sub={`목표 ${formatRate(targetYieldPct)}`}
          tone={yieldTone}
        />
        <KpiCell
          label="당일 검사"
          value={day.total.toLocaleString()}
          sub={`PASS ${day.pass} · FAIL ${day.fail}`}
        />
        <KpiCell
          label="당일 FAIL"
          value={day.fail.toLocaleString()}
          sub={day.failRate != null ? `불량률 ${formatRate(day.failRate)}` : undefined}
          tone={day.fail > 0 ? 'ng' : 'ok'}
        />
        <KpiCell
          label="목표 대비"
          value={
            day.yieldPct != null
              ? `${day.yieldPct >= targetYieldPct ? '+' : ''}${(day.yieldPct - targetYieldPct).toFixed(1)}%p`
              : '—'
          }
          sub={day.yieldPct != null && day.yieldPct < targetYieldPct ? '목표 미달' : '목표 충족'}
          tone={yieldTone}
        />
      </div>
    </div>
  )
}

export function dashboardTodayHistoryPath(result?: 'PASS' | 'FAIL') {
  const today = getLocalDateString()
  return buildHistoryPath({ from: today, to: today, ...(result ? { result } : {}) })
}
