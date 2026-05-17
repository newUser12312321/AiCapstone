import { useMemo } from 'react'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useRecentInspections, useStats } from '@/hooks/useInspectionData'

/**
 * 설정된 임계값을 넘으면 헤더·토스트에 표시할 메시지 목록
 */
export function useDashboardAlerts(): string[] {
  const { settings } = useDashboardSettings()
  const { data: stats } = useStats()
  const { data: recentLogs = [] } = useRecentInspections(settings.recentFeedLimit)

  return useMemo(() => {
    if (!settings.alertsEnabled) return []

    const out: string[] = []

    if (stats && stats.failRate >= settings.alertMinFailRatePct) {
      out.push(
        `불량률 ${stats.failRate.toFixed(settings.decimalPlaces)}% (임계 ${settings.alertMinFailRatePct}%)`
      )
    }

    let consecutive = 0
    for (const log of recentLogs) {
      if (log.result === 'FAIL') consecutive += 1
      else break
    }
    if (consecutive >= settings.alertMinConsecutiveFail) {
      out.push(`연속 FAIL ${consecutive}건 (임계 ${settings.alertMinConsecutiveFail}건)`)
    }

    const inf = recentLogs
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
    settings.recentFeedLimit,
    stats,
    recentLogs,
  ])
}
