import type { InspectionLog } from '@/types/inspection'
import { defectDisplayName } from '@/types/inspection'

export interface DefectParetoRow {
  label: string
  count: number
  /** 검사 이력 필터용 원본 defectType */
  filterKey: string
  kind: 'missing' | 'detection'
}

/** FAIL 1건의 defects → 대시보드 파레토 (누락 판정 우선, 검출 bbox는 유형별 집계) */
export function defectParetoFromFailLog(log: InspectionLog): DefectParetoRow[] {
  const missing = log.defects.filter((d) => d.defectType.startsWith('MISSING:'))
  if (missing.length > 0) {
    return missing.map((d) => ({
      label: defectDisplayName(d.defectType, d.detail),
      count: 1,
      filterKey: d.defectType,
      kind: 'missing' as const,
    }))
  }

  const counts = new Map<string, { label: string; count: number }>()
  for (const d of log.defects) {
    const key = d.defectType
    const label = defectDisplayName(d.defectType, d.detail)
    const prev = counts.get(key)
    if (prev) prev.count += 1
    else counts.set(key, { label, count: 1 })
  }
  return [...counts.entries()]
    .map(([filterKey, { label, count }]) => ({
      label,
      count,
      filterKey,
      kind: 'detection' as const,
    }))
    .sort((a, b) => b.count - a.count)
}

export function defectParetoFromApiCounts(
  items: { label: string; count: number }[]
): DefectParetoRow[] {
  return items
    .map(({ label, count }) => ({
      label: defectDisplayName(label),
      count,
      filterKey: label,
      kind: label.startsWith('MISSING:') ? ('missing' as const) : ('detection' as const),
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'missing' ? -1 : 1
      return b.count - a.count
    })
}

/**
 * 당일 FAIL이 소수이면 최신 FAIL의 원인을 우선 표시 (mount_hole 검출 수와 누락 판정 혼동 방지).
 */
export function buildDashboardDefectPareto(
  apiItems: { label: string; count: number }[],
  latestFail: InspectionLog | undefined,
  dayFailCount: number
): DefectParetoRow[] {
  if (latestFail && dayFailCount > 0 && dayFailCount <= 5) {
    return defectParetoFromFailLog(latestFail)
  }
  return defectParetoFromApiCounts(apiItems)
}

/** 테이블·카드 한 줄 요약 */
export function primaryFailReason(log: InspectionLog): string | null {
  const missing = log.defects.find((d) => d.defectType.startsWith('MISSING:'))
  if (missing) return defectDisplayName(missing.defectType, missing.detail)
  if (log.defects.length === 0) return null
  const d = log.defects[0]
  return defectDisplayName(d.defectType, d.detail)
}
