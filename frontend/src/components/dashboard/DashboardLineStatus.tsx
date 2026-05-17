import clsx from 'clsx'
import { Activity, AlertTriangle, Clock } from 'lucide-react'
import type { InspectionLineStatus } from '@/types/inspection'
import { deviceDisplayLabel, inspectionResultLabel } from '@/types/inspection'

function formatElapsed(seconds: number): string {
  if (seconds < 0) return '—'
  if (seconds < 60) return `${seconds}초 전`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`
  return `${Math.floor(seconds / 3600)}시간 전`
}

export default function DashboardLineStatus({
  status,
  isLoading,
}: {
  status?: InspectionLineStatus
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="h-14 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] animate-pulse" />
    )
  }
  if (!status?.lastInspectedAt) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-3 text-xs text-[var(--dash-text-secondary)]">
        <Activity size={16} className="text-[var(--dash-text-tertiary)]" />
        검사 이력 없음 — 라인 대기 중
      </div>
    )
  }

  const stale = status.stale
  const lastFail = status.lastFailAt

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-3 text-xs',
        stale
          ? 'border-[var(--dash-warning)]/50 bg-[var(--dash-warning)]/8'
          : 'border-[var(--dash-border)] bg-[var(--dash-surface)]'
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            'inline-flex h-2 w-2 rounded-full',
            stale ? 'bg-[var(--dash-warning)] animate-pulse' : 'bg-[var(--dash-success)]'
          )}
        />
        <span className="font-semibold text-[var(--dash-text-primary)]">
          {deviceDisplayLabel(status.deviceId ?? '')}
        </span>
        <span className="text-[var(--dash-text-tertiary)]">라인</span>
      </div>
      <div className="flex items-center gap-1.5 text-[var(--dash-text-secondary)]">
        <Clock size={14} />
        마지막 검사 {formatElapsed(status.secondsSinceLastInspection)}
        {status.lastResult && (
          <span
            className={clsx(
              'ml-1 font-semibold',
              status.lastResult === 'PASS' ? 'text-[var(--dash-success)]' : 'text-[var(--dash-danger)]'
            )}
          >
            {inspectionResultLabel(status.lastResult)}
          </span>
        )}
      </div>
      {lastFail && (
        <div className="flex items-center gap-1.5 text-[var(--dash-danger)]">
          <AlertTriangle size={14} />
          최근 FAIL {new Date(lastFail).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          {status.lastFailId != null && (
            <span className="text-[var(--dash-text-tertiary)]">#{status.lastFailId}</span>
          )}
        </div>
      )}
      {stale && (
        <span className="text-[var(--dash-warning)] font-medium">5분 이상 신규 검사 없음</span>
      )}
    </div>
  )
}
