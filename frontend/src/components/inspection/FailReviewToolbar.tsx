import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { patchInspectionReview } from '@/api/inspectionApi'
import type { ReviewStatusType } from '@/types/inspection'

interface FailReviewToolbarProps {
  inspectionId: number
  reviewStatus?: ReviewStatusType | null
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  queueIndex?: number
  queueTotal?: number
}

export default function FailReviewToolbar({
  inspectionId,
  reviewStatus,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  queueIndex,
  queueTotal,
}: FailReviewToolbarProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (status: ReviewStatusType) => patchInspectionReview(inspectionId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] })
    },
  })

  const current = reviewStatus ?? 'PENDING'

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-2">
      <div className="flex items-center gap-1 mr-2">
        <button
          type="button"
          disabled={!hasPrev}
          onClick={onPrev}
          className="p-1.5 rounded border border-[var(--dash-border)] disabled:opacity-40 hover:bg-[var(--dash-surface)]"
          title="이전 FAIL (↑)"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          disabled={!hasNext}
          onClick={onNext}
          className="p-1.5 rounded border border-[var(--dash-border)] disabled:opacity-40 hover:bg-[var(--dash-surface)]"
          title="다음 FAIL (↓)"
        >
          <ChevronRight size={16} />
        </button>
        {queueTotal != null && queueTotal > 0 && (
          <span className="text-xs text-[var(--dash-text-tertiary)] tabular-nums ml-1">
            {(queueIndex ?? 0) + 1} / {queueTotal}
          </span>
        )}
      </div>
      <span className="text-[10px] text-[var(--dash-text-tertiary)] hidden sm:inline">
        ←/→ 또는 j/k
      </span>
      <div className="flex flex-wrap gap-1.5 ml-auto">
        <ReviewBtn
          label="확인"
          active={current === 'CONFIRMED'}
          loading={mutation.isPending}
          onClick={() => mutation.mutate('CONFIRMED')}
          tone="ok"
          icon={Check}
        />
        <ReviewBtn
          label="오판"
          active={current === 'FALSE_CALL'}
          loading={mutation.isPending}
          onClick={() => mutation.mutate('FALSE_CALL')}
          tone="muted"
          icon={X}
        />
      </div>
    </div>
  )
}

function ReviewBtn({
  label,
  active,
  loading,
  onClick,
  tone,
  icon: Icon,
}: {
  label: string
  active: boolean
  loading: boolean
  onClick: () => void
  tone: 'ok' | 'muted'
  icon: typeof Check
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors',
        active && tone === 'ok' && 'bg-[var(--dash-success)]/15 border-[var(--dash-success)]/50 text-[var(--dash-success)]',
        active && tone === 'muted' && 'bg-[var(--dash-bg-secondary)] border-[var(--dash-border)] text-[var(--dash-text-primary)]',
        !active && 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]'
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
