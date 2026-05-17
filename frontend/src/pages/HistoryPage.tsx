/**
 * 검사 로그 — 서버 페이지 목록, 행 클릭 시 /inspection/:id 상세
 */

import { useMemo, useCallback, useEffect } from 'react'
import { Download, FileSpreadsheet, Filter } from 'lucide-react'
import clsx from 'clsx'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DeviceFilterTabs from '@/components/common/DeviceFilterTabs'
import FilterSummaryStrip from '@/components/dashboard/FilterSummaryStrip'
import InspectionTable from '@/components/inspection/InspectionTable'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useDefectSummary, useFacets, useInspectionSearch, useStats } from '@/hooks/useInspectionData'
import { type InspectionResultType, type WorkShift } from '@/types/inspection'
import {
  buildHistorySearchString,
  getLocalDateString,
  inspectionDetailPath,
  parseHistoryQuery,
  buildHistoryPath,
  type HistoryQuery,
} from '@/utils/historyNavigation'
import { historyToSearchParams, shiftLabel } from '@/utils/inspectionSearchParams'
import { logMatchesDefectDisplayLabel } from '@/utils/inspectionFilters'
import { downloadDailyReportCsv, downloadInspectionCsv } from '@/utils/csvReport'

type ResultFilter = 'ALL' | InspectionResultType

const PAGE_SIZE = 50

function FilterButton({
  label,
  value,
  current,
  count,
  onClick,
}: {
  label: string
  value: ResultFilter
  current: ResultFilter
  count: number
  onClick: (v: ResultFilter) => void
}) {
  const active = value === current
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors',
        active
          ? 'bg-[var(--dash-accent)] text-white border-[var(--dash-accent)]'
          : 'bg-[var(--dash-surface)] border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-secondary)]'
      )}
    >
      {label}
      <span className={clsx('px-1.5 py-0.5 rounded text-[10px]', active ? 'bg-white/20' : 'bg-[var(--dash-bg-secondary)]')}>
        {count}
      </span>
    </button>
  )
}

function logHour(iso: string, timeZoneMode: 'local' | 'utc'): number {
  const d = new Date(iso)
  return timeZoneMode === 'utc' ? d.getUTCHours() : d.getHours()
}

export default function HistoryPage() {
  const { formatFullDateTime, formatRatePercent, settings } = useDashboardSettings()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const today = getLocalDateString()
  const q = useMemo(() => parseHistoryQuery(searchParams), [searchParams])

  const dateFrom = q.from ?? ''
  const dateTo = q.to !== undefined && q.to !== '' ? q.to : today
  const page = q.page ?? 0
  const openId = q.open

  const baseFilter = useMemo(
    () => ({
      from: dateFrom || today,
      to: dateTo,
      deviceId: q.device,
      board: q.board,
      shift: q.shift,
    }),
    [dateFrom, dateTo, today, q.device, q.board, q.shift]
  )

  const searchParamsApi = useMemo(
    () =>
      historyToSearchParams(
        { ...q, from: dateFrom || today, to: dateTo, page },
        { page, size: PAGE_SIZE }
      ),
    [q, dateFrom, dateTo, page]
  )

  const { data: pageData, isLoading } = useInspectionSearch(searchParamsApi)
  const { data: rangeStats } = useStats(baseFilter)
  const { data: passStats } = useStats({ ...baseFilter, result: 'PASS' })
  const { data: failStats } = useStats({ ...baseFilter, result: 'FAIL' })
  const { data: facets } = useFacets()
  const { data: defectSummary = [] } = useDefectSummary({
    ...baseFilter,
    result: 'FAIL',
  })

  const patchQuery = useCallback(
    (patch: Partial<HistoryQuery>) => {
      setSearchParams(
        (prev) => {
          const current = parseHistoryQuery(prev)
          const merged: HistoryQuery = { ...current, ...patch }
          if (merged.result === 'ALL') delete merged.result
          if (
            patch.page === undefined &&
            (patch.from || patch.to || patch.device || patch.board || patch.result || patch.shift)
          ) {
            merged.page = 0
          }
          const s = buildHistorySearchString(merged)
          return s ? new URLSearchParams(s) : new URLSearchParams()
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const filteredLogs = useMemo(() => {
    const rows = pageData?.content ?? []
    return rows.filter((log) => {
      if (q.hour != null && logHour(log.inspectedAt, settings.timeZoneMode) !== q.hour) return false
      if (q.defect && !logMatchesDefectDisplayLabel(log, q.defect)) return false
      return true
    })
  }, [pageData, q.hour, q.defect, settings.timeZoneMode])

  const resultFilter: ResultFilter = q.result ?? 'ALL'

  /** ?open=ID — FAIL 링크 등에서 전체 폭 상세 페이지로 이동 */
  useEffect(() => {
    if (openId == null) return
    const returnTo = buildHistoryPath({ ...parseHistoryQuery(searchParams), open: undefined })
    patchQuery({ open: undefined })
    navigate(inspectionDetailPath(openId), { state: { returnTo }, replace: true })
  }, [openId, navigate, patchQuery, searchParams])

  const downloadCsv = () => {
    downloadInspectionCsv(
      filteredLogs,
      `inspection_log_${dateTo}_p${page + 1}.csv`,
      formatFullDateTime
    )
  }

  const downloadReport = () => {
    if (!rangeStats) return
    downloadDailyReportCsv({
      dateFrom: dateFrom || today,
      dateTo,
      stats: rangeStats,
      defectRows: defectSummary,
      logs: filteredLogs,
      formatFullDateTime,
    })
  }

  const presetToday = () => patchQuery({ from: today, to: today, open: undefined, page: 0 })
  const presetWeek = () => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    patchQuery({ from: d.toISOString().slice(0, 10), to: today, open: undefined, page: 0 })
  }

  const totalPages = pageData?.totalPages ?? 0
  const totalElements = pageData?.totalElements ?? 0

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--dash-bg-secondary)]">
      <div className="shrink-0 border-b border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold text-[var(--dash-text-primary)]">검사 로그</h1>
          <p className="text-xs text-[var(--dash-text-tertiary)]">
            서버 페이지 ({totalElements.toLocaleString()}건) · 행 클릭 시 검사 상세
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={downloadReport}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] hover:bg-[var(--dash-bg-secondary)]"
          >
            <FileSpreadsheet size={14} />
            품질 리포트
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] hover:bg-[var(--dash-bg-secondary)]"
          >
            <Download size={14} />
            CSV
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <FilterSummaryStrip
          stats={rangeStats}
          title="조회 구간 요약"
          subtitle={`${dateFrom || '—'} ~ ${dateTo}`}
          formatRate={formatRatePercent}
          targetYieldPct={settings.targetYieldPct}
        />

        <div className="border border-[var(--dash-border)] bg-[var(--dash-surface)] rounded-lg p-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-[var(--dash-text-tertiary)]" />
              <button type="button" onClick={presetToday} className="text-xs px-2 py-1 rounded border border-[var(--dash-border)] hover:bg-[var(--dash-bg-secondary)]">
                오늘
              </button>
              <button type="button" onClick={presetWeek} className="text-xs px-2 py-1 rounded border border-[var(--dash-border)] hover:bg-[var(--dash-bg-secondary)]">
                최근 7일
              </button>
              <button
                type="button"
                onClick={() => patchQuery({ from: dateFrom || today, to: dateTo, result: 'FAIL', open: undefined, page: 0 })}
                className="text-xs px-2 py-1 rounded border border-[var(--dash-danger)]/40 text-[var(--dash-danger)] hover:bg-[var(--dash-danger)]/8"
              >
                FAIL만
              </button>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="text-xs text-[var(--dash-text-tertiary)] flex flex-col gap-1">
                시작
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => patchQuery({ from: e.target.value || undefined, open: undefined })}
                  max={dateTo || today}
                  className="rounded border border-[var(--dash-border)] px-2 py-1.5 text-sm bg-[var(--dash-surface)]"
                />
              </label>
              <label className="text-xs text-[var(--dash-text-tertiary)] flex flex-col gap-1">
                종료
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => patchQuery({ to: e.target.value || undefined, open: undefined })}
                  min={dateFrom}
                  max={today}
                  className="rounded border border-[var(--dash-border)] px-2 py-1.5 text-sm bg-[var(--dash-surface)]"
                />
              </label>
              <label className="text-xs text-[var(--dash-text-tertiary)] flex flex-col gap-1">
                교대
                <select
                  value={q.shift ?? ''}
                  onChange={(e) =>
                    patchQuery({
                      shift: (e.target.value as WorkShift) || undefined,
                      open: undefined,
                    })
                  }
                  className="min-w-[130px] rounded border border-[var(--dash-border)] px-2 py-1.5 text-sm bg-[var(--dash-surface)]"
                >
                  <option value="">전체</option>
                  <option value="DAY">{shiftLabel('DAY')}</option>
                  <option value="SWING">{shiftLabel('SWING')}</option>
                  <option value="NIGHT">{shiftLabel('NIGHT')}</option>
                </select>
              </label>
              <label className="text-xs text-[var(--dash-text-tertiary)] flex flex-col gap-1">
                기종
                <select
                  value={q.device ?? ''}
                  onChange={(e) => patchQuery({ device: e.target.value || undefined, open: undefined })}
                  className="min-w-[120px] rounded border border-[var(--dash-border)] px-2 py-1.5 text-sm bg-[var(--dash-surface)]"
                >
                  <option value="">전체</option>
                  {(facets?.deviceIds ?? []).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[var(--dash-text-tertiary)] flex flex-col gap-1">
                보드
                <select
                  value={q.board ?? ''}
                  onChange={(e) => patchQuery({ board: e.target.value || undefined, open: undefined })}
                  className="min-w-[120px] rounded border border-[var(--dash-border)] px-2 py-1.5 text-sm bg-[var(--dash-surface)]"
                >
                  <option value="">전체</option>
                  {(facets?.boardNames ?? []).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5 ml-auto">
              <FilterButton label="전체" value="ALL" current={resultFilter} count={rangeStats?.totalCount ?? 0} onClick={(v) => patchQuery({ result: v, open: undefined })} />
              <FilterButton label="PASS" value="PASS" current={resultFilter} count={passStats?.totalCount ?? 0} onClick={(v) => patchQuery({ result: v, open: undefined })} />
              <FilterButton label="FAIL" value="FAIL" current={resultFilter} count={failStats?.totalCount ?? 0} onClick={(v) => patchQuery({ result: v, open: undefined })} />
            </div>
          </div>
          <DeviceFilterTabs
            devices={facets?.deviceIds}
            value={q.device ?? ''}
            onChange={(device) => patchQuery({ device: device || undefined, open: undefined })}
          />
        </div>

        <div className="flex flex-col min-h-[480px] border border-[var(--dash-border)] rounded-lg overflow-hidden bg-[var(--dash-surface)]">
          <div className="flex-1 min-h-[320px] lg:max-h-[calc(100vh-280px)] overflow-x-auto overflow-y-auto">
            <InspectionTable logs={filteredLogs} isLoading={isLoading} detailMode="route" embedded />
          </div>
          {totalPages > 1 && (
            <div className="shrink-0 flex items-center justify-between gap-2 border-t border-[var(--dash-border)] px-3 py-2 text-xs">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => patchQuery({ page: page - 1 })}
                className="px-2 py-1 rounded border border-[var(--dash-border)] disabled:opacity-40"
              >
                이전
              </button>
              <span className="text-[var(--dash-text-tertiary)] tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => patchQuery({ page: page + 1 })}
                className="px-2 py-1 rounded border border-[var(--dash-border)] disabled:opacity-40"
              >
                다음
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
