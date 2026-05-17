import { AlertCircle } from 'lucide-react'
import type { InspectionLog } from '@/types/inspection'
import { defectDisplayName, DEFECT_COLOR } from '@/types/inspection'

type GroupedDefectTag = {
  count: number
  color: string
  label: string
  isMissing: boolean
}

function groupDefectTags(defects: InspectionLog['defects']): GroupedDefectTag[] {
  const grouped = new Map<string, GroupedDefectTag>()
  defects.forEach((d) => {
    const key = `${d.defectType}\0${d.detail?.trim() ?? ''}`
    const label = defectDisplayName(d.defectType, d.detail)
    const prev = grouped.get(key)
    if (prev) {
      prev.count += 1
      return
    }
    grouped.set(key, {
      count: 1,
      color: DEFECT_COLOR[d.defectType] ?? '#9ca3af',
      label,
      isMissing: d.defectType.startsWith('MISSING:'),
    })
  })
  return Array.from(grouped.values()).sort((a, b) => {
    if (a.isMissing !== b.isMissing) return a.isMissing ? -1 : 1
    return b.count - a.count
  })
}

function DefectTagChip({ meta }: { meta: GroupedDefectTag }) {
  const text = `${meta.label} X${meta.count}`
  return (
    <span
      className="inline-flex min-w-0 max-w-[9.5rem] items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
      title={text}
    >
      <AlertCircle size={10} className="shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  )
}

export default function DefectTags({
  defects,
  variant = 'full',
}: {
  defects: InspectionLog['defects']
  variant?: 'full' | 'table'
}) {
  if (!defects.length) return <span className="text-xs text-[var(--dash-text-tertiary)]">—</span>

  const items = groupDefectTags(defects)
  const tooltip = items.map((m) => `${m.label} X${m.count}`).join(', ')

  if (variant === 'table') {
    const dense = items.length > 2 || items.some((m) => m.label.length > 28)
    if (dense) {
      const primary = items[0]
      const rest = items.length - 1
      return (
        <div className="flex min-w-0 max-w-[15rem] items-center gap-1 overflow-hidden" title={tooltip}>
          <DefectTagChip meta={primary} />
          {rest > 0 && (
            <span className="shrink-0 rounded bg-[var(--dash-bg-secondary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--dash-text-secondary)]">
              +{rest}종
            </span>
          )}
        </div>
      )
    }
    return (
      <div className="flex min-w-0 max-w-[15rem] flex-nowrap items-center gap-1 overflow-hidden" title={tooltip}>
        {items.slice(0, 2).map((meta, i) => (
          <DefectTagChip key={`${meta.label}-${i}`} meta={meta} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-1" title={tooltip}>
      {items.map((meta, i) => (
        <DefectTagChip key={`${meta.label}-${i}`} meta={meta} />
      ))}
    </div>
  )
}
