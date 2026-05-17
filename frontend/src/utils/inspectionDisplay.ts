import { deviceDisplayLabel } from '@/types/inspection'

/** 검사 ID — mono 폰트에서 # 누락 시에도 읽히도록 */
export function formatInspectionId(id: number): string {
  return `No.${id}`
}

/** 기종·실크 보드가 같으면 기종만 표시 */
export function modelBoardSubtitle(deviceId: string, silkBoardName?: string | null): string {
  const model = deviceDisplayLabel(deviceId)
  const board = (silkBoardName ?? '').trim()
  if (!board || board === model) return model
  return `${model} · ${board}`
}
