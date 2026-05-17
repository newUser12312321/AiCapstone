/**
 * 좌측 사이드바 네비게이션 컴포넌트
 *
 * React Router의 NavLink를 사용하여 현재 활성 경로를 강조 표시한다.
 * 각 메뉴 항목은 lucide-react 아이콘 + 한글 레이블로 구성된다.
 */

import { NavLink } from 'react-router-dom'
import { BarChart2, ClipboardList, Layers3, Settings } from 'lucide-react'
import clsx from 'clsx'

/** 네비게이션 메뉴 항목 정의 */
const NAV_ITEMS = [
  {
    to:    '/',
    icon:  BarChart2,
    label: '라인 모니터',
    subtitle: '당일 수율·FAIL',
    end:   true,
  },
  {
    to:    '/history',
    icon:  ClipboardList,
    label: '검사 로그',
    subtitle: 'FAIL 리뷰',
    end:   false,
  },
  {
    to:    '/board-reference',
    icon:  Layers3,
    label: '기판 프로그램',
    subtitle: '마스터·스펙',
    end:   false,
  },
  {
    to:    '/settings',
    icon:  Settings,
    label: '시스템 설정',
    subtitle: '품질·알람',
    end:   false,
  },
] as const

export default function Sidebar() {
  return (
    <aside className="w-60 bg-[var(--dash-bg-secondary)] border-r border-[var(--dash-border)] flex flex-col py-4 shrink-0">

      {/* 네비게이션 메뉴 */}
      <nav className="flex flex-col gap-1.5 px-3">
        {NAV_ITEMS.map(({ to, icon: Icon, label, subtitle, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--dash-accent)] text-white shadow-sm'
                  : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)] hover:text-[var(--dash-text-primary)] border border-transparent hover:border-[var(--dash-border-soft)]'
              )
            }
          >
            <Icon size={18} className="shrink-0" />
            <span className="min-w-0">
              <span className="block leading-tight">{label}</span>
              <span className={clsx('block text-[10px] font-normal opacity-80')}>{subtitle}</span>
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
