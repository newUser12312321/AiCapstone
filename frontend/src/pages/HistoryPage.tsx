/**
 * 검사 이력 페이지
 *
 * 전체 검사 이력을 조회하고 날짜 기간 필터 및 결과(PASS/FAIL) 필터를 제공한다.
 *
 * 기능:
 * - 날짜 범위 선택 (from ~ to)
 * - 결과 필터 버튼 그룹 (전체 / PASS / FAIL)
 * - 총 건수 / 합격 / 불합격 미니 통계
 * - InspectionTable 렌더링 (행 클릭 → DefectViewer)
 */

import { useState, useMemo } from 'react'
import { Search, Filter, Download } from 'lucide-react'
import clsx from 'clsx'
import InspectionTable from '@/components/inspection/InspectionTable'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useAllInspections } from '@/hooks/useInspectionData'
import type { InspectionResultType } from '@/types/inspection'

// ── 결과 필터 버튼 ────────────────────────────────────────────────────────────

type ResultFilter = 'ALL' | InspectionResultType

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { formatFullDateTime, formatRatePercent } = useDashboardSettings()
  const { data: allLogs = [], isLoading } = useAllInspections()

  /* 결과 필터 상태 */
  const [resultFilter, setResultFilter] = useState<ResultFilter>('ALL')

  /* 날짜 범위 필터 상태 (YYYY-MM-DD 형식) */
  const today = getLocalDateString()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState(today)

  /* 필터 적용된 데이터 계산 (useMemo로 불필요한 재연산 방지) */
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      /* 결과 필터 */
      if (resultFilter !== 'ALL' && log.result !== resultFilter) return false

      /* 날짜 범위 필터 */
      const logDate = log.inspectedAt.slice(0, 10)
      if (dateFrom && logDate < dateFrom) return false
      if (dateTo   && logDate > dateTo)   return false

      return true
    })
  }, [allLogs, resultFilter, dateFrom, dateTo])

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

  /* 필터 결과 미니 통계 */
  const passCount = filteredLogs.filter((l) => l.result === 'PASS').length
  const failCount = filteredLogs.filter((l) => l.result === 'FAIL').length

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full bg-[var(--dash-bg-secondary)]">
      <div className="max-w-[1280px] mx-auto space-y-5">

        {/* 페이지 제목 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--dash-text-primary)]">검사 이력</h2>
            <p className="text-sm text-[var(--dash-text-secondary)] mt-0.5">전체 검사 기록 조회 및 결함 상세 확인</p>
          </div>

          {/* CSV 내보내기 버튼 */}
          <button
            onClick={downloadCsv}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--dash-surface)] hover:bg-[var(--dash-bg-secondary)] border border-[var(--dash-border)] text-[var(--dash-text-primary)] rounded-xl text-sm font-medium transition-colors shadow-[var(--dash-shadow-soft)]"
          >
            <Download size={15} />
            CSV 내보내기
          </button>
        </div>

        {/* 필터 영역 */}
        <div className="bg-[var(--dash-surface)] rounded-2xl border border-[var(--dash-border)] shadow-[var(--dash-shadow-soft)] p-4">
          <div className="flex flex-wrap gap-4 items-end">

          {/* 날짜 범위 필터 */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-[var(--dash-text-tertiary)] shrink-0" />
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--dash-text-tertiary)]">시작일</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
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
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom}
                  max={today}
                  className="bg-[var(--dash-surface)] border border-[var(--dash-border)] text-[var(--dash-text-primary)] text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
                />
              </div>
            </div>
          </div>

          {/* 결과 필터 버튼 그룹 */}
          <div className="flex items-center gap-2 ml-auto">
            <Search size={14} className="text-[var(--dash-text-tertiary)]" />
            <FilterButton label="전체"  value="ALL"  current={resultFilter} count={allLogs.length}                        onClick={setResultFilter} />
            <FilterButton label="PASS"  value="PASS" current={resultFilter} count={allLogs.filter(l => l.result==='PASS').length} onClick={setResultFilter} />
            <FilterButton label="FAIL"  value="FAIL" current={resultFilter} count={allLogs.filter(l => l.result==='FAIL').length} onClick={setResultFilter} />
          </div>
        </div>
      </div>

        {/* 필터 결과 미니 통계 바 */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--dash-text-secondary)]">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)]">
            조회 결과 <span className="text-[var(--dash-text-primary)] font-semibold">{filteredLogs.length}건</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)]">
            합격 <span className="text-[var(--dash-success)] font-semibold">{passCount}건</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)]">
            불합격 <span className="text-[var(--dash-danger)] font-semibold">{failCount}건</span>
          </span>
          {filteredLogs.length > 0 && (
          <span>
            불량률 <span className="text-[var(--dash-warning)] font-semibold">
              {formatRatePercent((failCount / filteredLogs.length) * 100)}%
            </span>
          </span>
          )}
        </div>

        {/* 검사 이력 테이블 */}
        <InspectionTable
          logs={filteredLogs}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
