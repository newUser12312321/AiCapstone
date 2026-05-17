/**
 * 대시보드 사용자 설정 (localStorage) + 검사 시각/비율 포맷터
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { DashboardSettings } from '@/settings/dashboardSettings'
import {
  DEFAULT_DASHBOARD_SETTINGS,
  loadDashboardSettings,
  saveDashboardSettings,
  clampRecentFeedLimit,
  clampDecimalPlaces,
  clampAlertFailRate,
  clampAlertMinSampleCount,
  clampAlertConsecutiveFail,
  clampAlertInferenceMs,
  clampTargetYieldPct,
  isValidPollingInterval,
} from '@/settings/dashboardSettings'
import {
  buildInspectionFormatters,
  type InspectionFormatters,
} from '@/settings/formatInspectionDisplay'

type DashboardSettingsContextValue = InspectionFormatters & {
  settings: DashboardSettings
  setSettings: (patch: Partial<DashboardSettings>) => void
  resetSettings: () => void
}

const DashboardSettingsContext = createContext<DashboardSettingsContextValue | null>(
  null
)

export function DashboardSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setState] = useState<DashboardSettings>(() => loadDashboardSettings())

  const setSettings = useCallback((patch: Partial<DashboardSettings>) => {
    setState((prev) => {
      let polling = patch.pollingIntervalMs
      if (polling !== undefined && !isValidPollingInterval(polling)) {
        polling = prev.pollingIntervalMs
      }
      const next: DashboardSettings = {
        ...prev,
        ...patch,
        ...(polling !== undefined ? { pollingIntervalMs: polling } : {}),
      }
      if (patch.recentFeedLimit != null) {
        next.recentFeedLimit = clampRecentFeedLimit(patch.recentFeedLimit)
      }
      if (patch.decimalPlaces != null) {
        next.decimalPlaces = clampDecimalPlaces(patch.decimalPlaces)
      }
      if (patch.alertsEnabled !== undefined) {
        next.alertsEnabled = patch.alertsEnabled
      }
      if (patch.alertMinFailRatePct != null) {
        next.alertMinFailRatePct = clampAlertFailRate(patch.alertMinFailRatePct)
      }
      if (patch.alertMinSampleCount != null) {
        next.alertMinSampleCount = clampAlertMinSampleCount(patch.alertMinSampleCount)
      }
      if (patch.alertMinConsecutiveFail != null) {
        next.alertMinConsecutiveFail = clampAlertConsecutiveFail(patch.alertMinConsecutiveFail)
      }
      if (patch.alertMaxAvgInferenceMs != null) {
        next.alertMaxAvgInferenceMs = clampAlertInferenceMs(patch.alertMaxAvgInferenceMs)
      }
      if (patch.targetYieldPct != null) {
        next.targetYieldPct = clampTargetYieldPct(patch.targetYieldPct)
      }
      saveDashboardSettings(next)
      return next
    })
  }, [])

  const resetSettings = useCallback(() => {
    const n = { ...DEFAULT_DASHBOARD_SETTINGS }
    saveDashboardSettings(n)
    setState(n)
  }, [])

  const formatters = useMemo(() => buildInspectionFormatters(settings), [settings])

  const value = useMemo(
    (): DashboardSettingsContextValue => ({
      settings,
      setSettings,
      resetSettings,
      ...formatters,
    }),
    [settings, setSettings, resetSettings, formatters]
  )

  return (
    <DashboardSettingsContext.Provider value={value}>
      {children}
    </DashboardSettingsContext.Provider>
  )
}

export function useDashboardSettings(): DashboardSettingsContextValue {
  const ctx = useContext(DashboardSettingsContext)
  if (!ctx) {
    throw new Error('useDashboardSettings must be used within DashboardSettingsProvider')
  }
  return ctx
}
