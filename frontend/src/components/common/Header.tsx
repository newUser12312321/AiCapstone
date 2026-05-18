/**
 * 상단 HMI 헤더 — 시스템명, LIVE, 갱신 시각
 */

import { Link } from 'react-router-dom'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useStats } from '@/hooks/useInspectionData'

export default function Header() {
  const { formatSplitDateTime } = useDashboardSettings()
  const { isFetching, dataUpdatedAt } = useStats()

  const lastUpdated =
    dataUpdatedAt != null
      ? (() => {
          const { date, time } = formatSplitDateTime(new Date(dataUpdatedAt).toISOString())
          return time ? `${date} ${time}` : date
        })()
      : '--'

  return (
    <header className="h-[var(--dash-header-h)] shrink-0 flex items-stretch border-b border-[var(--dash-border)] bg-[var(--dash-surface-strong)] text-[#e8eaed]">
      <Link
        to="/"
        className="flex items-center px-3 border-r border-[#3a424e] hover:bg-[#323840] focus:outline-none focus:bg-[#323840]"
        title="PCB 자동광학 검사 시스템"
      >
        <span className="text-[13px] font-bold tracking-tight whitespace-nowrap">
          PCB 자동광학 검사 시스템
        </span>
      </Link>

      <div className="flex-1 flex items-center min-w-0 px-3 gap-4 text-[11px]">
        <span className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-block w-2 h-2 ${
              isFetching ? 'bg-[var(--dash-warning)] animate-pulse' : 'bg-[var(--dash-success)]'
            }`}
          />
          <span className="font-semibold">{isFetching ? '갱신중' : 'LIVE'}</span>
        </span>
        <span className="text-[#a8b0bb] tabular-nums shrink-0">
          갱신 <span className="dash-num text-[#e8eaed]">{lastUpdated}</span>
        </span>
      </div>

      <div className="flex items-stretch border-l border-[#3a424e] text-[11px]">
        <Link
          to="/history"
          className="px-3 flex items-center hover:bg-[#323840] text-[#c8ced6]"
        >
          검사로그
        </Link>
        <Link
          to="/settings"
          className="px-3 flex items-center border-l border-[#3a424e] hover:bg-[#323840] text-[#c8ced6]"
        >
          설정
        </Link>
      </div>
    </header>
  )
}
