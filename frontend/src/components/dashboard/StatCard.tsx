/**
 * 통계 요약 카드 컴포넌트
 *
 * 대시보드 상단에 4개 배치되어 전체 검사 건수, 합격, 불합격, 불량률을 표시한다.
 * 로딩 중에는 Skeleton 애니메이션을 보여준다.
 */

import type { LucideIcon } from 'lucide-react'
import { CheckCircle, XCircle, Activity, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { useStats } from '@/hooks/useInspectionData'

// ── 개별 카드 컴포넌트 ────────────────────────────────────────────────────────

interface StatCardProps {
  title:   string
  value:   string | number
  icon:    LucideIcon
  /** 아이콘 배경 + 텍스트 색상 테마 */
  theme:   'indigo' | 'green' | 'red' | 'yellow'
  /** 카드 하단에 표시할 보조 설명 (선택) */
  caption?: string
}

const THEME_MAP: Record<StatCardProps['theme'], { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-[var(--dash-accent)]/18', text: 'text-[var(--dash-accent)]', border: 'border-[var(--dash-accent)]/30' },
  green:  { bg: 'bg-[var(--dash-success)]/16', text: 'text-[var(--dash-success)]', border: 'border-[var(--dash-success)]/28'  },
  red:    { bg: 'bg-[var(--dash-danger)]/16', text: 'text-[var(--dash-danger)]', border: 'border-[var(--dash-danger)]/28'    },
  yellow: { bg: 'bg-[var(--dash-warning)]/14', text: 'text-[var(--dash-warning)]', border: 'border-[var(--dash-warning)]/26' },
}

function StatCard({ title, value, icon: Icon, theme, caption }: StatCardProps) {
  const colors = THEME_MAP[theme]

  return (
    <div className={clsx(
      'glass-panel rounded-[22px] p-5 min-h-[142px]',
      colors.border
    )}>
      {/* 상단: 아이콘 + 제목 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[15px] text-[var(--dash-text-secondary)] font-semibold">{title}</span>
        <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center', colors.bg)}>
          <Icon size={18} className={colors.text} />
        </div>
      </div>

      {/* 주요 수치 */}
      <p className="text-[32px] leading-none font-bold text-[var(--dash-text-primary)] tracking-tight">{value}</p>

      {/* 보조 설명 */}
      {caption && (
        <p className="text-sm text-[var(--dash-text-tertiary)] mt-1.5">{caption}</p>
      )}
    </div>
  )
}

// ── 스켈레톤 (로딩 상태) ─────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="glass-panel rounded-xl p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-20 bg-[var(--dash-bg-secondary)] rounded" />
        <div className="w-9 h-9 bg-[var(--dash-bg-secondary)] rounded-lg" />
      </div>
      <div className="h-8 w-24 bg-[var(--dash-bg-secondary)] rounded mt-1" />
      <div className="h-3 w-32 bg-[var(--dash-bg-secondary)] rounded mt-3" />
    </div>
  )
}

// ── 통계 카드 그룹 (4개 묶음) ─────────────────────────────────────────────────

/**
 * 통계 API 데이터를 가져와 4개 StatCard를 렌더링한다.
 * 데이터 패칭은 useStats()에 위임하여 컴포넌트 코드를 단순하게 유지한다.
 */
export default function StatCardGroup() {
  const { data: stats, isLoading, isError } = useStats()

  /* 로딩 중: 스켈레톤 4개 표시 */
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
    )
  }

  /* 오류 시: 안내 메시지 */
  if (isError || !stats) {
    return (
      <div className="col-span-4 text-center py-8 text-[var(--dash-text-secondary)] text-sm">
        통계 데이터를 불러올 수 없습니다. 서버 연결을 확인하세요.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="전체 검사"
        value={stats.totalCount.toLocaleString()}
        icon={Activity}
        theme="indigo"
        caption="누적 검사 건수"
      />
      <StatCard
        title="합격 (PASS)"
        value={stats.passCount.toLocaleString()}
        icon={CheckCircle}
        theme="green"
        caption={`전체의 ${(100 - stats.failRate).toFixed(1)}%`}
      />
      <StatCard
        title="불합격 (FAIL)"
        value={stats.failCount.toLocaleString()}
        icon={XCircle}
        theme="red"
        caption={`전체의 ${stats.failRate.toFixed(1)}%`}
      />
      <StatCard
        title="불량률"
        value={`${stats.failRate.toFixed(2)}%`}
        icon={AlertTriangle}
        /* 불량률 3% 이상이면 빨간색, 미만이면 노란색 */
        theme={stats.failRate >= 3 ? 'red' : 'yellow'}
        caption="FAIL / 전체 검사"
      />
    </div>
  )
}
