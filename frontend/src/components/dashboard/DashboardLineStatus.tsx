import clsx from 'clsx'
import type { InspectionLineStatus } from '@/types/inspection'
import { deviceDisplayLabel, inspectionResultLabel } from '@/types/inspection'

const EM_DASH = '\u2014'
const UNIT_SEC = '\uCD08'
const UNIT_MIN = '\uBD84'
const UNIT_HR = '\uC2DC\uAC04'
const LBL_LINE = '\uB77C\uC778'
const MSG_IDLE = '\uAC80\uC0AC \uC774\uB825 \uC5C6\uC74C \u00B7 \uB300\uAE30'
const LBL_LAST = '\uCD5C\uC885\uAC80\uC0AC'
const LBL_BEFORE = '\uC804'
const MSG_STALE = '5\uBD84+ \uBB34\uAC80\uC0AC'

function formatElapsed(seconds: number): string {
  if (seconds < 0) return EM_DASH
  if (seconds < 60) return `${seconds}${UNIT_SEC}`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}${UNIT_MIN}`
  return `${Math.floor(seconds / 3600)}${UNIT_HR}`
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
        <span className="font-semibold text-[var(--dash-text-primary)]">{LBL_LINE}</span>
        <span>{MSG_IDLE}</span>
      </div>
    )
  }

  const stale = status.stale
  const lastFail = status.lastFailAt

  return (
    <div
      className={clsx(
        'hmi-panel flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1.5 text-[11px]',
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

      <span className="text-[var(--dash-text-secondary)]">
        {LBL_LAST}{' '}
        <span className="dash-num text-[var(--dash-text-primary)]">
          {formatElapsed(status.secondsSinceLastInspection)} {LBL_BEFORE}
        </span>
        {status.lastResult && (
          <span
            className={clsx(
              'ml-1 font-bold',
              status.lastResult === 'PASS' ? 'text-[var(--dash-success)]' : 'text-[var(--dash-danger)]'
            )}
          >
            {inspectionResultLabel(status.lastResult)}
          </span>
        )}
      </span>

      {lastFail && (
        <span className="text-[var(--dash-danger)] font-semibold">
          FAIL {new Date(lastFail).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          {status.lastFailId != null && (
            <span className="dash-num font-normal text-[var(--dash-text-tertiary)] ml-1">
              #{status.lastFailId}
            </span>
          )}
        </span>
      )}

      {stale && (
        <span className="text-[var(--dash-warning)] font-bold border border-[var(--dash-warning)] px-1.5 py-0.5">
          {MSG_STALE}
        </span>
      )}
    </div>
  )
}
