/**
 * 상단 헤더 컴포넌트
 *
 * 서비스명, 라이브 상태 표시 인디케이터, 마지막 갱신 시각을 표시한다.
 * useStats()의 isLoading/isFetching 상태로 실시간 갱신 여부를 시각화한다.
 */

import { Activity } from 'lucide-react'
import raspberryPiIcon from '@/assets/raspberry-pi-icon.webp'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useStats } from '@/hooks/useInspectionData'

export default function Header() {
  const { formatSplitDateTime } = useDashboardSettings()
  const { isFetching, dataUpdatedAt } = useStats()

  /* dataUpdatedAt: 마지막으로 서버에서 데이터를 받은 Unix 타임스탬프(ms) */
  const lastUpdated =
    dataUpdatedAt != null
      ? (() => {
          const { date, time } = formatSplitDateTime(
            new Date(dataUpdatedAt).toISOString()
          )
          return time ? `${date} ${time}` : date
        })()
      : '--'

  return (
    <header className="h-16 bg-[var(--dash-surface-strong)]/60 border-b border-[var(--dash-border)] backdrop-blur-md flex items-center px-6 shrink-0">

      {/* 시스템 브랜드 */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center overflow-hidden bg-white p-1.5 shadow-[0_8px_28px_rgba(139,92,246,0.35)] ring-1 ring-white/15"
          aria-hidden
        >
          <img
            src={raspberryPiIcon}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain select-none"
            draggable={false}
          />
        </div>
        <div className="min-w-0 py-0.5">
          <h1
            className="
              text-xl sm:text-2xl font-extrabold leading-tight tracking-tight
              bg-gradient-to-r from-[var(--dash-text-primary)] via-[var(--dash-accent)] to-[var(--dash-info)]
              bg-clip-text text-transparent
              drop-shadow-[0_0_24px_rgba(139,92,246,0.25)]
            "
          >
            PCB 비전 검사 시스템
          </h1>
        </div>
      </div>

      {/* 오른쪽 영역: 라이브 상태 + 갱신 시각 */}
      <div className="ml-auto flex items-center gap-3">

        {/* 실시간 폴링 상태 인디케이터 */}
        <div className="glass-panel-subtle flex items-center gap-2 rounded-full px-3 py-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isFetching ? 'bg-[var(--dash-warning)] animate-pulse' : 'bg-[var(--dash-success)]'
            }`}
          />
          <span className="text-xs font-medium text-[var(--dash-text-secondary)]">
            {isFetching ? '갱신 중...' : 'LIVE'}
          </span>
        </div>

        {/* 마지막 데이터 갱신 시각 */}
        <div className="glass-panel-subtle flex items-center gap-1.5 text-xs text-[var(--dash-text-tertiary)] rounded-full px-3 py-1.5">
          <Activity size={12} />
          <span>최종 갱신: {lastUpdated}</span>
        </div>
      </div>
    </header>
  )
}
