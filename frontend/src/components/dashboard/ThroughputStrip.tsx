/**
 * 최근 24시간 처리량·마지막 검사 공백 표시
 */

import type { InspectionLog } from '@/types/inspection'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import type { LineFilter } from '@/utils/inspectionFilters'
import { filterByLine } from '@/utils/inspectionFilters'

export default function ThroughputStrip({
  allLogs,
  lineFilter,
}: {
  allLogs: InspectionLog[]
  lineFilter: LineFilter
}) {
  const { formatSplitDateTime } = useDashboardSettings()
  const scoped = filterByLine(allLogs, lineFilter)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const recent24 = scoped.filter((l) => new Date(l.inspectedAt).getTime() >= cutoff)
  const perHour = recent24.length / 24

  const sorted = [...scoped].sort(
    (a, b) => new Date(b.inspectedAt).getTime() - new Date(a.inspectedAt).getTime()
  )
  const last = sorted[0]
  const gapMin =
    last != null
      ? Math.max(0, Math.round((Date.now() - new Date(last.inspectedAt).getTime()) / 60_000))
      : null

  const lastLabel = last
    ? (() => {
        const { date, time } = formatSplitDateTime(last.inspectedAt)
        return time ? `${date} ${time}` : date
      })()
    : '—'

  return (
    <div className="glass-panel-subtle flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3 text-sm text-[var(--dash-text-secondary)]">
      <span>
        <span className="text-[var(--dash-text-tertiary)]">최근 24h</span>{' '}
        <strong className="text-[var(--dash-text-primary)]">{recent24.length}건</strong>
        {recent24.length > 0 && (
          <span className="text-[var(--dash-text-tertiary)]">
            {' '}
            (시간당 약 {perHour < 0.1 ? perHour.toFixed(2) : perHour.toFixed(1)}건)
          </span>
        )}
      </span>
      <span className="hidden sm:inline text-[var(--dash-border)]">|</span>
      <span>
        <span className="text-[var(--dash-text-tertiary)]">마지막 검사</span>{' '}
        <strong className="text-[var(--dash-text-primary)] font-mono text-[13px]">{lastLabel}</strong>
        {gapMin != null && (
          <span className="text-[var(--dash-text-tertiary)]"> · {gapMin}분 전</span>
        )}
      </span>
    </div>
  )
}
