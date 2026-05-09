/**
 * 상단 헤더 컴포넌트
 *
 * 서비스명, 라이브 상태 표시 인디케이터, 마지막 갱신 시각을 표시한다.
 * useStats()의 isLoading/isFetching 상태로 실시간 갱신 여부를 시각화한다.
 */

import { Activity, Cpu } from 'lucide-react'
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

      {/* 서비스 로고 + 이름 */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-[var(--dash-accent)] to-indigo-500 rounded-full flex items-center justify-center shadow-[var(--dash-shadow-soft)]">
          <Cpu size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-[var(--dash-text-primary)] leading-none tracking-tight">라즈베리파이 기반 PCB 비전 검사 시스템</h1>
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
