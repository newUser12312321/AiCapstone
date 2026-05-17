import clsx from 'clsx'
import { useNavigate, useLocation } from 'react-router-dom'
import InspectionThumbnail from '@/components/inspection/InspectionThumbnail'
import type { InspectionLog } from '@/types/inspection'
import { deviceDisplayLabel, inspectionResultLabel } from '@/types/inspection'
import { inspectionDetailPath } from '@/utils/historyNavigation'
import { formatInspectionId } from '@/utils/inspectionDisplay'
import { primaryFailReason } from '@/utils/dashboardDefectSummary'

interface DashboardRecentFeedProps {
  logs: InspectionLog[]
  isLoading: boolean
  formatSplitDateTime: (iso: string) => { date: string; time: string }
  maxRows?: number
  /** 소량 데이터(데모) 시 행·썸네일 확대 */
  sparse?: boolean
  title?: string
  metaLabel?: string
  /** 우측 FAIL 패널 등에서 사유는 별도 표시 — 테이블 행 높이·줄바꿈 방지 */
  hideInlineFailReason?: boolean
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
  sparse = false,
  title = '당일 검사',
  metaLabel,
  hideInlineFailReason = false,
}: DashboardRecentFeedProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const rows = logs.slice(0, maxRows)
  const showBoardCol = rows.some((log) => {
    const board = boardLabel(log)
    if (board === '\u2014') return false
    return board !== deviceDisplayLabel(log.deviceId)
  })
  const colSpan = showBoardCol ? 6 : 5
  const thumbSize = sparse ? 48 : 32
  const rowPad = sparse ? 'py-2.5' : 'py-1'
  const tableText = sparse ? 'text-[13px]' : 'text-[12px]'

  return (
    <div className="hmi-panel flex min-h-0 flex-1 flex-col overflow-hidden h-full">
      <div className="hmi-panel__head">
        <span className="hmi-panel__title">{title}</span>
        <span className="hmi-panel__meta">
          {metaLabel ?? `상위 ${maxRows}건`}
          {' · 행 클릭→상세'}
          {sparse && rows.length > 0 ? ' · 소량 표시' : ''}
        </span>
      </div>

      <div className="overflow-x-auto overflow-y-auto min-h-0 flex-1">
        <table className={clsx('w-full', tableText)}>
          <thead className="sticky top-0 bg-[var(--dash-bg-secondary)] z-[1] border-b border-[var(--dash-border)]">
            <tr className="text-left text-[10px] font-bold text-[var(--dash-text-tertiary)]">
              <th className={clsx('px-1.5 py-1', sparse ? 'w-16' : 'w-12')} />
              <th className="px-1.5 py-1">ID</th>
              <th className="px-1.5 py-1">시각</th>
              <th className="px-1.5 py-1 hidden sm:table-cell">기종</th>
              {showBoardCol && <th className="px-1.5 py-1 hidden md:table-cell">보드</th>}
              <th className="px-1.5 py-1">판정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--dash-border)]">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={colSpan} className="px-3 py-3">
                    <div className="h-10 bg-[var(--dash-bg-secondary)] rounded" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-[var(--dash-text-secondary)]">
                  검사 내역이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((log) => {
                const { date, time } = formatSplitDateTime(log.inspectedAt)
                const fail = log.result === 'FAIL'
                const failReason = fail ? primaryFailReason(log) : null
                return (
                  <tr
                    key={log.id}
                    title={failReason ?? undefined}
                    onClick={() =>
                      navigate(inspectionDetailPath(log.id), {
                        state: { returnTo: `${location.pathname}${location.search}` || '/' },
                      })
                    }
                    className="cursor-pointer hover:bg-[var(--dash-bg-secondary)]/80 align-middle"
                  >
                    <td className={clsx('px-1.5', rowPad)}>
                      <InspectionThumbnail imagePath={log.imagePath} result={log.result} size={thumbSize} />
                    </td>
                    <td className={clsx('px-1.5 font-mono tabular-nums text-[var(--dash-text-secondary)] whitespace-nowrap', rowPad, sparse ? 'text-[12px]' : 'text-[11px]')}>
                      {formatInspectionId(log.id)}
                    </td>
                    <td className={clsx('px-2 text-xs tabular-nums whitespace-nowrap', rowPad)}>
                      <span className="text-[var(--dash-text-primary)]">{time || date}</span>
                      {time && (
                        <span className="block text-[var(--dash-text-tertiary)]">{date}</span>
                      )}
                    </td>
                    <td className={clsx('px-2 text-xs text-[var(--dash-text-secondary)] hidden sm:table-cell', rowPad)}>
                      {deviceDisplayLabel(log.deviceId)}
                    </td>
                    {showBoardCol && (
                      <td className={clsx('px-2 text-xs text-[var(--dash-text-secondary)] hidden md:table-cell max-w-[120px] truncate', rowPad)}>
                        {boardLabel(log)}
                      </td>
                    )}
                    <td className={clsx('px-2 whitespace-nowrap', rowPad)}>
                      <span
                        className={clsx(
                          'inline-block px-1.5 py-px font-bold border',
                          sparse ? 'text-[11px]' : 'text-[10px]',
                          fail
                            ? 'text-[var(--dash-danger)] border-[var(--dash-danger)] bg-[var(--dash-danger)]/10'
                            : 'text-[var(--dash-success)] border-[var(--dash-success)]/10'
                        )}
                      >
                        {inspectionResultLabel(log.result)}
                      </span>
                      {failReason && !hideInlineFailReason && (
                        <span
                          className="block mt-0.5 text-[10px] text-[var(--dash-danger)] truncate max-w-[200px]"
                          title={failReason}
                        >
                          {failReason}
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
