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
    <td className="px-3 py-1.5 align-middle border-r border-[var(--dash-border)] last:border-r-0">
      <div className="text-[10px] text-[var(--dash-text-tertiary)]">{label}</div>
      <div className="text-[18px] font-bold dash-num leading-tight">
        <span
          className={clsx(
            tone === 'default' && 'text-[var(--dash-text-primary)]',
            tone === 'ok' && 'text-[var(--dash-success)]',
            tone === 'ng' && 'text-[var(--dash-danger)]',
            tone === 'warn' && 'text-[var(--dash-warning)]'
          )}
        >
          {value}
        </span>
      </div>
      {sub ? <div className="text-[10px] text-[var(--dash-text-tertiary)] mt-0.5">{sub}</div> : null}
    </td>
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
    return <div className="hmi-panel h-12 animate-pulse bg-[var(--dash-bg-secondary)]" />
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
    <div className="hmi-panel overflow-hidden">
      <div className="hmi-panel__head">
        <span className="hmi-panel__title">?? KPI</span>
        <span className="hmi-panel__meta">
          {dateLabel}
          {cumulative != null && cumulative.total > 0 && (
            <>
              {' ? '}
              ?? {cumulative.total.toLocaleString()}? FAIL {cumulative.fail.toLocaleString()} (
              {formatRate(cumulative.failRate)})
            </>
          )}
        </span>
      </div>
      <table className="w-full border-collapse">
        <tbody>
          <tr className="bg-[var(--dash-surface)]">
            <KpiCell
              label="??"
              value={day.yieldPct != null ? formatRate(day.yieldPct) : '?'}
              sub={`?? ${formatRate(targetYieldPct)}`}
              tone={yieldTone}
            />
            <KpiCell
              label="????"
              value={day.total.toLocaleString()}
              sub={`P ${day.pass} / F ${day.fail}`}
            />
            <KpiCell
              label="FAIL"
              value={day.fail.toLocaleString()}
              sub={day.failRate != null ? formatRate(day.failRate) : undefined}
              tone={day.fail > 0 ? 'ng' : 'ok'}
            />
            <KpiCell
              label="????"
              value={
                day.yieldPct != null
                  ? `${day.yieldPct >= targetYieldPct ? '+' : ''}${(day.yieldPct - targetYieldPct).toFixed(1)}%p`
                  : '?'
              }
              sub={day.yieldPct != null && day.yieldPct < targetYieldPct ? '??' : '??'}
              tone={yieldTone}
            />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function dashboardTodayHistoryPath(result?: 'PASS' | 'FAIL') {
  const today = getLocalDateString()
  return buildHistoryPath({ from: today, to: today, ...(result ? { result } : {}) })
}
