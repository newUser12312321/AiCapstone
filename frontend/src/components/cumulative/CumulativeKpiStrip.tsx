import clsx from 'clsx'
import type { InspectionStats } from '@/types/inspection'

interface KpiCellProps {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'ok' | 'warn' | 'ng'
}

function KpiCell({ label, value, sub, tone = 'default' }: KpiCellProps) {
  return (
    <td className="px-3 py-2 align-middle border-r border-[var(--dash-border)] last:border-r-0">
      <div className="text-[10px] text-[var(--dash-text-tertiary)]">{label}</div>
      <div className="text-[20px] font-bold dash-num leading-tight">
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

export interface CumulativeKpiStripProps {
  stats?: InspectionStats | null
  isLoading?: boolean
  targetYieldPct: number
  formatRate: (n: number) => string
  periodLabel: string
}

export default function CumulativeKpiStrip({
  stats,
  isLoading,
  targetYieldPct,
  formatRate,
  periodLabel,
}: CumulativeKpiStripProps) {
  if (isLoading) {
    return <div className="hmi-panel h-14 animate-pulse bg-[var(--dash-bg-secondary)]" />
  }

  const total = stats?.totalCount ?? 0
  const pass = stats?.passCount ?? 0
  const fail = stats?.failCount ?? 0
  const yieldPct = total > 0 ? (pass / total) * 100 : null
  const failRate = stats?.failRate ?? 0
  const emDash = '\u2014'

  const yieldTone =
    yieldPct == null
      ? 'default'
      : yieldPct >= targetYieldPct
        ? 'ok'
        : yieldPct >= targetYieldPct - 2
          ? 'warn'
          : 'ng'

  return (
    <div className="hmi-panel overflow-hidden shrink-0">
      <div className="hmi-panel__head">
        <span className="hmi-panel__title">누적 집계</span>
        <span className="hmi-panel__meta">{periodLabel}</span>
      </div>
      <table className="w-full border-collapse">
        <tbody>
          <tr className="bg-[var(--dash-surface)]">
            <KpiCell
              label="수율"
              value={yieldPct != null ? formatRate(yieldPct) : emDash}
              sub={`목표 ${formatRate(targetYieldPct)}`}
              tone={yieldTone}
            />
            <KpiCell
              label="검사건수"
              value={total.toLocaleString()}
              sub={`P ${pass.toLocaleString()} / F ${fail.toLocaleString()}`}
            />
            <KpiCell
              label="FAIL"
              value={fail.toLocaleString()}
              sub={total > 0 ? formatRate(failRate) : undefined}
              tone={fail > 0 ? 'ng' : 'ok'}
            />
            <KpiCell
              label="목표대비"
              value={
                yieldPct != null
                  ? `${yieldPct >= targetYieldPct ? '+' : ''}${(yieldPct - targetYieldPct).toFixed(1)}%p`
                  : emDash
              }
              sub={yieldPct != null && yieldPct < targetYieldPct ? '미달' : '충족'}
              tone={yieldTone}
            />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
