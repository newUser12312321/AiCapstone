/**
 * 통계 요약 카드 — 클릭 시 검사 이력(/history)로 필터 연동
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CheckCircle, XCircle, Activity } from 'lucide-react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useStats } from '@/hooks/useInspectionData'
import type { InspectionLog } from '@/types/inspection'
import { buildHistoryPath, getLocalDateString } from '@/utils/historyNavigation'
import type { LineFilter } from '@/utils/inspectionFilters'

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function logsBetween(logs: InspectionLog[], fromMs: number, toMs: number): InspectionLog[] {
  return logs.filter((l) => {
    const t = new Date(l.inspectedAt).getTime()
    return t >= fromMs && t <= toMs
  })
}

function summarize(logs: InspectionLog[]) {
  const total = logs.length
  const pass = logs.filter((l) => l.result === 'PASS').length
  const fail = logs.filter((l) => l.result === 'FAIL').length
  const failRate = total ? (fail / total) * 100 : 0
  return { total, pass, fail, failRate }
}

function formatCountDelta(curr: number, prev: number): string | null {
  if (curr === 0 && prev === 0) return null
  if (prev === 0) return `전주 대비 신규`
  const pct = ((curr - prev) / prev) * 100
  const arrow = pct >= 0 ? '▲' : '▼'
  return `전주 대비 ${arrow} ${Math.abs(pct).toFixed(1)}%`
}

function formatDayDelta(curr: number, prev: number): string | null {
  if (curr === 0 && prev === 0) return null
  if (prev === 0) return `전일 대비 +${curr}건`
  const pct = ((curr - prev) / prev) * 100
  const arrow = pct >= 0 ? '▲' : '▼'
  return `전일 대비 ${arrow} ${Math.abs(pct).toFixed(1)}%`
}

// ── 개별 카드 ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title:   string
  value:   string | number
  icon:    LucideIcon
  theme:   'indigo' | 'green' | 'red' | 'yellow'
  caption?: string
  delta?:  string | null
  onNavigate?: () => void
}

const THEME_MAP: Record<StatCardProps['theme'], { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-[var(--dash-accent)]/18', text: 'text-[var(--dash-accent)]', border: 'border-[var(--dash-accent)]/30' },
  green:  { bg: 'bg-[var(--dash-success)]/16', text: 'text-[var(--dash-success)]', border: 'border-[var(--dash-success)]/28'  },
  red:    { bg: 'bg-[var(--dash-danger)]/16', text: 'text-[var(--dash-danger)]', border: 'border-[var(--dash-danger)]/28'    },
  yellow: { bg: 'bg-[var(--dash-warning)]/14', text: 'text-[var(--dash-warning)]', border: 'border-[var(--dash-warning)]/26' },
}

function StatCard({ title, value, icon: Icon, theme, caption, delta, onNavigate }: StatCardProps) {
  const colors = THEME_MAP[theme]
  const inner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[15px] text-[var(--dash-text-secondary)] font-semibold">{title}</span>
        <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center', colors.bg)}>
          <Icon size={18} className={colors.text} />
        </div>
      </div>
      <p className="text-[32px] leading-none font-bold text-[var(--dash-text-primary)] tracking-tight">{value}</p>
      {caption && (
        <p className="text-sm text-[var(--dash-text-tertiary)] mt-1.5">{caption}</p>
      )}
      {delta && (
        <p className="text-xs text-[var(--dash-text-secondary)] mt-1 font-medium">{delta}</p>
      )}
    </>
  )

  if (onNavigate) {
    return (
      <button
        type="button"
        onClick={onNavigate}
        className={clsx(
          'glass-panel rounded-[22px] p-5 min-h-[142px] text-left w-full transition-transform hover:scale-[1.01] active:scale-[0.99]',
          colors.border,
          'focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]/40'
        )}
      >
        {inner}
      </button>
    )
  }

  return (
    <div className={clsx('glass-panel rounded-[22px] p-5 min-h-[142px]', colors.border)}>
      {inner}
    </div>
  )
}

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

// ── 그룹 ─────────────────────────────────────────────────────────────────────

export interface StatCardGroupProps {
  /** 라인·기종 필터 (빈 문자열이면 전체) */
  lineFilter: LineFilter
  allLogs: InspectionLog[]
  /** 네 번째 칸 — 합격/불합격 비율 등 */
  chartSlot?: ReactNode
}

export default function StatCardGroup({ lineFilter, allLogs, chartSlot }: StatCardGroupProps) {
  const { formatRatePercent } = useDashboardSettings()
  const { data: stats, isLoading, isError } = useStats()
  const navigate = useNavigate()

  const useBackendStats =
    !(lineFilter.deviceId?.trim()) && !(lineFilter.board?.trim())

  const scopedLogs = allLogs

  const today = getLocalDateString()
  const sod = startOfLocalDay()
  const sodMs = sod.getTime()
  const yStart = new Date(sodMs - 86400000)
  const yEnd = new Date(sodMs - 1)
  const now = Date.now()
  const w1Start = sodMs - 7 * 86400000
  const w2Start = sodMs - 14 * 86400000
  const w2End = sodMs - 7 * 86400000 - 1

  const todayLogs = logsBetween(scopedLogs, sodMs, now)
  const yLogs = logsBetween(scopedLogs, yStart.getTime(), yEnd.getTime())
  const wCurr = logsBetween(scopedLogs, w1Start, now)
  const wPrev = logsBetween(scopedLogs, w2Start, w2End)

  const tK = summarize(todayLogs)
  const yK = summarize(yLogs)
  const wK = summarize(wCurr)
  const wP = summarize(wPrev)

  const lineQ = {
    device: lineFilter.deviceId?.trim() || undefined,
    board: lineFilter.board?.trim() || undefined,
  }

  const go = (extra: Parameters<typeof buildHistoryPath>[0]) => {
    navigate(buildHistoryPath({ to: today, ...lineQ, ...extra }))
  }

  const goToday = (extra: Parameters<typeof buildHistoryPath>[0]) => {
    navigate(buildHistoryPath({ from: today, to: today, ...lineQ, ...extra }))
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
        {chartSlot}
      </div>
    )
  }

  if (isError || !stats) {
    return (
      <div className="col-span-4 text-center py-8 text-[var(--dash-text-secondary)] text-sm">
        통계 데이터를 불러올 수 없습니다. 서버 연결을 확인하세요.
      </div>
    )
  }

  const total = useBackendStats ? stats.totalCount : summarize(scopedLogs).total
  const pass = useBackendStats ? stats.passCount : summarize(scopedLogs).pass
  const fail = useBackendStats ? stats.failCount : summarize(scopedLogs).fail

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="전체 검사"
        value={total.toLocaleString()}
        icon={Activity}
        theme="indigo"
        caption="누적 검사 건수"
        delta={formatCountDelta(wK.total, wP.total)}
        onNavigate={() => go({})}
      />
      <StatCard
        title="합격 (PASS)"
        value={pass.toLocaleString()}
        icon={CheckCircle}
        theme="green"
        caption={`전체의 ${formatRatePercent(total ? (pass / total) * 100 : 0)}%`}
        delta={formatDayDelta(tK.pass, yK.pass)}
        onNavigate={() => goToday({ result: 'PASS' })}
      />
      <StatCard
        title="불합격 (FAIL)"
        value={fail.toLocaleString()}
        icon={XCircle}
        theme="red"
        caption={`전체의 ${formatRatePercent(total ? (fail / total) * 100 : 0)}%`}
        delta={formatDayDelta(tK.fail, yK.fail)}
        onNavigate={() => goToday({ result: 'FAIL' })}
      />
      {chartSlot}
    </div>
  )
}
