import { Link } from 'react-router-dom'
import DashboardDefectPareto from '@/components/dashboard/DashboardDefectPareto'
import DashboardLatestFail from '@/components/dashboard/DashboardLatestFail'
import type { InspectionLog } from '@/types/inspection'
import { dashboardTodayHistoryPath } from '@/components/dashboard/DashboardKpiStrip'

interface DashboardFailPanelProps {
  latestFail?: InspectionLog
  isLoadingFail: boolean
  defectItems: [label: string, count: number][]
  formatSplitDateTime: (iso: string) => { date: string; time: string }
  onDefectSelect: (label: string) => void
}

export default function DashboardFailPanel({
  latestFail,
  isLoadingFail,
  defectItems,
  formatSplitDateTime,
  onDefectSelect,
}: DashboardFailPanelProps) {
  if (isLoadingFail) {
    return (
      <div className="hmi-panel h-16 animate-pulse bg-[var(--dash-bg-secondary)] shrink-0" />
    )
  }

  if (!latestFail && defectItems.length === 0) {
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

  return (
    <div className="flex flex-col gap-px min-h-0 shrink-0 max-h-[42%]">
      {latestFail ? (
        <DashboardLatestFail log={latestFail} formatSplitDateTime={formatSplitDateTime} />
      ) : (
        <div className="hmi-panel shrink-0 px-2 py-1.5 text-[11px] text-[var(--dash-text-secondary)]">
          당일 FAIL 0건
        </div>
      )}
      {defectItems.length > 0 ? (
        <div className="min-h-[120px] max-h-[220px] flex flex-col">
          <DashboardDefectPareto items={defectItems} onSelect={onDefectSelect} />
        </div>
      ) : latestFail ? (
        <div className="hmi-panel shrink-0 px-2 py-1.5 text-[10px] text-[var(--dash-text-tertiary)]">
          FAIL 유형 집계 없음
        </div>
      ) : null}
    </div>
  )
}
