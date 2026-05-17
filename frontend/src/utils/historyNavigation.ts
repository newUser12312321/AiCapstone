/**
 * 검사 이력 페이지(/history) 쿼리 — 대시보드·차트에서 동일 필터로 이동할 때 사용
 */

import type { InspectionResultType, WorkShift } from '@/types/inspection'

export function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type HistoryQuery = {
  from?: string
  to?: string
  /** URL에는 PASS/FAIL만 저장. ALL 은 키 생략 */
  result?: 'ALL' | InspectionResultType
  device?: string
  board?: string
  /** defectDisplayName 과 동일한 표시 문자열 */
  defect?: string
  /** 로컬 시 기준 시간대(0–23), 해당 시각에 검사된 행만 */
  hour?: number
  /** 상세 패널을 열 검사 ID */
  open?: number
  /** 작업 교대 (서버 inspectedAt 시각 기준) */
  shift?: WorkShift
  /** 목록 페이지 (0-based) */
  page?: number
}

function setParam(sp: URLSearchParams, key: string, value: string | undefined) {
  if (value === undefined || value === '') {
    sp.delete(key)
    return
  }
  sp.set(key, value)
}

/** React Router용 `?a=1&b=2` 문자열 (선행 ? 없음) */
export function buildHistorySearchString(q: HistoryQuery): string {
  const sp = new URLSearchParams()
  setParam(sp, 'from', q.from)
  setParam(sp, 'to', q.to)
  if (q.result && q.result !== 'ALL') sp.set('result', q.result as InspectionResultType)
  setParam(sp, 'device', q.device)
  setParam(sp, 'board', q.board)
  if (q.defect) sp.set('defect', q.defect)
  if (q.hour != null && q.hour >= 0 && q.hour <= 23) sp.set('hour', String(q.hour))
  if (q.open != null && Number.isFinite(q.open)) sp.set('open', String(q.open))
  if (q.shift) sp.set('shift', q.shift)
  if (q.page != null && q.page > 0) sp.set('page', String(q.page))
  const s = sp.toString()
  return s
}

export function buildHistoryPath(q: HistoryQuery): string {
  const s = buildHistorySearchString(q)
  return s ? `/history?${s}` : '/history'
}

/** 단일 검사 상세 화면 — React Router `state.returnTo`로 닫기 시 복귀 경로 전달 권장 */
export function inspectionDetailPath(inspectionId: number): string {
  return `/inspection/${inspectionId}`
}

export function parseHistoryQuery(searchParams: URLSearchParams): HistoryQuery {
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined
  const r = searchParams.get('result')
  const result =
    r === 'PASS' || r === 'FAIL' ? r : undefined
  const device = searchParams.get('device') ?? undefined
  const board = searchParams.get('board') ?? undefined
  const defect = searchParams.get('defect') ?? undefined
  const h = searchParams.get('hour')
  let hour: number | undefined
  if (h != null) {
    const n = Number.parseInt(h, 10)
    if (!Number.isNaN(n) && n >= 0 && n <= 23) hour = n
  }
  const o = searchParams.get('open')
  let open: number | undefined
  if (o != null) {
    const n = Number.parseInt(o, 10)
    if (!Number.isNaN(n)) open = n
  }
  const shiftRaw = searchParams.get('shift')
  const shift =
    shiftRaw === 'DAY' || shiftRaw === 'SWING' || shiftRaw === 'NIGHT' ? shiftRaw : undefined
  const pg = searchParams.get('page')
  let page: number | undefined
  if (pg != null) {
    const n = Number.parseInt(pg, 10)
    if (!Number.isNaN(n) && n >= 0) page = n
  }
  return {
    from: from || undefined,
    to: to || undefined,
    result: result ?? 'ALL',
    device,
    board,
    defect,
    hour,
    open,
    shift,
    page,
  }
}
