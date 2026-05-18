/**
 * 루트 애플리케이션 컴포넌트
 *
 * React Router의 라우팅 트리와 전체 레이아웃(Header + Sidebar + 콘텐츠)을 정의한다.
 */

import clsx from 'clsx'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Header from '@/components/common/Header'
import Sidebar from '@/components/common/Sidebar'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { DashboardScopeProvider } from '@/context/DashboardScopeContext'
import CumulativeStatsPage from '@/pages/CumulativeStatsPage'
import DashboardPage from '@/pages/DashboardPage'
import HistoryPage from '@/pages/HistoryPage'
import BoardReferencePage from '@/pages/BoardReferencePage'
import SettingsPage from '@/pages/SettingsPage'
import InspectionDetailPage from '@/pages/InspectionDetailPage'
import KioskPage from '@/pages/KioskPage'
import KioskInspectionCompletePage from '@/pages/KioskInspectionCompletePage'

export default function App() {
  const location = useLocation()
  const { settings } = useDashboardSettings()

  if (location.pathname.startsWith('/kiosk')) {
    return (
      <Routes>
        <Route path="/kiosk" element={<KioskPage />} />
        <Route path="/kiosk/complete/:inspectionId" element={<KioskInspectionCompletePage />} />
      </Routes>
    )
  }

  return (
    <div
      className={clsx(
        'dashboard-theme h-screen text-[var(--dash-text-primary)] overflow-hidden',
        settings.colorScheme === 'dark' && 'dashboard-theme--dark'
      )}
    >
      <DashboardScopeProvider>
      <div className="hmi-shell h-full w-full flex flex-col overflow-hidden">
        <Header />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <Sidebar />

          <main className="min-h-0 flex-1 overflow-hidden bg-[var(--dash-bg-deep)]">
            <Routes>
              <Route path="/" element={<CumulativeStatsPage />} />
              <Route path="/line" element={<DashboardPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/inspection/:inspectionId" element={<InspectionDetailPage />} />
              <Route path="/board-reference" element={<BoardReferencePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
      </DashboardScopeProvider>
    </div>
  )
}
