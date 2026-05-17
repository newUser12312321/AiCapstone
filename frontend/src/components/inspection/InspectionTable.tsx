/**
 * 검사 이력 테이블 — 전체 로그 / 분할 목록(split) / 인라인 펼침
 */

import { Fragment, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import type { InspectionLog } from '@/types/inspection'
import { deviceDisplayLabel, inspectionResultLabel } from '@/types/inspection'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import InspectionThumbnail from '@/components/inspection/InspectionThumbnail'
import DefectViewer from './DefectViewer'
import DefectTags from './DefectTags'
import { inspectionDetailPath } from '@/utils/historyNavigation'
import { formatInspectionId } from '@/utils/inspectionDisplay'

function ResultBadge({ result, compact }: { result: 'PASS' | 'FAIL'; compact?: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold',
        compact ? 'px-2 py-0.5 rounded text-[11px] border' : 'px-3 py-1 rounded-full text-xs border-2',
        result === 'PASS'
          ? 'bg-[var(--dash-success)]/12 text-[var(--dash-success)] border-[var(--dash-success)]/50'
          : 'bg-[var(--dash-danger)]/12 text-[var(--dash-danger)] border-[var(--dash-danger)]/50'
      )}
    >
      {inspectionResultLabel(result)}
    </span>
  )
}


function SilkOcrCell({
  silkBoardName,
  silkManufacturer,
  silkManufactureDate,
}: Pick<InspectionLog, 'silkBoardName' | 'silkManufacturer' | 'silkManufactureDate'>) {
  const lines = [
    silkBoardName ? `기판: ${silkBoardName}` : null,
    silkManufacturer ? `제조사: ${silkManufacturer}` : null,
    silkManufactureDate ? `제조일: ${silkManufactureDate}` : null,
  ].filter(Boolean)
  if (!lines.length) return <span className="text-xs text-[var(--dash-text-tertiary)]">—</span>
  return (
    <div className="text-xs text-[var(--dash-text-secondary)] space-y-0.5">
      {lines.map((line, idx) => (
        <div key={idx}>{line}</div>
      ))}
    </div>
  )
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-2 py-3">
              <div className="h-3 bg-[var(--dash-bg-secondary)] rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export interface InspectionTableProps {
  logs: InspectionLog[]
  isLoading?: boolean
  resultFilter?: 'PASS' | 'FAIL'
  initialOpenLogId?: number | null
  detailMode?: 'inline' | 'route' | 'split'
  selectedId?: number
  onSelectId?: (id: number | undefined) => void
  embedded?: boolean
}

export default function InspectionTable({
  logs,
  isLoading = false,
  resultFilter,
  initialOpenLogId,
  detailMode = 'route',
  selectedId: selectedIdProp,
  onSelectId,
  embedded = false,
}: InspectionTableProps) {
  const { formatSplitDateTime } = useDashboardSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedIdInternal, setSelectedIdInternal] = useState<number | undefined>()
  const splitMode = detailMode === 'split'
  const selectedId = splitMode ? selectedIdProp : selectedIdInternal
  const setSelectedId = splitMode
    ? (id: number | undefined) => onSelectId?.(id)
    : setSelectedIdInternal

  const filtered = resultFilter ? logs.filter((l) => l.result === resultFilter) : logs

  useEffect(() => {
    if (detailMode === 'route') return
    if (initialOpenLogId == null) return
    if (!filtered.some((l) => l.id === initialOpenLogId)) return
    setSelectedId(initialOpenLogId)
  }, [detailMode, initialOpenLogId, filtered, setSelectedId])

  const headers = splitMode
    ? ['', 'ID', '시각', '기종', '판정', '결함']
    : ['ID', '시각', '실크 OCR', '디바이스', '결과', '검출 클래스', '오차 (°)', '추론 (ms)', '']
  const colCount = headers.length

  return (
    <div
      className={clsx(
        'overflow-x-auto',
        !embedded && 'rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)]'
      )}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--dash-bg-secondary)] text-left">
            {headers.map((h) => (
              <th
                key={h || 'thumb'}
                className="px-2 py-2 text-[10px] font-semibold text-[var(--dash-text-tertiary)] uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--dash-border)]">
          {isLoading ? (
            <TableSkeleton cols={colCount} />
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-12 text-center text-sm text-[var(--dash-text-secondary)]">
                검사 이력이 없습니다.
              </td>
            </tr>
          ) : (
            filtered.map((log) => {
              const { date, time } = formatSplitDateTime(log.inspectedAt)
              const active = selectedId === log.id
              return (
                <Fragment key={log.id}>
                  <tr
                    className={clsx(
                      'cursor-pointer transition-colors',
                      active
                        ? 'bg-[var(--dash-accent)]/8 ring-1 ring-inset ring-[var(--dash-accent)]/35'
                        : 'hover:bg-[var(--dash-bg-secondary)]'
                    )}
                    onClick={() => {
                      if (detailMode === 'route') {
                        navigate(inspectionDetailPath(log.id), {
                          state: { returnTo: `${location.pathname}${location.search}` },
                        })
                        return
                      }
                      if (splitMode) {
                        setSelectedId(log.id)
                        return
                      }
                      setSelectedId(active ? undefined : log.id)
                    }}
                  >
                    {splitMode && (
                      <td className="px-2 py-2">
                        <InspectionThumbnail imagePath={log.imagePath} result={log.result} size={40} />
                      </td>
                    )}
                    <td className="px-2 py-2 dash-num text-xs text-[var(--dash-text-tertiary)] whitespace-nowrap">
                      {formatInspectionId(log.id)}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {splitMode ? (
                        <>
                          <span className="tabular-nums text-[var(--dash-text-primary)]">{time || date}</span>
                          {time && <span className="block text-[10px] text-[var(--dash-text-tertiary)]">{date}</span>}
                        </>
                      ) : (
                        <>
                          <p className="text-[var(--dash-text-secondary)]">{date}</p>
                          {time && <p className="text-[var(--dash-text-tertiary)] font-mono text-xs">{time}</p>}
                        </>
                      )}
                    </td>
                    {!splitMode && (
                      <td className="px-4 py-3">
                        <SilkOcrCell
                          silkBoardName={log.silkBoardName}
                          silkManufacturer={log.silkManufacturer}
                          silkManufactureDate={log.silkManufactureDate}
                        />
                      </td>
                    )}
                    <td className="px-2 py-2 text-xs text-[var(--dash-text-secondary)]">
                      {deviceDisplayLabel(log.deviceId)}
                    </td>
                    <td className="px-2 py-2">
                      <ResultBadge result={log.result} compact={splitMode} />
                    </td>
                    <td className="px-2 py-2 align-top max-w-[15rem]">
                      {splitMode ? (
                        <span className="text-xs text-[var(--dash-text-secondary)]">
                          {log.defects.length ? `${log.defects.length}건` : '—'}
                        </span>
                      ) : (
                        <DefectTags defects={log.defects} variant="table" />
                      )}
                    </td>
                    {!splitMode && (
                      <>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--dash-text-secondary)]">
                          {log.angleErrorDeg != null ? `${log.angleErrorDeg.toFixed(2)}°` : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--dash-text-secondary)]">
                          {log.inferenceTimeMs != null ? `${log.inferenceTimeMs}ms` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight size={16} className={active ? 'text-[var(--dash-accent)]' : 'text-[var(--dash-text-tertiary)]'} />
                        </td>
                      </>
                    )}
                  </tr>
                  {detailMode === 'inline' && active && selectedId != null && (
                    <tr>
                      <td colSpan={colCount} className="px-4 py-3 bg-[var(--dash-bg-secondary)]">
                        <DefectViewer inspectionId={selectedId} onClose={() => setSelectedId(undefined)} inline />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
