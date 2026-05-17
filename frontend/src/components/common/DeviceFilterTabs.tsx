import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { InspectionLog } from '@/types/inspection'
import { deviceDisplayLabel } from '@/types/inspection'
import { uniqueDeviceIds } from '@/utils/inspectionSummary'

interface DeviceFilterTabsProps {
  logs?: InspectionLog[]
  devices?: string[]
  value: string
  onChange: (deviceId: string) => void
  className?: string
}

export default function DeviceFilterTabs({
  logs = [],
  devices: devicesProp,
  value,
  onChange,
  className,
}: DeviceFilterTabsProps) {
  const devices = devicesProp ?? uniqueDeviceIds(logs)

  if (devices.length === 0) return null

  return (
    <div
      className={clsx('flex flex-wrap items-center gap-0', className)}
      role="tablist"
      aria-label="기종 필터"
    >
      <TabButton active={!value} onClick={() => onChange('')}>
        전체
      </TabButton>
      {devices.map((id) => (
        <TabButton key={id} active={value === id} onClick={() => onChange(id)}>
          {deviceDisplayLabel(id)}
        </TabButton>
      ))}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        'px-2.5 py-1 text-[11px] font-medium border border-[var(--dash-border)] -ml-px first:ml-0',
        active
          ? 'bg-[var(--dash-accent)] text-white border-[var(--dash-accent)] z-[1] relative'
          : 'bg-[var(--dash-surface)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-secondary)]'
      )}
    >
      {children}
    </button>
  )
}
