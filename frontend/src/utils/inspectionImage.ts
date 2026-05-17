/**
 * 검사 캡처 이미지 URL
 * - `/captures/*` → Vite 프록시(edge uvicorn) 또는 dev 시 로컬 edge/captures
 * - `/api/.../images/*` → Spring Boot 정적 이미지
 */

export function resolveImageSrc(imagePath: string | null): string | null {
  if (!imagePath) return null
  const p = imagePath.replace(/\\/g, '/').trim()
  if (!p) return null

  if (p.startsWith('http://') || p.startsWith('https://')) return p

  if (p.startsWith('/api/')) return p

  const capturesIdx = p.toLowerCase().indexOf('/captures/')
  if (capturesIdx >= 0) {
    return p.slice(capturesIdx)
  }
  if (p.toLowerCase().startsWith('captures/')) {
    return `/${p}`
  }

  const apiImg = p.match(/\/api\/v\d+\/inspections\/images\/(.+)$/i)
  if (apiImg) return p.startsWith('/') ? p : `/${p}`

  const apiImgShort = p.match(/\/inspections\/images\/(.+)$/i)
  if (apiImgShort) {
    return `/api/v1/inspections/images/${apiImgShort[1]}`
  }

  const fileName = p.split('/').pop() ?? p
  if (/\.(jpe?g|png|webp|bmp)$/i.test(fileName)) {
    if (!p.includes('/')) return `/captures/${fileName}`
    return `/captures/${fileName}`
  }

  if (p.startsWith('/')) return p
  return null
}

/** 보정 후(`_aligned` / `_deskew`) → 촬영 원본 파일명 */
export function deriveRawImagePathFromStored(stored: string | null): string | null {
  if (!stored) return null
  const p = stored.replace(/\\/g, '/')
  const last = p.lastIndexOf('/')
  const dir = last >= 0 ? p.slice(0, last + 1) : ''
  const file = last >= 0 ? p.slice(last + 1) : p
  for (const tag of ['_deskew', '_aligned']) {
    const re = new RegExp(`^(.+)${tag}(\\.[^.]+)$`, 'i')
    const m = file.match(re)
    if (m) return `${dir}${m[1]}${m[2]}`
  }
  return null
}

export type ImageSourceKind = 'captures' | 'api' | 'remote' | 'unknown'

export function classifyImageSource(resolvedSrc: string | null): ImageSourceKind {
  if (!resolvedSrc) return 'unknown'
  if (resolvedSrc.startsWith('http://') || resolvedSrc.startsWith('https://')) return 'remote'
  if (resolvedSrc.startsWith('/api/')) return 'api'
  if (resolvedSrc.startsWith('/captures/')) return 'captures'
  return 'unknown'
}

/** 이미지 onError 시 표시할 안내 문구 */
export function imageLoadErrorHint(
  storedPath: string | null,
  resolvedSrc: string | null
): string {
  const kind = classifyImageSource(resolvedSrc)
  if (kind === 'api') {
    return 'Spring Boot(:8080)가 실행 중인지, DB에 저장된 파일명이 inspection-images 폴더에 있는지 확인하세요.'
  }
  if (kind === 'captures') {
    return (
      'edge uvicorn(:8000) 실행 여부와 frontend/.env 의 VITE_EDGE_CAPTURE_URL(Pi IP)을 확인하세요. ' +
      'PC에서만 검사한 이력이면 edge/captures 에 해당 JPG가 있어야 하며, dev 서버는 로컬 captures 폴더도 자동으로 찾습니다.'
    )
  }
  if (kind === 'remote') {
    return '외부 저장소(GCS 등) URL에 브라우저에서 접근 가능한지 확인하세요.'
  }
  if (storedPath) {
    return `저장 경로를 브라우저 URL로 바꾸지 못했습니다: ${storedPath.slice(0, 120)}`
  }
  return '이미지 경로가 비어 있습니다.'
}
