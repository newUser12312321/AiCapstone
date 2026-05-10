/**
 * 검사 이력 테이블 컴포넌트
 *
 * 검사 이력 목록을 테이블로 표시하며, 행 클릭 시 DefectViewer를 열어
 * 바운딩박스 상세 정보를 확인할 수 있다.
 *
 * 기능:
 * - PASS/FAIL 뱃지 색상 구분
 * - 결함 종류 태그 (단선, 까짐 등)
 * - 각도 오차 표시
 * - 클릭으로 상세 DefectViewer 연동
 */

import { Fragment, useEffect, useState } from 'react'
import { ChevronRight, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import type { InspectionLog } from '@/types/inspection'
import { defectDisplayName, DEFECT_COLOR } from '@/types/inspection'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import DefectViewer from './DefectViewer'

// ── 보조 컴포넌트 ─────────────────────────────────────────────────────────────

/** PASS / FAIL 결과 뱃지 — 다크·라이트 테마 모두에서 채도 있는 대비 */
function ResultBadge({ result }: { result: 'PASS' | 'FAIL' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold tracking-wide',
        result === 'PASS'
          ? 'bg-[var(--dash-success)]/24 text-[var(--dash-success)] border-2 border-[var(--dash-success)]/70'
          : 'bg-[var(--dash-danger)]/26 text-[var(--dash-danger)] border-2 border-[var(--dash-danger)]/70'
      )}
    >
      {result}
    </span>
  )
}

/** 결함 종류 태그 목록 */
function DefectTags({ defects }: { defects: InspectionLog['defects'] }) {
  if (!defects.length) {
    return <span className="text-xs text-[var(--dash-text-tertiary)]">—</span>
  }

  const grouped = new Map<
    string,
    { count: number; color: string; label: string }
  >()
  defects.forEach((d) => {
    const key = `${d.defectType}\0${d.detail?.trim() ?? ''}`
    const label = defectDisplayName(d.defectType, d.detail)
    const prev = grouped.get(key)
    if (prev) {
      prev.count += 1
      return
    }
    grouped.set(key, {
      count: 1,
      color: DEFECT_COLOR[d.defectType] ?? '#9ca3af',
      label,
    })
  })

  return (
    <div className="flex flex-wrap gap-1">
      {Array.from(grouped.entries()).map(([tagKey, meta]) => (
        <span
          key={tagKey}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: `${meta.color}22`,
            color: meta.color,
          }}
        >
          <AlertCircle size={10} />
          {`${meta.label} X${meta.count}`}
        </span>
      ))}
    </div>
  )
}

// ── 스켈레톤 ─────────────────────────────────────────────────────────────────

/** 실크 OCR 요약 한 컬럼 */
function SilkOcrCell({
  silkSeriesName,
  silkBoardName,
  silkManufacturer,
  silkManufactureDate,
}: Pick<
  InspectionLog,
  'silkSeriesName' | 'silkBoardName' | 'silkManufacturer' | 'silkManufactureDate'
>) {
  const lines = [
    silkSeriesName ? `시리즈: ${silkSeriesName}` : null,
    silkBoardName ? `기판: ${silkBoardName}` : null,
    silkManufacturer ? `제조사: ${silkManufacturer}` : null,
    silkManufactureDate ? `제조일: ${silkManufactureDate}` : null,
  ].filter(Boolean)
  if (lines.length === 0) {
    return <span className="text-xs text-[var(--dash-text-tertiary)]">—</span>
  }
  return (
    <div className="text-xs text-[var(--dash-text-secondary)] space-y-0.5 leading-snug">
      {lines.map((line, idx) => (
        <div key={idx}>{line}</div>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-[var(--dash-border)] animate-pulse">
          {Array.from({ length: 9 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3.5 bg-[var(--dash-bg-secondary)] rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

interface InspectionTableProps {
  /** 표시할 검사 이력 데이터 */
  logs: InspectionLog[]
  /** 데이터 로딩 중 여부 */
  isLoading?: boolean
  /** 결과 필터 (undefined이면 전체 표시) */
  resultFilter?: 'PASS' | 'FAIL' | undefined
  /** URL·대시보드 연동: 마운트 시 해당 행 상세를 연다 */
  initialOpenLogId?: number | null
}

export default function InspectionTable({
  logs,
  isLoading = false,
  resultFilter,
  initialOpenLogId,
}: InspectionTableProps) {
  const { formatSplitDateTime } = useDashboardSettings()
  /* 클릭된 검사 ID — DefectViewer에 전달 */
  const [selectedId, setSelectedId] = useState<number | undefined>()

  /* 결과 필터 적용 */
  const filtered = resultFilter
    ? logs.filter((l) => l.result === resultFilter)
    : logs

  useEffect(() => {
    if (initialOpenLogId == null) return
    if (!filtered.some((l) => l.id === initialOpenLogId)) return
    setSelectedId(initialOpenLogId)
  }, [initialOpenLogId, filtered])

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[var(--dash-shadow-soft)]">
        <table className="w-full text-sm">
          {/* 헤더 */}
          <thead>
            <tr className="bg-[var(--dash-bg-secondary)] text-left">
              {['ID', '시각', '실크 OCR', '디바이스', '결과', '검출 클래스', '오차 (°)', '추론 (ms)', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3.5 text-xs font-semibold text-[var(--dash-text-tertiary)] uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          {/* 바디 */}
          <tbody className="divide-y divide-[var(--dash-border)]">
            {isLoading ? (
              <TableSkeleton />
            ) : filtered.length === 0 ? (
              /* 데이터 없음 */
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-[var(--dash-text-secondary)] text-sm">
                  검사 이력이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((log) => {
                const { date, time } = formatSplitDateTime(log.inspectedAt)
                return (
                  <Fragment key={log.id}>
                    <tr
                      className={clsx(
                        'bg-[var(--dash-surface)] hover:bg-[var(--dash-bg-secondary)] cursor-pointer transition-colors',
                        /* 선택된 행: 인디고 좌측 테두리 강조 */
                        selectedId === log.id && 'ring-1 ring-inset ring-[var(--dash-accent)]/40'
                      )}
                      onClick={() => setSelectedId((prev) => (prev === log.id ? undefined : log.id))}
                    >
                      {/* ID */}
                      <td className="px-4 py-3 font-mono text-[13px] text-[var(--dash-text-tertiary)]">
                        #{log.id}
                      </td>

                      {/* 시각 */}
                      <td className="px-4 py-3">
                        <p className="text-[var(--dash-text-secondary)] text-[13px]">{date}</p>
                        {time ? (
                          <p className="text-[var(--dash-text-tertiary)] text-xs font-mono">{time}</p>
                        ) : null}
                      </td>

                      {/* 실크 OCR */}
                      <td className="px-4 py-3 align-top">
                        <SilkOcrCell
                          silkSeriesName={log.silkSeriesName}
                          silkBoardName={log.silkBoardName}
                          silkManufacturer={log.silkManufacturer}
                          silkManufactureDate={log.silkManufactureDate}
                        />
                      </td>

                      {/* 디바이스 */}
                      <td className="px-4 py-3 text-[13px] text-[var(--dash-text-secondary)] font-mono">
                        {log.deviceId}
                      </td>

                      {/* 결과 뱃지 */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <ResultBadge result={log.result} />
                          {log.result === 'FAIL' &&
                            log.defects.some((d) => d.defectType === 'SILK_SCREEN_PRINT_DEFECT') && (
                              <span className="text-[10px] font-semibold text-[var(--dash-warning)]">
                                실크인쇄불량
                              </span>
                            )}
                        </div>
                      </td>

                      {/* 결함 태그 */}
                      <td className="px-4 py-3">
                        <DefectTags defects={log.defects} />
                      </td>

                      {/* 오차 각도 */}
                      <td className="px-4 py-3 text-[13px] text-[var(--dash-text-secondary)] font-mono">
                        {log.angleErrorDeg != null
                          ? `${log.angleErrorDeg.toFixed(2)}°`
                          : '—'}
                      </td>

                      {/* 추론 시간 */}
                      <td className="px-4 py-3 text-[13px] text-[var(--dash-text-secondary)] font-mono">
                        {log.inferenceTimeMs != null ? `${log.inferenceTimeMs}ms` : '—'}
                      </td>

                      {/* 상세 버튼 */}
                      <td className="px-4 py-3">
                        <ChevronRight
                          size={16}
                          className={clsx(
                            'transition-colors',
                            selectedId === log.id ? 'text-[var(--dash-accent)]' : 'text-[var(--dash-text-tertiary)]'
                          )}
                        />
                      </td>
                    </tr>
                    {selectedId === log.id && (
                      <tr key={`detail-${log.id}`} className="bg-[var(--dash-bg-primary)]">
                        <td colSpan={9} className="px-4 py-3">
                          <DefectViewer
                            inspectionId={selectedId}
                            onClose={() => setSelectedId(undefined)}
                            inline
                          />
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

    </>
  )
}
