import { Link } from 'react-router-dom'
import DashboardDefectPareto from '@/components/dashboard/DashboardDefectPareto'
import DashboardLatestFail from '@/components/dashboard/DashboardLatestFail'
import type { InspectionLog } from '@/types/inspection'
import { dashboardTodayHistoryPath } from '@/components/dashboard/DashboardKpiStrip'
import type { DefectParetoRow } from '@/utils/dashboardDefectSummary'
import { primaryFailReason } from '@/utils/dashboardDefectSummary'

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

  const failReason = latestFail ? primaryFailReason(latestFail) : null
  const showPareto =
    defectPareto.length > 0 &&
    !(
      latestFail &&
      defectPareto.length === 1 &&
      failReason &&
      defectPareto[0].label === failReason
    )

  return (
    <div className="flex flex-col gap-px min-h-0 shrink-0 max-h-[42%]">
      {latestFail ? (
        <DashboardLatestFail log={latestFail} formatSplitDateTime={formatSplitDateTime} />
      ) : (
        <div className="hmi-panel shrink-0 px-2 py-1.5 text-[11px] text-[var(--dash-text-secondary)]">
          당일 FAIL 0건
        </div>
      )}
      {showPareto ? (
        <div className="min-h-[120px] max-h-[220px] flex flex-col">
          <DashboardDefectPareto
            items={defectPareto}
            onSelect={onDefectSelect}
            title="FAIL 유형"
            hint="당일 · 클릭→이력"
          />
        </div>
      ) : null}
    </div>
  )
}
