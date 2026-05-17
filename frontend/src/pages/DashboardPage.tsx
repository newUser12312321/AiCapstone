import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DeviceFilterTabs from '@/components/common/DeviceFilterTabs'
import DashboardDefectPareto from '@/components/dashboard/DashboardDefectPareto'
import DashboardKpiStrip, { dashboardTodayHistoryPath } from '@/components/dashboard/DashboardKpiStrip'
import DashboardLatestFail from '@/components/dashboard/DashboardLatestFail'
import DashboardLineStatus from '@/components/dashboard/DashboardLineStatus'
import DashboardRecentFeed from '@/components/dashboard/DashboardRecentFeed'
import HourlyInspectionVolumeChart from '@/components/dashboard/HourlyInspectionVolumeChart'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import {
  useDefectSummary,
  useFacets,
  useInspectionSearch,
  useLineStatus,
  useRecentInspections,
  useStats,
} from '@/hooks/useInspectionData'
import { buildHistoryPath, getLocalDateString } from '@/utils/historyNavigation'
import { useDashboardAlerts } from '@/hooks/useDashboardAlerts'

export default function DashboardPage() {
  const { settings, formatSplitDateTime, formatRatePercent } = useDashboardSettings()
  const navigate = useNavigate()
  const alerts = useDashboardAlerts()
  const [deviceFilter, setDeviceFilter] = useState('')
  const today = getLocalDateString()

  const dayParams = useMemo(
    () => ({
      from: today,
      to: today,
      deviceId: deviceFilter || undefined,
    }),
    [today, deviceFilter]
  )

  const { data: dayStats, isLoading: dayStatsLoading } = useStats(dayParams)
  const { data: cumulativeStats } = useStats(deviceFilter ? undefined : {})
  const { data: facets } = useFacets()
  const { data: lineStatus, isLoading: lineLoading } = useLineStatus(deviceFilter || undefined)
  const { data: recentLogs = [], isLoading: isRecentLoading } = useRecentInspections(
    settings.recentFeedLimit
  )
  const { data: latestFailPage } = useInspectionSearch({
    ...dayParams,
    result: 'FAIL',
    page: 0,
    size: 1,
  })
  const { data: defectItems = [] } = useDefectSummary({ ...dayParams, result: 'FAIL' }, 6)

  const scopedRecent = useMemo(() => {
    if (!deviceFilter) return recentLogs
    return recentLogs.filter((l) => l.deviceId === deviceFilter)
  }, [recentLogs, deviceFilter])

  const topDefects = useMemo(
    () => defectItems.map((d) => [d.label, d.count] as [string, number]),
    [defectItems]
  )

  const lineFilter = useMemo(
    () => ({ deviceId: deviceFilter || undefined }),
    [deviceFilter]
  )

  const goDefectHistory = (label: string) => {
    navigate(
      buildHistoryPath({
        from: today,
        to: today,
        result: 'FAIL',
        defect: label,
        device: deviceFilter || undefined,
      })
    )
  }

  const cumulative = cumulativeStats
    ? {
        total: cumulativeStats.totalCount,
        pass: cumulativeStats.passCount,
        fail: cumulativeStats.failCount,
        failRate: cumulativeStats.failRate,
      }
    : undefined

  const latestFail = latestFailPage?.content[0]

  return (
    <div className="dashboard-hmi flex h-full min-h-0 flex-col gap-px p-px overflow-hidden bg-[var(--dash-border)]">
      {alerts.length > 0 && (
        <div className="shrink-0 flex items-center gap-2 bg-[var(--dash-warning)]/15 border border-[var(--dash-warning)] px-2 py-1 text-[11px] text-[var(--dash-warning)] font-semibold">
          <span>ALM</span>
          <span className="truncate">{alerts.join(' · ')}</span>
        </div>
      )}

      <div className="shrink-0 flex flex-wrap items-stretch gap-px bg-[var(--dash-border)]">
        <div className="flex-1 min-w-[280px]">
          <DashboardLineStatus status={lineStatus} isLoading={lineLoading} />
        </div>
        <div className="flex flex-wrap items-center gap-px px-2 py-1 bg-[var(--dash-surface)] border border-[var(--dash-border)]">
          <DeviceFilterTabs devices={facets?.deviceIds} value={deviceFilter} onChange={setDeviceFilter} />
        </div>
        <div className="flex items-stretch shrink-0 text-[11px]">
          <button
            type="button"
            onClick={() => navigate(dashboardTodayHistoryPath('FAIL'))}
            className="px-2.5 py-1.5 font-semibold border border-[var(--dash-border)] bg-[var(--dash-danger)]/12 text-[var(--dash-danger)] hover:bg-[var(--dash-danger)]/20"
          >
            당일 FAIL
          </button>
          <button
            type="button"
            onClick={() => navigate(dashboardTodayHistoryPath())}
            className="px-2.5 py-1.5 border border-[var(--dash-border)] -ml-px bg-[var(--dash-surface)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-secondary)]"
          >
            당일 전체
          </button>
        </div>
      </div>

      <DashboardKpiStrip
        dayStats={dayStats}
        isLoading={dayStatsLoading}
        targetYieldPct={settings.targetYieldPct}
        formatRate={formatRatePercent}
        cumulative={deviceFilter ? undefined : cumulative}
      />

      <div className="flex flex-1 min-h-0 gap-px">
        <div className="flex-[3] min-w-0 min-h-0 flex flex-col">
          <DashboardRecentFeed
            logs={scopedRecent}
            isLoading={isRecentLoading}
            formatSplitDateTime={formatSplitDateTime}
            maxRows={14}
          />
        </div>
        <div className="flex-[2] min-w-[260px] max-w-[360px] shrink-0 flex flex-col gap-px min-h-0">
          <DashboardLatestFail
            log={latestFail}
            isLoading={!latestFailPage}
            formatSplitDateTime={formatSplitDateTime}
          />
          <div className="flex-1 min-h-0">
            <DashboardDefectPareto items={topDefects} onSelect={goDefectHistory} />
          </div>
        </div>
      </div>

      <div className="shrink-0 h-[200px] min-h-[180px]">
        <HourlyInspectionVolumeChart lineFilter={lineFilter} compact />
      </div>
    </div>
  )
}
