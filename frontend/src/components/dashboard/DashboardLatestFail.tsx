import { Link, useLocation } from 'react-router-dom'
import InspectionThumbnail from '@/components/inspection/InspectionThumbnail'
import type { InspectionLog } from '@/types/inspection'
import { inspectionResultLabel } from '@/types/inspection'
import { inspectionDetailPath } from '@/utils/historyNavigation'
import { primaryFailReason } from '@/utils/dashboardDefectSummary'
import { formatInspectionId, modelBoardSubtitle } from '@/utils/inspectionDisplay'

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
  const location = useLocation()

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
  const reason = primaryFailReason(log)
  const returnTo = `${location.pathname}${location.search}` || '/'

  return (
    <Link
      to={inspectionDetailPath(log.id)}
      state={{ returnTo }}
      className="hmi-panel shrink-0 flex gap-2 p-2 border-[var(--dash-danger)] bg-[var(--dash-danger)]/8 hover:bg-[var(--dash-danger)]/12 min-w-0"
    >
      <div className="shrink-0 w-20 h-20 overflow-hidden border border-[var(--dash-border)] bg-black/10">
        <InspectionThumbnail
          imagePath={log.imagePath}
          result={log.result}
          size={80}
          className="!w-full !h-full !max-w-none"
        />
      </div>
      <div className="min-w-0 flex-1 text-[11px] leading-snug overflow-hidden">
        <p className="font-bold text-[var(--dash-danger)]">최신 FAIL</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <span className="dash-num text-[15px] font-bold text-[var(--dash-text-primary)] whitespace-nowrap">
            {formatInspectionId(log.id)}
          </span>
          <span className="text-[13px] font-bold text-[var(--dash-danger)] whitespace-nowrap">
            {inspectionResultLabel(log.result)}
          </span>
        </p>
        <p className="text-[var(--dash-text-secondary)] truncate mt-0.5" title={modelBoardSubtitle(log.deviceId, log.silkBoardName)}>
          {modelBoardSubtitle(log.deviceId, log.silkBoardName)}
        </p>
        {reason && (
          <p
            className="text-[var(--dash-danger)] font-medium mt-1 line-clamp-3 break-words leading-snug"
            title={reason}
          >
            {reason}
          </p>
        )}
        <p className="text-[var(--dash-text-tertiary)] tabular-nums mt-1 whitespace-nowrap">
          {date}
          {time ? ` ${time}` : ''}
        </p>
        <p className="text-[var(--dash-accent)] font-semibold mt-1">상세 보기</p>
      </div>
    </Link>
  )
}
