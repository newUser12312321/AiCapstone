import { useMemo } from 'react'
import { useDashboardScope } from '@/context/DashboardScopeContext'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useRecentInspections, useStats } from '@/hooks/useInspectionData'
import type { InspectionSearchParams } from '@/types/inspection'
import { getLocalDateString } from '@/utils/historyNavigation'

export type DashboardAlertScope = Pick<
  InspectionSearchParams,
  'from' | 'to' | 'deviceId'
>

/**
 * 설정된 임계값을 넘으면 헤더에 표시할 메시지 목록 (기본: 당일 집계).
 * 라인 모니터 장치 필터가 있으면 동일 범위로 집계한다.
 */
export function useDashboardAlerts(scope?: DashboardAlertScope): string[] {
  const { settings } = useDashboardSettings()
  const lineScope = useDashboardScope()
  const today = getLocalDateString()
  const dayParams = useMemo(
    () => ({
      from: scope?.from ?? today,
      to: scope?.to ?? today,
      deviceId: scope?.deviceId ?? (lineScope?.deviceId || undefined),
    }),
    [scope?.from, scope?.to, scope?.deviceId, lineScope?.deviceId, today]
  )

  const { data: stats } = useStats(dayParams)
  const { data: recentLogs = [] } = useRecentInspections(settings.recentFeedLimit)

  const scopedRecent = useMemo(() => {
    const fromDay = dayParams.from ?? today
    let rows = recentLogs.filter((l) => l.inspectedAt.slice(0, 10) >= fromDay)
    if (dayParams.deviceId) {
      rows = rows.filter((l) => l.deviceId === dayParams.deviceId)
    }
    return rows
  }, [recentLogs, dayParams.from, dayParams.deviceId, today])

  const minSample = settings.alertMinSampleCount

  return useMemo(() => {
    if (!settings.alertsEnabled) return []

    const out: string[] = []

    if (
      stats &&
      stats.totalCount >= minSample &&
      stats.failRate >= settings.alertMinFailRatePct
    ) {
      out.push(
        `당일 불량률 ${stats.failRate.toFixed(settings.decimalPlaces)}% (임계 ${settings.alertMinFailRatePct}%)`
      )
    } else if (stats && stats.failCount > 0 && stats.totalCount > 0 && stats.totalCount < minSample) {
      out.push(
        `당일 FAIL ${stats.failCount}건 / ${stats.totalCount}건 (표본 부족 · 불량률 알림 ${minSample}건 이상)`
      )
    }

    let consecutive = 0
    for (const log of scopedRecent) {
      if (log.result === 'FAIL') consecutive += 1
      else break
    }
    if (consecutive >= settings.alertMinConsecutiveFail) {
      out.push(`연속 FAIL ${consecutive}건 (임계 ${settings.alertMinConsecutiveFail}건)`)
    }

    const inf = scopedRecent
      .map((l) => l.inferenceTimeMs)
      .filter((v): v is number => typeof v === 'number')
    if (inf.length && settings.alertMaxAvgInferenceMs > 0) {
      const avg = Math.round(inf.reduce((a, b) => a + b, 0) / inf.length)
      if (avg > settings.alertMaxAvgInferenceMs) {
        out.push(`평균 추론 ${avg}ms (임계 ${settings.alertMaxAvgInferenceMs}ms)`)
      }
    }

    return out
  }, [
    settings.alertsEnabled,
    settings.alertMinFailRatePct,
    settings.alertMinConsecutiveFail,
    settings.alertMaxAvgInferenceMs,
    settings.decimalPlaces,
    minSample,
    stats,
    scopedRecent,
  ])
}
