import type { InspectionLog } from '@/types/inspection'
import { getLocalDateString } from '@/utils/historyNavigation'

export interface InspectionSummary {
  total: number
  pass: number
  fail: number
  yieldPct: number | null
  failRate: number | null
}

export function summarizeInspections(logs: InspectionLog[]): InspectionSummary {
  const total = logs.length
  const pass = logs.filter((l) => l.result === 'PASS').length
  const fail = logs.filter((l) => l.result === 'FAIL').length
  return {
    total,
    pass,
    fail,
    yieldPct: total ? (pass / total) * 100 : null,
    failRate: total ? (fail / total) * 100 : null,
  }
}

export function filterLogsByDevice(logs: InspectionLog[], deviceId: string): InspectionLog[] {
  if (!deviceId.trim()) return logs
  return logs.filter((l) => l.deviceId === deviceId)
}

export function todayInspectionLogs(logs: InspectionLog[]): InspectionLog[] {
  const today = getLocalDateString()
  return logs.filter((l) => l.inspectedAt.slice(0, 10) === today)
}

export function uniqueDeviceIds(logs: InspectionLog[]): string[] {
  const s = new Set<string>()
  logs.forEach((l) => {
    if (l.deviceId?.trim()) s.add(l.deviceId)
  })
  return Array.from(s).sort()
}
