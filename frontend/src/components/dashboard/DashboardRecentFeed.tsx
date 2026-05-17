import clsx from 'clsx'
import { useNavigate, useLocation } from 'react-router-dom'
import InspectionThumbnail from '@/components/inspection/InspectionThumbnail'
import type { InspectionLog } from '@/types/inspection'
import { deviceDisplayLabel, inspectionResultLabel } from '@/types/inspection'
import { inspectionDetailPath } from '@/utils/historyNavigation'

interface DashboardRecentFeedProps {
  logs: InspectionLog[]
  isLoading: boolean
  formatSplitDateTime: (iso: string) => { date: string; time: string }
  maxRows?: number
}

function boardLabel(log: InspectionLog): string {
  const b = (log.silkBoardName ?? '').trim()
  return b || '—'
}

export default function DashboardRecentFeed({
  logs,
  isLoading,
  formatSplitDateTime,
  maxRows = 8,
}: DashboardRecentFeedProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const rows = logs.slice(0, maxRows)

  return (
    <div className="hmi-panel flex min-h-0 flex-1 flex-col overflow-hidden h-full">
      <div className="hmi-panel__head">
        <span className="hmi-panel__title">최근 검사</span>
        <span className="hmi-panel__meta">최근 {maxRows}건 · 행 클릭→상세</span>
      </div>

      <div className="overflow-x-auto overflow-y-auto min-h-0 flex-1">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-[var(--dash-bg-secondary)] z-[1] border-b border-[var(--dash-border)]">
            <tr className="text-left text-[10px] font-bold text-[var(--dash-text-tertiary)]">
              <th className="w-12 px-1.5 py-1" />
              <th className="px-1.5 py-1">ID</th>
              <th className="px-1.5 py-1">시각</th>
              <th className="px-1.5 py-1 hidden sm:table-cell">기종</th>
              <th className="px-1.5 py-1 hidden md:table-cell">보드</th>
              <th className="px-1.5 py-1">판정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--dash-border)]">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="px-3 py-3">
                    <div className="h-10 bg-[var(--dash-bg-secondary)] rounded" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-[var(--dash-text-secondary)]">
                  검사 내역이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((log) => {
                const { date, time } = formatSplitDateTime(log.inspectedAt)
                const fail = log.result === 'FAIL'
                return (
                  <tr
                    key={log.id}
                    onClick={() =>
                      navigate(inspectionDetailPath(log.id), {
                        state: { returnTo: `${location.pathname}${location.search}` || '/' },
                      })
                    }
                    className="cursor-pointer hover:bg-[var(--dash-bg-secondary)]/80"
                  >
                    <td className="px-1.5 py-1">
                      <InspectionThumbnail imagePath={log.imagePath} result={log.result} size={32} />
                    </td>
                    <td className="px-1.5 py-1 dash-num text-[11px] text-[var(--dash-text-secondary)]">
                      #{log.id}
                    </td>
                    <td className="px-2 py-2 text-xs tabular-nums whitespace-nowrap">
                      <span className="text-[var(--dash-text-primary)]">{time || date}</span>
                      {time && (
                        <span className="block text-[var(--dash-text-tertiary)]">{date}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-[var(--dash-text-secondary)] hidden sm:table-cell">
                      {deviceDisplayLabel(log.deviceId)}
                    </td>
                    <td className="px-2 py-2 text-xs text-[var(--dash-text-secondary)] hidden md:table-cell max-w-[120px] truncate">
                      {boardLabel(log)}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={clsx(
                          'inline-block px-1.5 py-px text-[10px] font-bold border',
                          fail
                            ? 'text-[var(--dash-danger)] border-[var(--dash-danger)] bg-[var(--dash-danger)]/10'
                            : 'text-[var(--dash-success)] border-[var(--dash-success)] bg-[var(--dash-success)]/10'
                        )}
                      >
                        {inspectionResultLabel(log.result)}
                      </span>
                      {fail && log.defects.length > 0 && (
                        <span className="ml-1 text-[10px] text-[var(--dash-text-tertiary)]">
                          {log.defects.length}건
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
