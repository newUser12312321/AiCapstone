import { Link } from 'react-router-dom'
import InspectionThumbnail from '@/components/inspection/InspectionThumbnail'
import type { InspectionLog } from '@/types/inspection'
import { deviceDisplayLabel, inspectionResultLabel } from '@/types/inspection'
import { buildHistoryPath } from '@/utils/historyNavigation'

interface DashboardLatestFailProps {
  log?: InspectionLog
  isLoading?: boolean
  formatSplitDateTime: (iso: string) => { date: string; time: string }
}

export default function DashboardLatestFail({
  log,
  isLoading,
  formatSplitDateTime,
}: DashboardLatestFailProps) {
  if (isLoading) {
    return <div className="hmi-panel h-[100px] animate-pulse bg-[var(--dash-bg-secondary)] shrink-0" />
  }

  if (!log) {
    return (
      <div className="hmi-panel shrink-0 px-2 py-3 text-center text-[11px] text-[var(--dash-text-secondary)]">
        당일 FAIL 없음
      </div>
    )
  }

  const { date, time } = formatSplitDateTime(log.inspectedAt)

  return (
    <Link
      to={buildHistoryPath({ from: log.inspectedAt.slice(0, 10), result: 'FAIL', open: log.id })}
      className="hmi-panel shrink-0 flex gap-2 p-2 border-[var(--dash-danger)] bg-[var(--dash-danger)]/8 hover:bg-[var(--dash-danger)]/12"
    >
      <div className="shrink-0 w-20 h-20 overflow-hidden border border-[var(--dash-border)] bg-black/10">
        <InspectionThumbnail
          imagePath={log.imagePath}
          result={log.result}
          size={80}
          className="!w-full !h-full !max-w-none"
        />
      </div>
      <div className="min-w-0 flex-1 text-[11px] leading-snug">
        <p className="font-bold text-[var(--dash-danger)]">최신 FAIL</p>
        <p className="dash-num text-[15px] font-bold text-[var(--dash-text-primary)]">
          #{log.id}{' '}
          <span className="text-[var(--dash-danger)]">{inspectionResultLabel(log.result)}</span>
        </p>
        <p className="text-[var(--dash-text-secondary)] truncate">
          {deviceDisplayLabel(log.deviceId)} · {(log.silkBoardName ?? '').trim() || '—'}
        </p>
        <p className="text-[var(--dash-text-tertiary)] tabular-nums">
          {date} {time}
        </p>
        <p className="text-[var(--dash-accent)] font-semibold mt-0.5">상세 보기</p>
      </div>
    </Link>
  )
}
