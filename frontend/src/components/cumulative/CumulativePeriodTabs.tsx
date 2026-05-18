import clsx from 'clsx'
import {
  CUMULATIVE_PERIOD_OPTIONS,
  type CumulativePeriod,
} from '@/utils/cumulativePeriod'

export default function CumulativePeriodTabs({
  value,
  onChange,
}: {
  value: CumulativePeriod
  onChange: (p: CumulativePeriod) => void
}) {
  return (
    <div className="flex items-stretch shrink-0 text-[11px] border border-[var(--dash-border)] bg-[var(--dash-surface)]">
      {CUMULATIVE_PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={clsx(
            'px-2.5 py-1.5 font-semibold border-r border-[var(--dash-border)] last:border-r-0',
            value === opt.id
              ? 'bg-[var(--dash-accent)] text-white'
              : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-secondary)]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
