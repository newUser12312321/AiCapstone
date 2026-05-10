import type { InspectionLog } from '@/types/inspection'
import { defectDisplayName } from '@/types/inspection'

export type LineFilter = {
  deviceId?: string
  /** silkBoardName 과 정확 일치 (공백 제외) */
  board?: string
}

/** 대시보드 상단 라인·기종 필터 */
export function filterByLine(logs: InspectionLog[], f: LineFilter): InspectionLog[] {
  let out = logs
  const dev = f.deviceId?.trim()
  if (dev) out = out.filter((l) => l.deviceId === dev)
  const board = f.board?.trim()
  if (board) out = out.filter((l) => (l.silkBoardName ?? '').trim() === board)
  return out
}

export function logMatchesDefectDisplayLabel(log: InspectionLog, label: string): boolean {
  if (!label.trim()) return true
  return log.defects.some(
    (d) => defectDisplayName(d.defectType, d.detail) === label
  )
}
