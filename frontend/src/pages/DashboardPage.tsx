import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Cpu,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import StatCardGroup from '@/components/dashboard/StatCard'
import PassFailChart from '@/components/dashboard/PassFailChart'
import TrendChart from '@/components/dashboard/TrendChart'
import { deleteAllInspections } from '@/api/inspectionApi'
import { useRecentInspections, useStats } from '@/hooks/useInspectionData'
import { defectDisplayName } from '@/types/inspection'

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const { data: recentLogs = [], isLoading: isRecentLoading } = useRecentInspections(30)
  const { data: stats, isFetching, dataUpdatedAt } = useStats()

  const failRateText = stats ? `${stats.failRate.toFixed(1)}%` : '--'
  const passRateText = stats ? `${(100 - stats.failRate).toFixed(1)}%` : '--'
  const totalCountText = stats ? stats.totalCount.toLocaleString() : '--'
  const failSeverityClass = stats && stats.failRate >= 3
    ? 'border-[var(--dash-danger)]/35 bg-red-50'
    : 'border-[var(--dash-border)] bg-[var(--dash-bg-secondary)]'
  const liveUpdatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('ko-KR')
    : '--:--:--'
  const recentFailLogs = useMemo(
    () => recentLogs.filter((log) => log.result === 'FAIL'),
    [recentLogs]
  )
  const recentFailRate = useMemo(() => {
    if (!recentLogs.length) return null
    return (recentFailLogs.length / recentLogs.length) * 100
  }, [recentLogs, recentFailLogs.length])
  const avgInferenceMs = useMemo(() => {
    const valid = recentLogs.map((l) => l.inferenceTimeMs).filter((v): v is number => typeof v === 'number')
    if (!valid.length) return null
    return Math.round(valid.reduce((acc, v) => acc + v, 0) / valid.length)
  }, [recentLogs])
  const avgTotalMs = useMemo(() => {
    const valid = recentLogs.map((l) => l.totalTimeMs).filter((v): v is number => typeof v === 'number')
    if (!valid.length) return null
    return Math.round(valid.reduce((acc, v) => acc + v, 0) / valid.length)
  }, [recentLogs])
  const topDefects = useMemo(() => {
    const counter = new Map<string, number>()
    recentFailLogs.forEach((log) => {
      log.defects.forEach((d) => {
        const label = defectDisplayName(d.defectType, d.detail)
        counter.set(label, (counter.get(label) ?? 0) + 1)
      })
    })
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [recentFailLogs])
  const statusTone = stats && stats.failRate >= 3 ? 'text-[var(--dash-danger)]' : 'text-[var(--dash-success)]'

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
        {/* P0: 즉시 인지 상태 바 */}
        <div className="bg-[var(--dash-surface)] rounded-2xl border border-[var(--dash-border)] px-4 py-2.5 shadow-[var(--dash-shadow-soft)]">
          <div className="flex flex-wrap items-center gap-2.5 text-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--dash-border)] text-[var(--dash-text-secondary)]">
              <span className={`w-2 h-2 rounded-full ${isFetching ? 'bg-[var(--dash-warning)] animate-pulse' : 'bg-[var(--dash-success)]'}`} />
              {isFetching ? '갱신 중' : 'LIVE'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--dash-border)] text-[var(--dash-text-secondary)]">
              <Activity size={14} />
              최종 갱신 {liveUpdatedAt}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--dash-border)] text-[var(--dash-text-secondary)]">
              누적 검사 {totalCountText}건
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--dash-border)] text-[var(--dash-text-secondary)]">
              FAIL 비율 {failRateText}
            </span>
            {recentFailRate != null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--dash-border)] text-[var(--dash-text-secondary)]">
                최근 30건 FAIL {recentFailRate.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* 좌측 메인 운영 보드 */}
          <div className="xl:col-span-8 space-y-4">
            <div className="bg-[var(--dash-surface)] rounded-3xl border border-[var(--dash-border)] shadow-[var(--dash-shadow-soft)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--dash-text-tertiary)]">Line Operation</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--dash-text-primary)] mt-1">
                    검사 운영 상태 대시보드
                  </h2>
                  <p className="text-sm text-[var(--dash-text-secondary)] mt-1">
                    실시간 상태/품질/속도/이상 징후를 한 화면에서 확인합니다.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/history"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]"
                  >
                    검사 이력
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-4 py-3">
                  <p className="text-xs text-[var(--dash-text-tertiary)] mb-1">현재 라인 상태</p>
                  <p className={`text-xl font-bold ${statusTone}`}>
                    {stats && stats.failRate >= 3 ? '주의 필요' : '정상 운전'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-4 py-3">
                  <p className="text-xs text-[var(--dash-text-tertiary)] mb-1">평균 추론 시간</p>
                  <p className="text-xl font-bold text-[var(--dash-text-primary)]">
                    {avgInferenceMs != null ? `${avgInferenceMs} ms` : '--'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-4 py-3">
                  <p className="text-xs text-[var(--dash-text-tertiary)] mb-1">평균 총 처리 시간</p>
                  <p className="text-xl font-bold text-[var(--dash-text-primary)]">
                    {avgTotalMs != null ? `${avgTotalMs} ms` : '--'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <PassFailChart />
              </div>
              <div className="lg:col-span-3">
                <TrendChart />
              </div>
            </div>

            {/* P1: KPI 요약 */}
            <StatCardGroup />
          </div>

          {/* 우측 운영 요약 레일 */}
          <div className="xl:col-span-4 space-y-4">
            <div className="bg-[var(--dash-surface)] rounded-3xl border border-[var(--dash-border)] shadow-[var(--dash-shadow-soft)] p-4">
              <h3 className="text-base font-semibold text-[var(--dash-text-primary)] mb-3">운영 스냅샷</h3>
              <div className="space-y-2.5">
                <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[var(--dash-text-secondary)]">
                    <Cpu size={14} />
                    <span className="text-sm">누적 검사</span>
                  </div>
                  <span className="text-base font-semibold text-[var(--dash-text-primary)]">{totalCountText}</span>
                </div>
                <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[var(--dash-text-secondary)]">
                    <CheckCircle2 size={14} className="text-[var(--dash-success)]" />
                    <span className="text-sm">합격률</span>
                  </div>
                  <span className="text-base font-semibold text-[var(--dash-text-primary)]">{passRateText}</span>
                </div>
                <div className={`rounded-xl border px-3 py-2.5 flex items-center justify-between ${failSeverityClass}`}>
                  <div className="flex items-center gap-2 text-[var(--dash-text-secondary)]">
                    <XCircle size={14} className="text-[var(--dash-danger)]" />
                    <span className="text-sm">불량률</span>
                  </div>
                  <span className="text-base font-semibold text-[var(--dash-text-primary)]">{failRateText}</span>
                </div>
                <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[var(--dash-text-secondary)]">
                    <Clock3 size={14} />
                    <span className="text-sm">평균 총 처리</span>
                  </div>
                  <span className="text-base font-semibold text-[var(--dash-text-primary)]">
                    {avgTotalMs != null ? `${avgTotalMs} ms` : '--'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[var(--dash-surface)] rounded-3xl border border-[var(--dash-border)] shadow-[var(--dash-shadow-soft)] p-4">
              <h3 className="text-base font-semibold text-[var(--dash-text-primary)] mb-3">최근 이상 징후 (30건 기준)</h3>
              {isRecentLoading ? (
                <p className="text-sm text-[var(--dash-text-secondary)]">로딩 중…</p>
              ) : recentFailLogs.length === 0 ? (
                <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-3 text-sm text-[var(--dash-success)] flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  최근 구간에서 FAIL 이력이 없습니다.
                </div>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {recentFailLogs.slice(0, 6).map((log) => (
                    <div key={log.id} className="rounded-xl border border-[var(--dash-border)] px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[var(--dash-text-primary)]">#{log.id} · {log.deviceId}</p>
                        <span className="text-xs text-[var(--dash-text-tertiary)]">
                          {new Date(log.inspectedAt).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--dash-danger)] mt-1 truncate">
                        {log.defects.length > 0 ? defectDisplayName(log.defects[0].defectType, log.defects[0].detail) : 'FAIL'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[var(--dash-surface)] rounded-3xl border border-[var(--dash-border)] shadow-[var(--dash-shadow-soft)] p-4">
              <h3 className="text-base font-semibold text-[var(--dash-text-primary)] mb-3">결함 Hotspot</h3>
              {topDefects.length === 0 ? (
                <p className="text-sm text-[var(--dash-text-secondary)]">최근 FAIL 데이터가 없어 집계할 수 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {topDefects.map(([label, count]) => (
                    <div key={label} className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-2 flex items-center justify-between">
                      <span className="text-sm text-[var(--dash-text-secondary)] truncate">{label}</span>
                      <span className="text-sm font-semibold text-[var(--dash-text-primary)]">{count}건</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[var(--dash-surface)] rounded-3xl border border-[var(--dash-border)] shadow-[var(--dash-shadow-soft)] p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-[var(--dash-warning)] mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[var(--dash-text-primary)]">운영 안내</p>
                  <p className="text-xs text-[var(--dash-text-secondary)] mt-1">
                    상세 좌표/원인 분석은 `검사 이력` 메뉴에서 확인하세요.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDeleteHistory}
                disabled={deleteMutation.isPending}
                className="mt-4 inline-flex items-center gap-2 px-3.5 h-10 rounded-xl text-sm font-medium bg-[var(--dash-accent)] hover:bg-[var(--dash-accent-hover)] border border-transparent text-white disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                이력 전체 삭제
              </button>
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

      </div>
    </div>
  )
}
