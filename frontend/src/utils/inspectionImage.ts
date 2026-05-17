/**
 * 검사 캡처 이미지 URL (Vite `/captures` 프록시)
 */

export function resolveImageSrc(imagePath: string | null): string | null {
  if (!imagePath) return null
  const p = imagePath.replace(/\\/g, '/')
  if (p.startsWith('http://') || p.startsWith('https://')) return p

  let relative: string
  if (p.startsWith('/captures/')) {
    relative = p
  } else if (p.startsWith('captures/')) {
    relative = `/${p}`
  } else {
    const capturesIndex = p.indexOf('/captures/')
    relative = capturesIndex >= 0 ? p.slice(capturesIndex) : p
  }

  if (relative.startsWith('/')) return relative
  return relative.startsWith('captures/') ? `/${relative}` : relative
}

/** `타임스탬프_deskew.jpg` ↔ 원본 `타임스탬프.jpg` */
export function deriveRawImagePathFromStored(stored: string | null): string | null {
  if (!stored) return null
  const p = stored.replace(/\\/g, '/')
  const last = p.lastIndexOf('/')
  const dir = last >= 0 ? p.slice(0, last + 1) : ''
  const file = last >= 0 ? p.slice(last + 1) : p
  const m = file.match(/^(.+)_deskew(\.[^.]+)$/)
  if (!m) return null
  return `${dir}${m[1]}${m[2]}`
}
