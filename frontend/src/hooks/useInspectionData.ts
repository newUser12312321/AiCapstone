/**
 * 검사 데이터 조회 React Query 커스텀 훅 모음
 *
 * React Query(TanStack Query v5)의 useQuery를 래핑하여
 * 각 컴포넌트에서 데이터 패칭·캐싱·자동 갱신을 단순하게 사용하도록 한다.
 *
 * 자동 폴링(refetchInterval):
 *   설정(대시보드 설정)에서 간격을 고르거나 끌 수 있다.
 */

import { useQuery } from '@tanstack/react-query'
import {
  fetchAllInspections,
  fetchDailySummary,
  fetchDefectSummary,
  fetchFacets,
  fetchHourlySummary,
  fetchInspectionById,
  fetchInspectionsByPeriod,
  fetchLineStatus,
  fetchRecentInspections,
  fetchStats,
  searchInspections,
} from '@/api/inspectionApi'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import type { HourlyVolumePoint, InspectionSearchParams, TrendDataPoint } from '@/types/inspection'
import type { LineFilter } from '@/utils/inspectionFilters'
import { filterByLine } from '@/utils/inspectionFilters'
import { getLocalDateString } from '@/utils/historyNavigation'

/** React Query 캐시 키 상수 — 오타 방지를 위해 중앙 관리 */
export const QUERY_KEYS = {
  stats:        (p?: object) => ['inspections', 'stats', p] as const,
  all:          ['inspections', 'all']           as const,
  search:       (p: InspectionSearchParams) => ['inspections', 'search', p] as const,
  facets:       ['inspections', 'facets']        as const,
  lineStatus:   (deviceId?: string) => ['inspections', 'line-status', deviceId ?? ''] as const,
  hourly:       (p?: object) => ['inspections', 'hourly', p] as const,
  daily:        (p?: object) => ['inspections', 'daily', p] as const,
  defects:      (p?: object) => ['inspections', 'defects', p] as const,
  recent:       (limit: number) => ['inspections', 'recent', limit] as const,
  byId:         (id: number)    => ['inspections', id]              as const,
  byPeriod:     (from: string, to: string) =>
                  ['inspections', 'period', from, to]               as const,
}

// ── 통계 훅 ──────────────────────────────────────────────────────────────────

function useInspectionPollingOptions(): {
  refetchInterval: number | false
  staleTime: number
} {
  const { settings } = useDashboardSettings()
  const ms = settings.pollingIntervalMs
  return {
    refetchInterval: ms ?? false,
    staleTime: ms != null ? 3_000 : 60_000,
  }
}

/**
 * 전체 통계 요약을 조회한다. (totalCount, passCount, failCount, failRate)
 */
export function useStats(params?: Omit<InspectionSearchParams, 'page' | 'size'>) {
  const { refetchInterval, staleTime } = useInspectionPollingOptions()
  return useQuery({
    queryKey:        QUERY_KEYS.stats(params),
    queryFn:         () => fetchStats(params),
    refetchInterval,
    staleTime,
  })
}

export function useInspectionSearch(params: InspectionSearchParams, enabled = true) {
  const { refetchInterval, staleTime } = useInspectionPollingOptions()
  return useQuery({
    queryKey: QUERY_KEYS.search(params),
    queryFn: () => searchInspections(params),
    enabled,
    refetchInterval,
    staleTime,
  })
}

export function useFacets() {
  return useQuery({
    queryKey: QUERY_KEYS.facets,
    queryFn: fetchFacets,
    staleTime: 60_000,
  })
}

export function useLineStatus(deviceId?: string) {
  const { refetchInterval, staleTime } = useInspectionPollingOptions()
  return useQuery({
    queryKey: QUERY_KEYS.lineStatus(deviceId),
    queryFn: () => fetchLineStatus(deviceId),
    refetchInterval,
    staleTime,
  })
}

export function useDailySummary(params?: Omit<InspectionSearchParams, 'page' | 'size' | 'result'>) {
  const { refetchInterval, staleTime } = useInspectionPollingOptions()
  return useQuery({
    queryKey: QUERY_KEYS.daily(params),
    queryFn: () => fetchDailySummary(params),
    refetchInterval,
    staleTime,
  })
}

export function useHourlySummary(params?: Omit<InspectionSearchParams, 'page' | 'size' | 'result'>) {
  const { refetchInterval, staleTime } = useInspectionPollingOptions()
  return useQuery({
    queryKey: QUERY_KEYS.hourly(params),
    queryFn: () => fetchHourlySummary(params),
    refetchInterval,
    staleTime,
  })
}

export function useDefectSummary(params?: InspectionSearchParams, limit = 6) {
  const { refetchInterval, staleTime } = useInspectionPollingOptions()
  return useQuery({
    queryKey: QUERY_KEYS.defects({ ...params, limit }),
    queryFn: () => fetchDefectSummary(params, limit),
    refetchInterval,
    staleTime,
  })
}

// ── 이력 목록 훅 ──────────────────────────────────────────────────────────────

/**
 * 전체 검사 이력 목록을 조회한다.
 * InspectionTable, TrendChart에서 사용.
 */
export function useAllInspections() {
  const { refetchInterval, staleTime } = useInspectionPollingOptions()
  return useQuery({
    queryKey:        QUERY_KEYS.all,
    queryFn:         fetchAllInspections,
    refetchInterval,
    staleTime,
  })
}

/**
 * 최근 N건의 검사 이력을 조회한다.
 * 대시보드 실시간 피드에 사용.
 *
 * @param limit 조회 건수 (기본값 10)
 */
export function useRecentInspections(limit = 10) {
  const { refetchInterval, staleTime } = useInspectionPollingOptions()
  return useQuery({
    queryKey:        QUERY_KEYS.recent(limit),
    queryFn:         () => fetchRecentInspections(limit),
    refetchInterval,
    staleTime,
  })
}

/**
 * 단건 검사 이력을 ID로 조회한다.
 * DefectViewer(바운딩박스 상세 뷰)에서 사용.
 *
 * @param id 조회할 검사 로그 ID (undefined이면 쿼리 비활성화)
 */
export function useInspectionById(id: number | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.byId(id!),
    queryFn:  () => fetchInspectionById(id!),
    enabled:  id !== undefined,  // id가 없으면 쿼리 실행 안 함
  })
}

/**
 * 기간 필터 검사 이력을 조회한다.
 * HistoryPage의 날짜 필터 기능에 사용.
 *
 * @param from 시작 시각 (ISO 8601 문자열)
 * @param to   종료 시각 (ISO 8601 문자열)
 */
export function useInspectionsByPeriod(from: string, to: string) {
  return useQuery({
    queryKey: QUERY_KEYS.byPeriod(from, to),
    queryFn:  () => fetchInspectionsByPeriod(from, to),
    enabled:  Boolean(from && to),  // 날짜가 모두 입력된 경우만 실행
    staleTime: 10_000,
  })
}

// ── 파생 데이터 훅 ────────────────────────────────────────────────────────────

/**
 * 전체 이력 데이터를 시간대별로 집계하여 TrendChart용 데이터를 반환한다.
 *
 * 집계 방식: inspectedAt의 시(hour) 단위로 그룹핑하여
 * 각 시간대의 PASS/FAIL 건수를 카운트한다.
 *
 * 예시 반환값:
 *   [{ label: "09:00", pass: 12, fail: 2 }, ...]
 */
export function useTrendData(lineFilter?: LineFilter): { data: TrendDataPoint[]; isLoading: boolean } {
  const { settings } = useDashboardSettings()
  const { data: logs = [], isLoading } = useAllInspections()

  if (isLoading || logs.length === 0) {
    return { data: [], isLoading }
  }

  const scoped = filterByLine(logs, {
    deviceId: lineFilter?.deviceId,
    board: lineFilter?.board,
  })

  // 최근 24시간 데이터만 필터링
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = scoped.filter((l) => new Date(l.inspectedAt) >= cutoff)

  const grouped: Record<string, { pass: number; fail: number; latestTs: number; anchorDate: string }> = {}

  recent.forEach((log) => {
    const d = new Date(log.inspectedAt)
    const utc = settings.timeZoneMode === 'utc'
    const hour = utc ? d.getUTCHours() : d.getHours()
    const label = `${String(hour).padStart(2, '0')}:00`
    const dayStr = utc
      ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      : getLocalDateString(d)
    const ts = d.getTime()

    if (!grouped[label]) {
      grouped[label] = { pass: 0, fail: 0, latestTs: -1, anchorDate: dayStr }
    }
    const g = grouped[label]
    if (log.result === 'PASS') g.pass++
    else g.fail++
    if (ts >= g.latestTs) {
      g.latestTs = ts
      g.anchorDate = dayStr
    }
  })

  const trendData: TrendDataPoint[] = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, g]) => ({
      label,
      pass: g.pass,
      fail: g.fail,
      anchorDate: g.anchorDate,
    }))

  return { data: trendData, isLoading }
}

/**
 * 최근 24시간을 1시간 버킷으로 나눈 검사 건수 집계 (주식형 추이 차트용).
 * 버킷은 설정의 timeZoneMode(로컬/UTC) 기준으로 정렬된다.
 */
export function useHourlyInspectionVolume(lineFilter?: LineFilter): {
  data: HourlyVolumePoint[]
  isLoading: boolean
} {
  const today = getLocalDateString()
  const { data = [], isLoading } = useHourlySummary({
    from: today,
    to: today,
    deviceId: lineFilter?.deviceId,
    board: lineFilter?.board,
  })
  return { data, isLoading }
}
