import { getLocalDateString } from '@/utils/historyNavigation'

export type CumulativePeriod = '7d' | '30d' | '90d' | 'all'

export const CUMULATIVE_PERIOD_OPTIONS: { id: CumulativePeriod; label: string }[] = [
  { id: '7d', label: '최근 7일' },
  { id: '30d', label: '최근 30일' },
  { id: '90d', label: '최근 90일' },
  { id: 'all', label: '전체' },
]

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** 기간 필터용 from/to (YYYY-MM-DD). 전체는 from 생략 → 서버가 데이터 시작일부터 집계 */
export function cumulativePeriodRange(period: CumulativePeriod): { from?: string; to: string } {
  const to = getLocalDateString()
  if (period === 'all') {
    return { to }
  }
  const days = period === '7d' ? 6 : period === '30d' ? 29 : 89
  return { from: getLocalDateString(addDays(new Date(), -days)), to }
}

export function cumulativePeriodLabel(period: CumulativePeriod): string {
  return CUMULATIVE_PERIOD_OPTIONS.find((o) => o.id === period)?.label ?? period
}
