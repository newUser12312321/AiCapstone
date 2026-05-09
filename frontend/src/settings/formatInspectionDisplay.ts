/**
 * 검사 시각·비율 표시 — DashboardSettings 스냅샷 기준 순수 함수
 */

import type { DashboardSettings } from '@/settings/dashboardSettings'

export interface InspectionFormatters {
  formatSplitDateTime: (iso: string) => { date: string; time: string }
  formatFullDateTime: (iso: string) => string
  formatRatePercent: (value: number) => string
}

export function buildInspectionFormatters(
  settings: DashboardSettings
): InspectionFormatters {
  const { timeZoneMode, dateStyle, decimalPlaces } = settings

  const tz = timeZoneMode === 'utc' ? 'UTC' : undefined

  function formatSplitDateTime(iso: string): { date: string; time: string } {
    const d = new Date(iso)

    if (dateStyle === 'iso') {
      const pad = (n: number) => String(n).padStart(2, '0')
      if (timeZoneMode === 'utc') {
        return {
          date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
          time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
        }
      }
      return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      }
    }

    if (dateStyle === 'locale-long') {
      const full = d.toLocaleString('ko-KR', {
        timeZone: tz,
        dateStyle: 'medium',
        timeStyle: 'medium',
      })
      return { date: full, time: '' }
    }

    /* compact — 기존 테이블과 유사 */
    const date = d.toLocaleDateString('ko-KR', {
      timeZone: tz,
      month: '2-digit',
      day: '2-digit',
    })
    const time = d.toLocaleTimeString('ko-KR', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    return { date, time }
  }

  function formatFullDateTime(iso: string): string {
    const { date, time } = formatSplitDateTime(iso)
    if (!time) return date
    return `${date} ${time}`
  }

  function formatRatePercent(value: number): string {
    return value.toFixed(decimalPlaces)
  }

  return {
    formatSplitDateTime,
    formatFullDateTime,
    formatRatePercent,
  }
}
