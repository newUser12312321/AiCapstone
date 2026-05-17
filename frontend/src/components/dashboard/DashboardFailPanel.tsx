import { Link } from 'react-router-dom'
import DashboardDefectPareto from '@/components/dashboard/DashboardDefectPareto'
import DashboardLatestFail from '@/components/dashboard/DashboardLatestFail'
import type { InspectionLog } from '@/types/inspection'
import { dashboardTodayHistoryPath } from '@/components/dashboard/DashboardKpiStrip'
import type { DefectParetoRow } from '@/utils/dashboardDefectSummary'

interface DashboardFailPanelProps {
  latestFail?: InspectionLog
  isLoadingFail: boolean
  defectPareto: DefectParetoRow[]
  formatSplitDateTime: (iso: string) => { date: string; time: string }
  onDefectSelect: (filterKey: string) => void
}

export default function DashboardFailPanel({
  latestFail,
  isLoadingFail,
  defectPareto,
  formatSplitDateTime,
  onDefectSelect,
}: DashboardFailPanelProps) {
  if (isLoadingFail) {
    return (
      <div className="hmi-panel h-16 animate-pulse bg-[var(--dash-bg-secondary)] shrink-0" />
    )
  }

  if (!latestFail && defectPareto.length === 0) {
    return (
      <div className="hmi-panel shrink-0 flex items-center justify-between gap-2 px-2 py-2 text-[11px] border-[var(--dash-border)]">
        <div className="text-[var(--dash-text-secondary)]">
          당일 <span className="font-bold text-[var(--dash-success)]">FAIL 0건</span>
        </div>
        <Link
          to={dashboardTodayHistoryPath('FAIL')}
          className="shrink-0 font-semibold text-[var(--dash-accent)] hover:underline"
        >
          FAIL 이력
        </Link>
      </div>
    )
  }

  const hasMissing = defectPareto.some((r) => r.kind === 'missing')

  return (
    <div className="flex flex-col gap-px min-h-0 shrink-0 max-h-[42%]">
      {latestFail ? (
        <DashboardLatestFail log={latestFail} formatSplitDateTime={formatSplitDateTime} />
      ) : (
        <div className="hmi-panel shrink-0 px-2 py-1.5 text-[11px] text-[var(--dash-text-secondary)]">
          당일 FAIL 0건
        </div>
      )}
      {defectPareto.length > 0 ? (
        <div className="min-h-[120px] max-h-[220px] flex flex-col">
          <DashboardDefectPareto
            items={defectPareto}
            onSelect={onDefectSelect}
            title={hasMissing ? 'FAIL 판정 원인' : 'FAIL 유형'}
            hint={hasMissing ? '누락·개수 불일치 판정 (검출 bbox와 구분)' : '당일 · 클릭→이력'}
          />
        </div>
      ) : latestFail ? (
        <div className="hmi-panel shrink-0 px-2 py-1.5 text-[10px] text-[var(--dash-text-tertiary)]">
          FAIL 유형 집계 없음
        </div>
      ) : null}
    </div>
  )
}
