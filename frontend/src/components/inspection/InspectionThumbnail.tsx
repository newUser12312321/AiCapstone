import clsx from 'clsx'
import { ImageOff } from 'lucide-react'
import type { InspectionResultType } from '@/types/inspection'
import { resolveImageSrc } from '@/utils/inspectionImage'

interface InspectionThumbnailProps {
  imagePath: string | null
  result: InspectionResultType
  size?: number
  className?: string
}

export default function InspectionThumbnail({
  imagePath,
  result,
  size = 48,
  className,
}: InspectionThumbnailProps) {
  const src = resolveImageSrc(imagePath)
  const fail = result === 'FAIL'

  return (
    <div
      className={clsx(
        'shrink-0 overflow-hidden rounded border bg-[var(--dash-bg-secondary)]',
        fail ? 'border-[var(--dash-danger)]' : 'border-[var(--dash-border)]',
        className
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[var(--dash-text-tertiary)]">
          <ImageOff size={size > 40 ? 18 : 14} />
        </div>
      )}
    </div>
  )
}
