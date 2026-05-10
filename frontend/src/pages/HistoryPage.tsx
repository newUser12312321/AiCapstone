/**
 * 검사 이력 페이지
 *
 * 전체 검사 이력을 조회하고 날짜 기간 필터 및 결과(정상/불량, URL은 PASS/FAIL) 필터를 제공한다.
 * 쿼리스트링(from, to, result, device, board, defect, hour, open)으로 대시보드·차트와 연동한다.
 */

import { useMemo, useCallback, useEffect } from 'react'
import { Search, Filter, Download } from 'lucide-react'
import clsx from 'clsx'
import { useNavigate, useSearchParams } from 'react-router-dom'
import InspectionTable from '@/components/inspection/InspectionTable'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useAllInspections } from '@/hooks/useInspectionData'
import type { InspectionResultType } from '@/types/inspection'
import {
  buildHistoryPath,
  buildHistorySearchString,
  getLocalDateString,
  inspectionDetailPath,
  parseHistoryQuery,
  type HistoryQuery,
} from '@/utils/historyNavigation'
import { logMatchesDefectDisplayLabel } from '@/utils/inspectionFilters'

// ── 결과 필터 버튼 ────────────────────────────────────────────────────────────

type ResultFilter = 'ALL' | InspectionResultType

interface FilterButtonProps {
  label:    string
  value:    ResultFilter
  current:  ResultFilter
  count:    number
  onClick:  (v: ResultFilter) => void
}

function FilterButton({ label, value, current, count, onClick }: FilterButtonProps) {
  const active = value === current
  return (
    <button
      onClick={() => onClick(value)}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
        active
          ? 'bg-[var(--dash-accent)] text-white'
          : 'bg-[var(--dash-surface)] border border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] hover:bg-[var(--dash-bg-secondary)]'
      )}
    >
      {label}
      <span className={clsx(
        'px-1.5 py-0.5 rounded-full text-xs',
        active ? 'bg-white/20' : 'bg-[var(--dash-bg-secondary)]'
      )}>
        {count}
      </span>
    </button>
  )
}

function logHour(iso: string, timeZoneMode: 'local' | 'utc'): number {
  const d = new Date(iso)
  return timeZoneMode === 'utc' ? d.getUTCHours() : d.getHours()
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { formatFullDateTime, formatRatePercent, settings } = useDashboardSettings()
  const { data: allLogs = [], isLoading } = useAllInspections()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const today = getLocalDateString()
  const q = useMemo(() => parseHistoryQuery(searchParams), [searchParams])

  const dateFrom = q.from ?? ''
  const dateTo = q.to !== undefined && q.to !== '' ? q.to : today

  const patchQuery = useCallback(
    (patch: Partial<HistoryQuery>) => {
      setSearchParams(
        (prev) => {
          const current = parseHistoryQuery(prev)
          const merged: HistoryQuery = { ...current, ...patch }
          if (merged.result === 'ALL') {
            delete merged.result
          }
          const s = buildHistorySearchString(merged)
          return s ? new URLSearchParams(s) : new URLSearchParams()
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const deviceOptions = useMemo(() => {
    const s = new Set<string>()
    allLogs.forEach((l) => {
      if (l.deviceId) s.add(l.deviceId)
    })
    return Array.from(s).sort()
  }, [allLogs])

  const boardOptions = useMemo(() => {
    const s = new Set<string>()
    allLogs.forEach((l) => {
      const b = (l.silkBoardName ?? '').trim()
      if (b) s.add(b)
    })
    return Array.from(s).sort()
  }, [allLogs])

  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      if (q.result && q.result !== 'ALL' && log.result !== q.result) return false

      const logDate = log.inspectedAt.slice(0, 10)
      if (dateFrom && logDate < dateFrom) return false
      if (dateTo && logDate > dateTo) return false

      if (q.device && log.deviceId !== q.device) return false
      if (q.board && (log.silkBoardName ?? '').trim() !== q.board) return false

      if (q.hour != null && logHour(log.inspectedAt, settings.timeZoneMode) !== q.hour) {
        return false
      }

      if (q.defect && !logMatchesDefectDisplayLabel(log, q.defect)) return false

      return true
    })
  }, [allLogs, q, dateFrom, dateTo, settings.timeZoneMode])

  const resultFilter: ResultFilter = q.result ?? 'ALL'

  /* `?open=` 딥링크 → 상세 페이지로 이동(닫기 시 동일 필터의 이력으로 복귀) */
  useEffect(() => {
    const parsed = parseHistoryQuery(searchParams)
    if (parsed.open == null) return
    if (!filteredLogs.some((l) => l.id === parsed.open)) return
    const returnTo = buildHistoryPath({ ...parsed, open: undefined })
    navigate(inspectionDetailPath(parsed.open), { replace: true, state: { returnTo } })
  }, [searchParams, filteredLogs, navigate])

  const downloadCsv = () => {
    if (!filteredLogs.length) return

    const header = ['ID', '시각', '디바이스', '결과', '오차(°)', '추론(ms)', '총처리(ms)', '결함수']
    const rows = filteredLogs.map((l) => [
      l.id,
      formatFullDateTime(l.inspectedAt),
      l.deviceId,
      l.result,
      l.angleErrorDeg?.toFixed(2) ?? '',
      l.inferenceTimeMs ?? '',
      l.totalTimeMs ?? '',
      l.defects.length,
    ])

    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `inspection_history_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const passCount = filteredLogs.filter((l) => l.result === 'PASS').length
  const failCount = filteredLogs.filter((l) => l.result === 'FAIL').length

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full bg-[var(--dash-bg-secondary)]">
      <div className="max-w-[1280px] mx-auto space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--dash-text-primary)]">검사 이력</h2>
            <p className="text-sm text-[var(--dash-text-secondary)] mt-0.5">전체 검사 기록 조회 및 결함 상세 확인</p>
          </div>

          <button
            onClick={downloadCsv}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--dash-surface)] hover:bg-[var(--dash-bg-secondary)] border border-[var(--dash-border)] text-[var(--dash-text-primary)] rounded-xl text-sm font-medium transition-colors shadow-[var(--dash-shadow-soft)]"
          >
            <Download size={15} />
            CSV 내보내기
          </button>
        </div>

        <div className="bg-[var(--dash-surface)] rounded-2xl border border-[var(--dash-border)] shadow-[var(--dash-shadow-soft)] p-4">
          <div className="flex flex-wrap gap-4 items-end">

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-[var(--dash-text-tertiary)] shrink-0" />
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--dash-text-tertiary)]">시작일</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => patchQuery({ from: e.target.value || undefined })}
                  max={dateTo || today}
                  className="bg-[var(--dash-surface)] border border-[var(--dash-border)] text-[var(--dash-text-primary)] text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
                />
              </div>
              <span className="text-[var(--dash-text-tertiary)] text-sm mt-4">~</span>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--dash-text-tertiary)]">종료일</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => patchQuery({ to: e.target.value || undefined })}
                  min={dateFrom}
                  max={today}
                  className="bg-[var(--dash-surface)] border border-[var(--dash-border)] text-[var(--dash-text-primary)] text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--dash-text-tertiary)]">디바이스</label>
              <select
                value={q.device ?? ''}
                onChange={(e) =>
                  patchQuery({ device: e.target.value || undefined, open: undefined })
                }
                className="min-w-[140px] rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm text-[var(--dash-text-primary)]"
              >
                <option value="">전체</option>
                {deviceOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--dash-text-tertiary)]">기판명(실크)</label>
              <select
                value={q.board ?? ''}
                onChange={(e) =>
                  patchQuery({ board: e.target.value || undefined, open: undefined })
                }
                className="min-w-[160px] rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm text-[var(--dash-text-primary)]"
              >
                <option value="">전체</option>
                {boardOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            {q.hour != null && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--dash-text-tertiary)]">시간대 필터</label>
                <button
                  type="button"
                  onClick={() => patchQuery({ hour: undefined, open: undefined })}
                  className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-2 text-xs text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]"
                >
                  {String(q.hour).padStart(2, '0')}:00 해제
                </button>
              </div>
            )}
            {q.defect && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--dash-text-tertiary)]">결함 필터</label>
                <button
                  type="button"
                  onClick={() => patchQuery({ defect: undefined, open: undefined })}
                  className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-2 text-xs text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] max-w-[220px] truncate"
                  title={q.defect}
                >
                  「{q.defect}」 해제
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Search size={14} className="text-[var(--dash-text-tertiary)]" />
            <FilterButton
              label="전체"
              value="ALL"
              current={resultFilter}
              count={allLogs.length}
              onClick={(v) => patchQuery({ result: v, open: undefined })}
            />
            <FilterButton
              label="정상"
              value="PASS"
              current={resultFilter}
              count={allLogs.filter((l) => l.result === 'PASS').length}
              onClick={(v) => patchQuery({ result: v, open: undefined })}
            />
            <FilterButton
              label="불량"
              value="FAIL"
              current={resultFilter}
              count={allLogs.filter((l) => l.result === 'FAIL').length}
              onClick={(v) => patchQuery({ result: v, open: undefined })}
            />
          </div>
        </div>
      </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--dash-text-secondary)]">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)]">
            조회 결과 <span className="text-[var(--dash-text-primary)] font-semibold">{filteredLogs.length}건</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)]">
            정상 <span className="text-[var(--dash-success)] font-semibold">{passCount}건</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)]">
            불량 <span className="text-[var(--dash-danger)] font-semibold">{failCount}건</span>
          </span>
          {filteredLogs.length > 0 && (
          <span>
            불량률 <span className="text-[var(--dash-warning)] font-semibold">
              {formatRatePercent((failCount / filteredLogs.length) * 100)}%
            </span>
          </span>
          )}
        </div>

        <InspectionTable logs={filteredLogs} isLoading={isLoading} />
      </div>
    </div>
  )
}
