import type { InspectionSearchParams, WorkShift } from '@/types/inspection'
import type { HistoryQuery } from '@/utils/historyNavigation'
import { getLocalDateString } from '@/utils/historyNavigation'

export function historyToSearchParams(
  q: HistoryQuery,
  opts?: { page?: number; size?: number; defectAsType?: boolean }
): InspectionSearchParams {
  const today = getLocalDateString()
  const from = q.from || today
  const to = q.to !== undefined && q.to !== '' ? q.to : today
  return {
    page: opts?.page ?? 0,
    size: opts?.size ?? 50,
    from,
    to,
    deviceId: q.device,
    result: q.result === 'ALL' ? undefined : q.result,
    board: q.board,
    shift: q.shift,
    defectType: opts?.defectAsType ? q.defect : undefined,
  }
}

export function shiftLabel(shift: WorkShift): string {
  switch (shift) {
    case 'DAY':
      return '주간 (06–14)'
    case 'SWING':
      return '교대 (14–22)'
    case 'NIGHT':
      return '야간 (22–06)'
    default:
      return shift
  }
}
