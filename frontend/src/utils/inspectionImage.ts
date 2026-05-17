/**
 * 검사 캡처 이미지 URL
 * - `/captures/*` → Vite 프록시(edge uvicorn) 또는 dev 시 로컬 edge/captures
 * - `/api/.../images/*` → Spring Boot 정적 이미지
 * - `VITE_API_BASE_URL` 이 GCP VM 등을 가리키면 `<img src>` 도 동일 호스트로 요청
 */

/** `VITE_API_BASE_URL`(예: http://VM:8080/api) → http://VM:8080 */
export function getApiPublicOrigin(): string | null {
  const base = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!base) return null
  try {
    return new URL(base, typeof window !== 'undefined' ? window.location.origin : undefined).origin
  } catch {
    return null
  }
}

function absolutizeApiPath(relativeApiPath: string): string {
  const origin = getApiPublicOrigin()
  if (!origin) return relativeApiPath
  return `${origin}${relativeApiPath}`
}

export function resolveImageSrc(imagePath: string | null): string | null {
  if (!imagePath) return null
  const p = imagePath.replace(/\\/g, '/').trim()
  if (!p) return null

  if (p.startsWith('http://') || p.startsWith('https://')) return p

  if (p.startsWith('/api/')) return absolutizeApiPath(p)

  const capturesIdx = p.toLowerCase().indexOf('/captures/')
  if (capturesIdx >= 0) {
    return p.slice(capturesIdx)
  }
  if (p.toLowerCase().startsWith('captures/')) {
    return `/${p}`
  }

  const apiImg = p.match(/\/api\/v\d+\/inspections\/images\/(.+)$/i)
  if (apiImg) return absolutizeApiPath(p.startsWith('/') ? p : `/${p}`)

  const apiImgShort = p.match(/\/inspections\/images\/(.+)$/i)
  if (apiImgShort) {
    return absolutizeApiPath(`/api/v1/inspections/images/${apiImgShort[1]}`)
  }

  const fileName = p.split('/').pop() ?? p
  if (/\.(jpe?g|png|webp|bmp)$/i.test(fileName)) {
    if (!p.includes('/')) return `/captures/${fileName}`
    return `/captures/${fileName}`
  }

  if (p.startsWith('/')) {
    return p.startsWith('/api/') ? absolutizeApiPath(p) : p
  }
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
    const origin = getApiPublicOrigin()
    const direct = origin && resolvedSrc?.startsWith('http') ? resolvedSrc : null
    return [
      'Spring Boot가 실행 중인지, VM/서버의 inspection-images(또는 컨테이너 /app/inspection-images)에 파일이 있는지 확인하세요.',
      direct
        ? `브라우저에서 직접 열어 보기: ${direct}`
        : 'PC에서 npm run dev만 쓰는 경우 frontend/.env 에 VITE_API_BASE_URL=http://<VM-IP>:8080/api 를 넣고 dev 서버를 재시작하세요.',
    ].join(' ')
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
