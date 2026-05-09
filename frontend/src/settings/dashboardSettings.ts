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
}

export const DASHBOARD_SETTINGS_STORAGE_KEY = 'pcb-dashboard-settings-v1'

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  pollingIntervalMs: 5_000,
  recentFeedLimit: 30,
  timeZoneMode: 'local',
  dateStyle: 'compact',
  decimalPlaces: 2,
  colorScheme: 'dark',
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
        parsed.colorScheme === 'light' ? 'light' : 'dark',
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
