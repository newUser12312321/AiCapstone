import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DeviceFilterTabs from '@/components/common/DeviceFilterTabs'
import DashboardFailPanel from '@/components/dashboard/DashboardFailPanel'
import DashboardKpiStrip, { dashboardTodayHistoryPath } from '@/components/dashboard/DashboardKpiStrip'
import DashboardLineStatus from '@/components/dashboard/DashboardLineStatus'
import DashboardRecentFeed from '@/components/dashboard/DashboardRecentFeed'
import HourlyInspectionVolumeChart from '@/components/dashboard/HourlyInspectionVolumeChart'
import { useDashboardScopeRequired } from '@/context/DashboardScopeContext'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import {
  useDefectSummary,
  useFacets,
  useInspectionSearch,
  useLineStatus,
  useStats,
} from '@/hooks/useInspectionData'
import { buildHistoryPath, getLocalDateString } from '@/utils/historyNavigation'
import { buildDashboardDefectPareto } from '@/utils/dashboardDefectSummary'

export default function DashboardPage() {
  const { settings, formatSplitDateTime, formatRatePercent } = useDashboardSettings()
  const { deviceId: deviceFilter, setDeviceId: setDeviceFilter } = useDashboardScopeRequired()
  const navigate = useNavigate()
  const today = getLocalDateString()

  const dayParams = useMemo(
    () => ({
      from: today,
      to: today,
      deviceId: deviceFilter || undefined,
    }),
    [today, deviceFilter]
  )

  const feedLimit = settings.recentFeedLimit

  const { data: dayStats, isLoading: dayStatsLoading } = useStats(dayParams)
  const { data: cumulativeStats } = useStats(deviceFilter ? undefined : {})
  const { data: facets } = useFacets()
  const { data: lineStatus, isLoading: lineLoading } = useLineStatus(deviceFilter || undefined)
  const { data: todayPage, isLoading: isTodayLoading } = useInspectionSearch({
    ...dayParams,
    page: 0,
    size: feedLimit,
  })
  const { data: latestFailPage } = useInspectionSearch({
    ...dayParams,
    result: 'FAIL',
    page: 0,
    size: 1,
  })
  const { data: defectItems = [] } = useDefectSummary({ ...dayParams, result: 'FAIL' }, 6)

  const todayLogs = todayPage?.content ?? []

  const latestFail = latestFailPage?.content[0]
  const dayFailCount = dayStats?.failCount ?? 0
  const dayTotal = dayStats?.totalCount ?? 0

  const defectPareto = useMemo(
    () => buildDashboardDefectPareto(defectItems, latestFail, dayFailCount),
    [defectItems, latestFail, dayFailCount]
  )

  const lineFilter = useMemo(
    () => ({ deviceId: deviceFilter || undefined }),
    [deviceFilter]
  )

  const goDefectHistory = (filterKey: string) => {
    navigate(
      buildHistoryPath({
        from: today,
        to: today,
        result: 'FAIL',
        defect: filterKey,
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

  const showFailSidebar =
    dayFailCount > 0 || !!latestFail || defectPareto.length > 0
  const sparseFeed = todayLogs.length > 0 && todayLogs.length <= 5
  const chartListView = dayTotal > 0 && dayTotal <= 40

  useEffect(() => {
    return () => setDeviceFilter('')
  }, [setDeviceFilter])

  return (
    <div className="dashboard-hmi flex h-full min-h-0 flex-col gap-px p-px overflow-hidden bg-[var(--dash-border)]">
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
            FAIL ?�력
          </button>
          <button
            type="button"
            onClick={() => navigate(dashboardTodayHistoryPath())}
            className="px-2.5 py-1.5 border border-[var(--dash-border)] -ml-px bg-[var(--dash-surface)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-secondary)]"
          >
            ?�체 ?�력
          </button>
        </div>
      </div>

      <DashboardKpiStrip
        dayStats={dayStats}
        isLoading={dayStatsLoading}
        targetYieldPct={settings.targetYieldPct}
        formatRate={formatRatePercent}
        cumulative={deviceFilter ? undefined : cumulative}
        lowSampleThreshold={settings.alertMinSampleCount}
      />

      {!showFailSidebar && (
        <DashboardFailPanel
          latestFail={latestFail}
          isLoadingFail={!latestFailPage}
          defectPareto={defectPareto}
          formatSplitDateTime={formatSplitDateTime}
          onDefectSelect={goDefectHistory}
        />
      )}

      <div className="flex flex-1 min-h-0 gap-px">
        <div className={showFailSidebar ? 'flex-[3] min-w-0 min-h-0 flex flex-col' : 'flex-1 min-w-0 min-h-0 flex flex-col'}>
          <DashboardRecentFeed
            logs={todayLogs}
            isLoading={isTodayLoading}
            formatSplitDateTime={formatSplitDateTime}
            maxRows={feedLimit}
            sparse={sparseFeed}
            title={'\uB2F9\uC77C \uAC80\uC0AC'}
            metaLabel={`\uC624\uB298 ${dayTotal}\uAC74`}
          />
        </div>
        {showFailSidebar && (
          <div className="flex-[2] min-w-[260px] max-w-[360px] shrink-0 flex flex-col gap-px min-h-0">
            <DashboardFailPanel
              latestFail={latestFail}
              isLoadingFail={!latestFailPage}
              defectPareto={defectPareto}
              formatSplitDateTime={formatSplitDateTime}
              onDefectSelect={goDefectHistory}
            />
          </div>
        )}
      </div>

      <div className="shrink-0 h-[200px] min-h-[180px] max-h-[220px]">
        <HourlyInspectionVolumeChart
          lineFilter={lineFilter}
          dayTotal={dayTotal}
          forceListView={chartListView}
        />
      </div>
    </div>
  )
}



