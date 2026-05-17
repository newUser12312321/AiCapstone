/**
 * 대시보드 사용자 설정 (localStorage)
 */

export type TimeZoneMode = 'local' | 'utc'

/** 테이블·상세에서 날짜/시각 표시 스타일 */
export type DateStyle = 'compact' | 'iso' | 'locale-long'

export type DashboardColorScheme = 'dark' | 'light'

export interface DashboardSettings {
  /** null 이면 자동 폴링 끔 (창 포커스 시 등 기존 React Query 동작은 유지) */
  pollingIntervalMs: number | null
  /** 대시보드 우측 피드 등에 쓰이는 최근 검사 건수 */
  recentFeedLimit: number
  timeZoneMode: TimeZoneMode
  dateStyle: DateStyle
  /** 불량률·비율 소수 자릿수 (0~4) */
  decimalPlaces: number
  colorScheme: DashboardColorScheme

  /** 임계값 알림(헤더·토스트) 사용 */
  alertsEnabled: boolean
  /** 불량률(%)가 이 값 이상이면 알림 */
  alertMinFailRatePct: number
  /** 당일 검사 건수가 이 값 이상일 때만 불량률 알림 (소량·데모 오탐 방지) */
  alertMinSampleCount: number
  /** 최근 피드에서 연속 FAIL 이 횟수 이상이면 알림 */
  alertMinConsecutiveFail: number
  /** 평균 추론 시간(ms)이 이 값 초과면 알림 (0이면 비활성) */
  alertMaxAvgInferenceMs: number
  /** 대시보드 당일 수율 목표 (%) */
  targetYieldPct: number
}

export const DASHBOARD_SETTINGS_STORAGE_KEY = 'pcb-dashboard-settings-v1'

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  pollingIntervalMs: 5_000,
  recentFeedLimit: 30,
  timeZoneMode: 'local',
  dateStyle: 'compact',
  decimalPlaces: 2,
  colorScheme: 'light',
  alertsEnabled: true,
  alertMinFailRatePct: 5,
  alertMinSampleCount: 30,
  alertMinConsecutiveFail: 3,
  alertMaxAvgInferenceMs: 20_000,
  targetYieldPct: 97,
}

const POLLING_OPTIONS_MS = [5_000, 10_000, 30_000] as const

export function isValidPollingInterval(ms: number | null): ms is number | null {
  if (ms === null) return true
  return (POLLING_OPTIONS_MS as readonly number[]).includes(ms)
}

export function clampRecentFeedLimit(n: number): number {
  return Math.min(100, Math.max(10, Math.round(n)))
}

export function clampDecimalPlaces(n: number): number {
  return Math.min(4, Math.max(0, Math.round(n)))
}

export function clampAlertFailRate(n: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0))
}

export function clampAlertMinSampleCount(n: number): number {
  return Math.min(500, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)))
}

export function clampAlertConsecutiveFail(n: number): number {
  return Math.min(50, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)))
}

export function clampAlertInferenceMs(n: number): number {
  return Math.min(600_000, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)))
}

export function clampTargetYieldPct(n: number): number {
  return Math.min(100, Math.max(50, Number.isFinite(n) ? n : DEFAULT_DASHBOARD_SETTINGS.targetYieldPct))
}

export function loadDashboardSettings(): DashboardSettings {
  try {
    const raw = localStorage.getItem(DASHBOARD_SETTINGS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_DASHBOARD_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<DashboardSettings>
    const polling =
      parsed.pollingIntervalMs === undefined
        ? DEFAULT_DASHBOARD_SETTINGS.pollingIntervalMs
        : parsed.pollingIntervalMs
    if (!isValidPollingInterval(polling)) {
      return { ...DEFAULT_DASHBOARD_SETTINGS }
    }
    return {
      pollingIntervalMs: polling,
      recentFeedLimit: clampRecentFeedLimit(
        parsed.recentFeedLimit ?? DEFAULT_DASHBOARD_SETTINGS.recentFeedLimit
      ),
      timeZoneMode:
        parsed.timeZoneMode === 'utc' ? 'utc' : 'local',
      dateStyle:
        parsed.dateStyle === 'iso' || parsed.dateStyle === 'locale-long'
          ? parsed.dateStyle
          : 'compact',
      decimalPlaces: clampDecimalPlaces(
        parsed.decimalPlaces ?? DEFAULT_DASHBOARD_SETTINGS.decimalPlaces
      ),
      colorScheme:
        parsed.colorScheme === 'dark' ? 'dark' : 'light',
      alertsEnabled:
        typeof parsed.alertsEnabled === 'boolean'
          ? parsed.alertsEnabled
          : DEFAULT_DASHBOARD_SETTINGS.alertsEnabled,
      alertMinFailRatePct: clampAlertFailRate(
        parsed.alertMinFailRatePct ?? DEFAULT_DASHBOARD_SETTINGS.alertMinFailRatePct
      ),
      alertMinSampleCount: clampAlertMinSampleCount(
        parsed.alertMinSampleCount ?? DEFAULT_DASHBOARD_SETTINGS.alertMinSampleCount
      ),
      alertMinConsecutiveFail: clampAlertConsecutiveFail(
        parsed.alertMinConsecutiveFail ?? DEFAULT_DASHBOARD_SETTINGS.alertMinConsecutiveFail
      ),
      alertMaxAvgInferenceMs: clampAlertInferenceMs(
        parsed.alertMaxAvgInferenceMs ?? DEFAULT_DASHBOARD_SETTINGS.alertMaxAvgInferenceMs
      ),
      targetYieldPct: clampTargetYieldPct(
        parsed.targetYieldPct ?? DEFAULT_DASHBOARD_SETTINGS.targetYieldPct
      ),
    }
  } catch {
    return { ...DEFAULT_DASHBOARD_SETTINGS }
  }
}

export function saveDashboardSettings(s: DashboardSettings): void {
  localStorage.setItem(DASHBOARD_SETTINGS_STORAGE_KEY, JSON.stringify(s))
}

/** 설정 UI용 폴링 선택지 */
export const POLLING_INTERVAL_OPTIONS: { value: number | null; label: string }[] = [
  { value: 5_000, label: '5초' },
  { value: 10_000, label: '10초' },
  { value: 30_000, label: '30초' },
  { value: null, label: '끄기 (자동 폴링 없음)' },
]
