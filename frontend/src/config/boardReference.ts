import { defectDisplayName } from '@/types/inspection'

export interface BoardReference {
  key: string
  label: string
  expectedCounts: Record<string, number>
  /** 두 피듀셜 마크 중심 간 실측 거리 (mm) */
  fiducialMarkSpacingMm?: number
}

/** Vite `base` 반영 (Docker 서브경로 등). `public/board-reference/` 정적 파일용 */
export function publicAsset(relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, '')
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? `${base}${normalized}` : `${base}/${normalized}`
}

// 확장: 항목 추가 시 기판 선택 목록에 자동 반영
export const BOARD_REFERENCES: BoardReference[] = [
  {
    key: 'GT_125A',
    label: 'GT-125A',
    fiducialMarkSpacingMm: 140,
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
    fiducialMarkSpacingMm: 117,
    expectedCounts: {
      mount_hole: 4,
      fiducial: 2,
      connector: 2,
      group_connector: 2,
    },
  },
]

const OVERLAY_FILES: Record<string, string> = {
  GT_125A: 'board-reference/gt125a_overlay.jpg',
  GN_948X: 'board-reference/gn948x_overlay.jpg',
}

/** 클라우드 배포용: 빌드에 포함된 사전 렌더 오버레이 (라즈베리 미기동 가능) */
export function boardOverlayUrl(boardKey: string): string {
  const rel = OVERLAY_FILES[boardKey] ?? OVERLAY_FILES.GT_125A
  return publicAsset(rel)
}

export const BOARD_REFERENCE_CALIBRATION_URL = publicAsset('board-reference/calibration.json')

export function toCountRows(expectedCounts: Record<string, number>) {
  return Object.entries(expectedCounts).map(([cls, count]) => ({
    cls,
    label: defectDisplayName(cls),
    count,
  }))
}
