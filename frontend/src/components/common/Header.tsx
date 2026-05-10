/**
 * 상단 헤더 컴포넌트
 *
 * 서비스명, 라이브 상태 표시 인디케이터, 마지막 갱신 시각을 표시한다.
 * useStats()의 isLoading/isFetching 상태로 실시간 갱신 여부를 시각화한다.
 * 임계값 알림 시 배지·토스트를 표시한다.
 */

import { useEffect, useRef, useState } from 'react'
import { Activity, Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import raspberryPiIcon from '@/assets/raspberry-pi-icon.webp'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useStats } from '@/hooks/useInspectionData'
import { useDashboardAlerts } from '@/hooks/useDashboardAlerts'

export default function Header() {
  const { formatSplitDateTime } = useDashboardSettings()
  const { isFetching, dataUpdatedAt } = useStats()
  const alerts = useDashboardAlerts()
  const [toast, setToast] = useState<string | null>(null)
  const prevAlertKey = useRef('')

  useEffect(() => {
    const key = alerts.join('||')
    if (!key) {
      prevAlertKey.current = ''
      setToast(null)
      return
    }
    if (key === prevAlertKey.current) return
    prevAlertKey.current = key
    setToast(alerts.join(' · '))
    const t = window.setTimeout(() => setToast(null), 8000)
    return () => window.clearTimeout(t)
  }, [alerts])

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
    <>
      <header className="h-16 bg-[var(--dash-surface-strong)]/60 border-b border-[var(--dash-border)] backdrop-blur-md flex items-center px-6 shrink-0">

        <div className="flex items-center gap-3.5 min-w-0">
          <Link
            to="/"
            title="메인 대시보드로 이동"
            className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center overflow-hidden bg-white p-1.5 shadow-[0_8px_28px_rgba(139,92,246,0.35)] ring-1 ring-white/15 transition-transform hover:scale-105 hover:ring-[var(--dash-accent)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]/50"
          >
            <img
              src={raspberryPiIcon}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain select-none pointer-events-none"
              draggable={false}
            />
          </Link>
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

        <div className="ml-auto flex items-center gap-3">

          {alerts.length > 0 && (
            <div
              className="glass-panel-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[var(--dash-warning)]"
              title={alerts.join('\n')}
            >
              <Bell size={14} className="shrink-0" />
              <span className="text-xs font-semibold">알림 {alerts.length}</span>
            </div>
          )}

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

          <div className="glass-panel-subtle flex items-center gap-1.5 text-xs text-[var(--dash-text-tertiary)] rounded-full px-3 py-1.5">
            <Activity size={12} />
            <span>최종 갱신: {lastUpdated}</span>
          </div>
        </div>
      </header>

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-[200] max-w-md rounded-2xl border border-[var(--dash-warning)]/40 bg-[var(--dash-surface-strong)] px-4 py-3 text-sm text-[var(--dash-text-primary)] shadow-[var(--dash-shadow-soft)]"
        >
          <p className="text-xs font-semibold text-[var(--dash-warning)] mb-1">운영 알림</p>
          <p className="text-[var(--dash-text-secondary)] leading-snug">{toast}</p>
        </div>
      )}
    </>
  )
}
