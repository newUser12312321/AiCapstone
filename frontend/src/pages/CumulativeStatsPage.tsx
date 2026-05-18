import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DeviceFilterTabs from '@/components/common/DeviceFilterTabs'
import CumulativeKpiStrip from '@/components/cumulative/CumulativeKpiStrip'
import CumulativePassFailChart from '@/components/cumulative/CumulativePassFailChart'
import CumulativePeriodTabs from '@/components/cumulative/CumulativePeriodTabs'
import DailyVolumeChart from '@/components/cumulative/DailyVolumeChart'
import DailyYieldChart from '@/components/cumulative/DailyYieldChart'
import DeviceVolumeChart from '@/components/cumulative/DeviceVolumeChart'
import DashboardDefectPareto from '@/components/dashboard/DashboardDefectPareto'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useDailySummary, useDefectSummary, useFacets, useStats } from '@/hooks/useInspectionData'
import {
  cumulativePeriodLabel,
  cumulativePeriodRange,
  type CumulativePeriod,
} from '@/utils/cumulativePeriod'
import { buildHistoryPath } from '@/utils/historyNavigation'
import { defectParetoFromApiCounts } from '@/utils/dashboardDefectSummary'

export default function CumulativeStatsPage() {
  const { settings, formatRatePercent } = useDashboardSettings()
  const navigate = useNavigate()
  const [period, setPeriod] = useState<CumulativePeriod>('30d')
  const [deviceFilter, setDeviceFilter] = useState('')

  const range = useMemo(() => cumulativePeriodRange(period), [period])
  const periodLabel = cumulativePeriodLabel(period)

  const queryParams = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      deviceId: deviceFilter || undefined,
    }),
    [range.from, range.to, deviceFilter]
  )

  const { data: stats, isLoading: statsLoading } = useStats(queryParams)
  const { data: daily = [], isLoading: dailyLoading } = useDailySummary(queryParams)
  const { data: facets, isLoading: facetsLoading } = useFacets()
  const { data: defectItems = [] } = useDefectSummary(
    { ...queryParams, result: 'FAIL' },
    8
  )

  const defectPareto = useMemo(() => defectParetoFromApiCounts(defectItems), [defectItems])

  const deviceIdsForChart = useMemo(() => {
    if (deviceFilter) return [deviceFilter]
    return facets?.deviceIds ?? []
  }, [deviceFilter, facets?.deviceIds])

  const goDefectHistory = (filterKey: string) => {
    navigate(
      buildHistoryPath({
        from: range.from,
        to: range.to,
        result: 'FAIL',
        defect: filterKey,
        device: deviceFilter || undefined,
      })
    )
  }

  return (
    <div className="dashboard-hmi flex h-full min-h-0 flex-col gap-px p-px overflow-hidden bg-[var(--dash-border)]">
      <div className="shrink-0 flex flex-wrap items-stretch gap-px bg-[var(--dash-border)]">
        <CumulativePeriodTabs value={period} onChange={setPeriod} />
        <div className="flex flex-wrap items-center gap-px px-2 py-1 bg-[var(--dash-surface)] border border-[var(--dash-border)] flex-1 min-w-[200px]">
          <DeviceFilterTabs
            devices={facets?.deviceIds}
            value={deviceFilter}
            onChange={setDeviceFilter}
          />
        </div>
      </div>

      <CumulativeKpiStrip
        stats={stats}
        isLoading={statsLoading}
        targetYieldPct={settings.targetYieldPct}
        formatRate={formatRatePercent}
        periodLabel={periodLabel}
      />

      <div className="flex flex-1 min-h-0 gap-px">
        {/* 좌: 시계열 차트(고정 높이) + FAIL 유형 */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-px">
          <div className="shrink-0 h-[136px]">
            <DailyVolumeChart
              data={daily}
              isLoading={dailyLoading}
              deviceId={deviceFilter || undefined}
              compact
            />
          </div>
          <div className="shrink-0 h-[168px]">
            <DailyYieldChart
              data={daily}
              isLoading={dailyLoading}
              targetYieldPct={settings.targetYieldPct}
              compact
            />
          </div>
          <div className="flex-1 min-h-[100px]">
            <DashboardDefectPareto
              items={defectPareto}
              onSelect={goDefectHistory}
              title="FAIL 유형 (누적)"
              hint={`${periodLabel} · 클릭→이력`}
            />
          </div>
        </div>

        {/* 우: 비율·기종 — 좌측과 비슷한 높이로 2등분 */}
        <div className="w-[min(36%,320px)] min-w-[260px] shrink-0 flex flex-col gap-px min-h-0">
          <div className="flex-1 min-h-0">
            <CumulativePassFailChart
              stats={stats}
              isLoading={statsLoading}
              from={range.from}
              to={range.to}
              deviceId={deviceFilter || undefined}
            />
          </div>
          <div className="flex-1 min-h-0">
            <DeviceVolumeChart
              deviceIds={deviceIdsForChart}
              from={range.from}
              to={range.to}
              isLoadingFacets={facetsLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
