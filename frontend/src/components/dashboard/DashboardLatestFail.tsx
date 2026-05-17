import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
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
    return (
      <div className="min-h-[140px] rounded-lg border border-[var(--dash-danger)]/30 bg-[var(--dash-surface)] animate-pulse" />
    )
  }
  if (!log) {
    return (
      <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-6 text-center text-sm text-[var(--dash-text-secondary)]">
        당일 FAIL 없음
      </div>
    )
  }

  const { date, time } = formatSplitDateTime(log.inspectedAt)
  const review = log.reviewStatus ?? 'PENDING'

  return (
    <Link
      to={buildHistoryPath({ from: log.inspectedAt.slice(0, 10), result: 'FAIL', open: log.id })}
      className={clsx(
        'group flex gap-4 rounded-lg border border-[var(--dash-danger)]/45 bg-[var(--dash-danger)]/6 p-3',
        'hover:bg-[var(--dash-danger)]/10 transition-colors'
      )}
    >
      <div className="shrink-0 w-28 h-28 rounded-md overflow-hidden border border-[var(--dash-border)] bg-black/5">
        <InspectionThumbnail
          imagePath={log.imagePath}
          result={log.result}
          size={112}
          className="!w-full !h-full !max-w-none"
        />
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dash-danger)]">
          최신 FAIL — 리뷰 대기
        </p>
        <p className="text-lg font-bold text-[var(--dash-text-primary)] tabular-nums">
          #{log.id}{' '}
          <span className="text-sm font-semibold text-[var(--dash-danger)]">
            {inspectionResultLabel(log.result)}
          </span>
        </p>
        <p className="text-xs text-[var(--dash-text-secondary)]">
          {deviceDisplayLabel(log.deviceId)} · {(log.silkBoardName ?? '').trim() || '보드 미식별'}
        </p>
        <p className="text-xs text-[var(--dash-text-tertiary)]">
          {date} {time} · 리뷰 {review}
        </p>
        <p className="text-xs text-[var(--dash-accent)] group-hover:underline inline-flex items-center gap-0.5 mt-1">
          FAIL 리뷰 열기 <ChevronRight size={14} />
        </p>
      </div>
    </Link>
  )
}
