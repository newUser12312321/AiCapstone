import clsx from 'clsx'
import type { InspectionLineStatus } from '@/types/inspection'
import { deviceDisplayLabel, inspectionResultLabel } from '@/types/inspection'

function formatElapsed(seconds: number): string {
  if (seconds < 0) return '\u2014'
  if (seconds < 60) return `${seconds}\uCD08`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}\uBD84`
  return `${Math.floor(seconds / 3600)}\uC2DC\uAC04`
}

export default function DashboardLineStatus({
  status,
  isLoading,
}: {
  status?: InspectionLineStatus
  isLoading?: boolean
}) {
  if (isLoading) {
    return <div className="hmi-panel h-9 animate-pulse bg-[var(--dash-bg-secondary)]" />
  }

  if (!status?.lastInspectedAt) {
    return (
      <div className="hmi-panel flex items-center gap-2 px-2 py-1.5 text-[11px] text-[var(--dash-text-secondary)]">
        <span className="inline-block w-2 h-2 bg-[var(--dash-text-tertiary)]" />
        <span className="font-semibold text-[var(--dash-text-primary)]">{'\uB77C\uC778'}</span>
        <span>{'\uAC80\uC0AC \uC774\uB825 \uC5C6\uC74C \u00B7 \uB300\uAE30'}</span>
      </div>
    )
  }

  const stale = status.stale
  const lastFail = status.lastFailAt
  const elapsed = formatElapsed(status.secondsSinceLastInspection)
  const result = status.lastResult

  return (
    <div
      className={clsx(
        'hmi-panel flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-[11px]',
        stale && 'border-[var(--dash-warning)] bg-[var(--dash-warning)]/10'
      )}
    >
      <span className="flex items-center gap-1.5 shrink-0">
        <span
          className={clsx(
            'inline-block w-2 h-2',
            stale ? 'bg-[var(--dash-warning)] animate-pulse' : 'bg-[var(--dash-success)]'
          )}
        />
        <span className="font-bold text-[var(--dash-text-primary)]">
          {deviceDisplayLabel(status.deviceId ?? '')}
        </span>
      </span>

      <span className="text-[var(--dash-text-secondary)] min-w-0">
        {'\uCD5C\uC885\uAC80\uC0AC'}{' '}
        <span className="dash-num text-[var(--dash-text-primary)]">{elapsed} {'\uC804'}</span>
        {result && (
          <span
            className={clsx(
              'ml-1 font-bold',
              result === 'PASS' ? 'text-[var(--dash-success)]' : 'text-[var(--dash-danger)]'
            )}
          >
            {inspectionResultLabel(result)}
          </span>
        )}
        {stale && (
          <span className="text-[var(--dash-warning)] font-semibold">
            {' \u00B7 '}5{'\uBD84 \uC774\uC0C1 \uC2E0\uADDC \uAC80\uC0AC \uC5C6\uC74C'}
          </span>
        )}
      </span>

      {lastFail && (
        <span className="text-[var(--dash-danger)] font-semibold shrink-0">
          {'\uCD5C\uADFC FAIL'}{' '}
          {new Date(lastFail).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          {status.lastFailId != null && (
            <span className="dash-num font-normal text-[var(--dash-text-tertiary)] ml-1">
              #{status.lastFailId}
            </span>
          )}
        </span>
      )}
    </div>
  )
}
