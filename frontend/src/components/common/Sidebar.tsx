/**
 * 좌측 HMI 네비게이션 — 텍스트 메뉴, 최소 장식
 */

import { NavLink } from 'react-router-dom'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/', label: '누적 통계', end: true },
  { to: '/line', label: '라인 모니터', end: true },
  { to: '/history', label: '검사 로그', end: false },
  { to: '/board-reference', label: '기판 프로그램', end: false },
  { to: '/settings', label: '시스템 설정', end: false },
] as const

export default function Sidebar() {
  return (
    <aside className="w-40 shrink-0 flex flex-col border-r border-[var(--dash-border)] bg-[var(--dash-bg-secondary)]">
      <p className="px-2 py-1.5 text-[10px] font-bold text-[var(--dash-text-tertiary)] border-b border-[var(--dash-border)] bg-[var(--dash-bg-primary)]">
        메뉴
      </p>
      <nav className="flex flex-col">
        {NAV_ITEMS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'px-2 py-2 text-[12px] font-medium border-b border-[var(--dash-border)]/60',
                isActive
                  ? 'bg-[var(--dash-accent)] text-white'
                  : 'text-[var(--dash-text-primary)] hover:bg-[var(--dash-surface)]'
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
