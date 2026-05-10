/**
 * 루트 애플리케이션 컴포넌트
 *
 * React Router의 라우팅 트리와 전체 레이아웃(Header + Sidebar + 콘텐츠)을 정의한다.
 *
 * 레이아웃 구조:
 * ┌──────────────────────────── Header (h-16) ──────────────────────────────┐
 * │ ┌─ Sidebar ─┐  ┌──────────── <Outlet /> ──────────────────────────────┐ │
 * │ │  (w-56)   │  │  DashboardPage / HistoryPage / SettingsPage           │ │
 * │ │           │  │                                                        │ │
 * │ └───────────┘  └────────────────────────────────────────────────────────┘ │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import clsx from 'clsx'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Header from '@/components/common/Header'
import Sidebar from '@/components/common/Sidebar'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
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
    /* 전체 화면을 채우는 flex 컨테이너 */
    <div
      className={clsx(
        'dashboard-theme h-screen text-[var(--dash-text-primary)] p-4 md:p-6 overflow-hidden',
        settings.colorScheme === 'light' && 'dashboard-theme--light'
      )}
    >
      <div className="glass-panel h-full w-full max-w-[1600px] mx-auto rounded-[30px] overflow-hidden shadow-[var(--dash-glow)]">
        {/* 상단 고정 헤더 */}
        <Header />

        {/* 헤더 아래 본문 영역: 사이드바 + 페이지 */}
        <div className="flex h-[calc(100%-64px)] overflow-hidden">

          {/* 좌측 고정 사이드바 */}
          <Sidebar />

          {/* 우측 페이지 콘텐츠 (스크롤 가능) */}
          <main className="min-h-0 flex-1 overflow-hidden bg-transparent">
            <Routes>
              {/* 기본 경로: 대시보드 */}
              <Route path="/"         element={<DashboardPage />} />

              {/* 검사 이력 */}
              <Route path="/history"  element={<HistoryPage />} />

              {/* 검사 상세 (피듀셜·결함 오버레이) */}
              <Route path="/inspection/:inspectionId" element={<InspectionDetailPage />} />

              {/* 보드 기준(정상 이미지/기대 개수) */}
              <Route path="/board-reference" element={<BoardReferencePage />} />

              <Route path="/settings" element={<SettingsPage />} />

              {/* 정의되지 않은 경로는 루트로 리다이렉트 */}
              <Route path="*"         element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}
