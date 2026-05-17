import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  const { data: defectItems = [] } = useDefectSummary(
    { ...dayParams, result: 'FAIL' },
    6
  )

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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--dash-bg-secondary)]">
      {alerts.length > 0 && (
        <div className="shrink-0 border-b border-[var(--dash-warning)]/50 bg-[var(--dash-warning)]/10 px-4 py-2 text-xs text-[var(--dash-warning)]">
          <span className="font-semibold">운영 알림:</span> {alerts.join(' · ')}
        </div>
      )}
      <div className="shrink-0 border-b border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--dash-text-tertiary)]">라인 모니터링 · AOI 검사 결과</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(dashboardTodayHistoryPath('FAIL'))}
            className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--dash-danger)]/50 text-[var(--dash-danger)] bg-[var(--dash-danger)]/8 hover:bg-[var(--dash-danger)]/14"
          >
            당일 FAIL
          </button>
          <button
            type="button"
            onClick={() => navigate(dashboardTodayHistoryPath())}
            className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--dash-border)] text-[var(--dash-text-secondary)] bg-[var(--dash-surface)] hover:bg-[var(--dash-bg-secondary)]"
          >
            당일 전체
          </button>
          <Link
            to="/history"
            className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--dash-border)] text-[var(--dash-text-secondary)] bg-[var(--dash-surface)] hover:bg-[var(--dash-bg-secondary)]"
          >
            검사 로그
          </Link>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <DashboardLineStatus status={lineStatus} isLoading={lineLoading} />

        <DeviceFilterTabs
          devices={facets?.deviceIds}
          value={deviceFilter}
          onChange={setDeviceFilter}
        />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          <div className="xl:col-span-8">
            <DashboardKpiStrip
              dayStats={dayStats}
              isLoading={dayStatsLoading}
              targetYieldPct={settings.targetYieldPct}
              formatRate={formatRatePercent}
              cumulative={deviceFilter ? undefined : cumulative}
            />
          </div>
          <div className="xl:col-span-4">
            <DashboardLatestFail
              log={latestFail}
              isLoading={!latestFailPage}
              formatSplitDateTime={formatSplitDateTime}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 min-h-[380px]">
          <div className="xl:col-span-8 min-h-[360px] flex flex-col">
            <HourlyInspectionVolumeChart lineFilter={lineFilter} />
          </div>
          <div className="xl:col-span-4 min-h-[280px] flex flex-col">
            <DashboardRecentFeed
              logs={scopedRecent}
              isLoading={isRecentLoading}
              formatSplitDateTime={formatSplitDateTime}
              maxRows={8}
            />
          </div>
        </div>

        <div className="max-w-xl">
          <DashboardDefectPareto items={topDefects} onSelect={goDefectHistory} />
        </div>
      </div>
    </div>
  )
}
