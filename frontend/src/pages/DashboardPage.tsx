/**
 * 메인 대시보드 페이지
 *
 * 레이아웃 구성:
 * ┌──────────────────────────────────────────────────┐
 * │  [StatCard × 4]  전체/합격/불합격/불량률           │
 * ├─────────────────────┬────────────────────────────│
 * │  PassFailChart      │  TrendChart                │
 * │  (도넛 차트)          │  (스택 막대 차트)            │
 * ├─────────────────────┴────────────────────────────│
 * │  InspectionTable  (최근 15건 실시간 피드)           │
 * └──────────────────────────────────────────────────┘
 */

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Mail, Loader2, Search, Trash2 } from 'lucide-react'
import StatCardGroup from '@/components/dashboard/StatCard'
import PassFailChart from '@/components/dashboard/PassFailChart'
import TrendChart from '@/components/dashboard/TrendChart'
import InspectionTable from '@/components/inspection/InspectionTable'
import { deleteAllInspections } from '@/api/inspectionApi'
import { useRecentInspections, useStats } from '@/hooks/useInspectionData'

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  /* 최근 15건 — 대시보드 하단 실시간 피드 테이블 */
  const { data: recentLogs = [], isLoading } = useRecentInspections(15)
  const { data: stats } = useStats()

  const latestItems = useMemo(() => recentLogs.slice(0, 3), [recentLogs])
  const rightRailItems = useMemo(() => recentLogs.slice(0, 5), [recentLogs])

  const failRateText = stats ? `${stats.failRate.toFixed(1)}%` : '--'
  const passRateText = stats ? `${(100 - stats.failRate).toFixed(1)}%` : '--'

  const invalidateInspections = () => {
    queryClient.invalidateQueries({ queryKey: ['inspections'] })
  }

  const deleteMutation = useMutation({
    mutationFn: deleteAllInspections,
    onSuccess: () => {
      setActionMsg({ type: 'ok', text: '검사 이력이 모두 삭제되었습니다.' })
      invalidateInspections()
    },
    onError: (e: Error) => {
      setActionMsg({ type: 'err', text: e.message || '삭제 실패' })
    },
  })

  const handleDeleteHistory = () => {
    if (
      !window.confirm(
        '저장된 검사 이력과 결함 기록을 모두 삭제합니다. 계속할까요?'
      )
    ) {
      return
    }
    deleteMutation.mutate()
  }

  return (
    <div className="p-6 overflow-y-auto h-full bg-[var(--dash-bg-secondary)]">
      <div className="max-w-[1280px] mx-auto space-y-5">
        {/* 상단 퀵바 */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-9 space-y-4">
            <div className="bg-[var(--dash-surface)] rounded-3xl border border-[var(--dash-border)] shadow-[var(--dash-shadow-soft)] p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px] h-11 rounded-2xl bg-[var(--dash-bg-secondary)] border border-[var(--dash-border)] px-4 flex items-center gap-2">
                <Search size={16} className="text-[var(--dash-text-tertiary)]" />
                <span className="text-sm text-[var(--dash-text-tertiary)]">검사 이력/결함/보드 검색…</span>
              </div>
              <button
                type="button"
                className="w-11 h-11 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] flex items-center justify-center text-[var(--dash-text-secondary)]"
                aria-label="메일 알림"
              >
                <Mail size={16} />
              </button>
              <button
                type="button"
                className="w-11 h-11 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] flex items-center justify-center text-[var(--dash-text-secondary)]"
                aria-label="공지 알림"
              >
                <Bell size={16} />
              </button>
              <button
                type="button"
                onClick={handleDeleteHistory}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 px-4 h-11 rounded-full text-sm font-medium bg-[var(--dash-accent)] hover:bg-[var(--dash-accent-hover)] border border-transparent text-white disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                이력 전체 삭제
              </button>
            </div>

            {/* 메인 배너 */}
            <div className="bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-500 rounded-3xl p-6 text-white shadow-[var(--dash-shadow-soft)] relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute -top-20 -right-10 w-56 h-56 rounded-full border border-white/40" />
                <div className="absolute -bottom-24 left-40 w-64 h-64 rounded-full border border-white/30" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/80 mb-2">PCB INSPECTION CONTROL</p>
              <h2 className="text-2xl font-semibold tracking-tight mb-2">라인 상태를 한눈에 모니터링</h2>
              <p className="text-sm text-white/85">
                실시간 검사 흐름, 결함 추세, 최근 이력을 하나의 화면에서 확인합니다.
              </p>
              <div className="mt-4 flex items-center gap-6 text-sm">
                <span className="text-white/90">PASS 비율: <strong>{passRateText}</strong></span>
                <span className="text-white/90">FAIL 비율: <strong>{failRateText}</strong></span>
              </div>
            </div>

            {/* 레퍼런스 스타일의 가로 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {latestItems.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-3 shadow-[var(--dash-shadow-soft)]"
                >
                  <p className="text-[11px] uppercase tracking-wide text-[var(--dash-text-tertiary)] mb-1">
                    #{log.id} · {log.result}
                  </p>
                  <p className="text-sm font-semibold text-[var(--dash-text-primary)] truncate">
                    {log.deviceId}
                  </p>
                  <p className="text-xs text-[var(--dash-text-secondary)] mt-1">
                    추론 {log.inferenceTimeMs != null ? `${log.inferenceTimeMs}ms` : '--'} ·
                    결함 {log.defects.length}건
                  </p>
                </div>
              ))}
              {latestItems.length === 0 && (
                <div className="md:col-span-3 rounded-2xl border border-dashed border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-6 text-sm text-[var(--dash-text-secondary)]">
                  최근 검사 데이터가 아직 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* 우측 통계 레일 */}
          <div className="xl:col-span-3">
            <div className="bg-[var(--dash-surface)] rounded-3xl border border-[var(--dash-border)] shadow-[var(--dash-shadow-soft)] p-4 h-full flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--dash-text-primary)]">Statistic</h3>
                <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">오늘 검사 요약</p>
              </div>
              <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-4 py-3">
                <p className="text-xs text-[var(--dash-text-tertiary)] mb-1">불량률</p>
                <p className="text-2xl font-bold text-[var(--dash-text-primary)]">{failRateText}</p>
              </div>
              <div className="space-y-2">
                {rightRailItems.map((log) => (
                  <div key={log.id} className="rounded-xl border border-[var(--dash-border)] px-3 py-2">
                    <p className="text-[11px] text-[var(--dash-text-tertiary)]">#{log.id}</p>
                    <p className="text-sm font-medium text-[var(--dash-text-primary)]">{log.result}</p>
                    <p className="text-xs text-[var(--dash-text-secondary)] truncate">{log.deviceId}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {actionMsg && (
          <p
            className={
              actionMsg.type === 'ok'
                ? 'text-xs text-[var(--dash-success)]'
                : 'text-xs text-[var(--dash-danger)]'
            }
          >
            {actionMsg.text}
          </p>
        )}

        {/* 2행: 통계 카드 */}
        <StatCardGroup />

        {/* 3행: 차트 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <PassFailChart />
          </div>
          <div className="lg:col-span-3">
            <TrendChart />
          </div>
        </div>

        {/* 4행: 검사 이력 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-[var(--dash-text-secondary)]">최근 검사 이력</h2>
            <span className="text-xs text-[var(--dash-text-tertiary)]">최근 15건</span>
          </div>
          <InspectionTable logs={recentLogs} isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}
