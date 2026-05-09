import { defectDisplayName } from '@/types/inspection'

export interface BoardReference {
  key: string
  label: string
  /** 엣지 API `board-reference/overlay.jpg?board=` 쿼리에 그대로 사용 */
  expectedCounts: Record<string, number>
}

// 확장: 항목 추가 시 기판 선택 목록에 자동 반영
export const BOARD_REFERENCES: BoardReference[] = [
  {
    key: 'GT_125A',
    label: 'GT-125A',
    expectedCounts: {
      mount_hole: 4,
      fiducial: 2,
      ic_chip: 2,
      smd_array_block: 2,
      edge_connector_zone: 2,
    },
  },
  {
    key: 'GN_948X',
    label: 'GN-948X',
    expectedCounts: {
      mount_hole: 4,
      fiducial: 2,
      connector: 2,
      group_connector: 2,
    },
  },
]

export function boardOverlayUrl(boardKey: string): string {
  const q = encodeURIComponent(boardKey)
  return `/edge/board-reference/overlay.jpg?board=${q}`
}

export function toCountRows(expectedCounts: Record<string, number>) {
  return Object.entries(expectedCounts).map(([cls, count]) => ({
    cls,
    label: defectDisplayName(cls),
    count,
  }))
}
