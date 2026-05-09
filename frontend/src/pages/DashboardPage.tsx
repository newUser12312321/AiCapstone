import { useMemo } from 'react'
import { ArrowRight, CheckCircle2, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatCardGroup from '@/components/dashboard/StatCard'
import PassFailChart from '@/components/dashboard/PassFailChart'
import TrendChart from '@/components/dashboard/TrendChart'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useRecentInspections, useStats } from '@/hooks/useInspectionData'
import { defectDisplayName } from '@/types/inspection'

export default function DashboardPage() {
  const { settings, formatSplitDateTime } = useDashboardSettings()
  const { data: recentLogs = [], isLoading: isRecentLoading } = useRecentInspections(
    settings.recentFeedLimit
  )
  const { data: stats } = useStats()

  const recentFailLogs = useMemo(
    () => recentLogs.filter((log) => log.result === 'FAIL'),
    [recentLogs]
  )
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent px-5 pt-5 pb-4">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1320px] flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-12 xl:items-stretch">
          {/* 좌측 메인 운영 보드 — 하단 여백을 차트 영역이 흡수 */}
          <div className="flex h-full min-h-0 flex-col gap-4 xl:col-span-8">
            <div className="glass-panel shrink-0 rounded-[26px] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--dash-text-primary)]">
                    검사 운영 상태 대시보드
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/history"
                    className="glass-panel-subtle inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]"
                  >
                    검사 이력
                    <ArrowRight size={15} />
                  </Link>
                  <Link
                    to="/settings"
                    className="glass-panel-subtle inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]"
                    title="설정"
                  >
                    <Settings size={16} />
                    설정
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                <div className="glass-panel-subtle rounded-2xl px-4 py-3.5">
                  <p className="text-xs text-[var(--dash-text-tertiary)] mb-1">현재 라인 상태</p>
                  <p className={`text-xl font-bold ${statusTone}`}>
                    {stats && stats.failRate >= 3 ? '주의 필요' : '정상 운전'}
                  </p>
                </div>
                <div className="glass-panel-subtle rounded-2xl px-4 py-3.5">
                  <p className="text-xs text-[var(--dash-text-tertiary)] mb-1">평균 추론 시간</p>
                  <p className="text-xl font-bold text-[var(--dash-text-primary)]">
                    {avgInferenceMs != null ? `${avgInferenceMs} ms` : '--'}
                  </p>
                </div>
                <div className="glass-panel-subtle rounded-2xl px-4 py-3.5">
                  <p className="text-xs text-[var(--dash-text-tertiary)] mb-1">평균 총 처리 시간</p>
                  <p className="text-xl font-bold text-[var(--dash-text-primary)]">
                    {avgTotalMs != null ? `${avgTotalMs} ms` : '--'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="shrink-0">
                <StatCardGroup />
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-5 lg:items-stretch">
                <div className="flex h-full min-h-0 flex-col lg:col-span-2 lg:min-h-[260px]">
                  <PassFailChart />
                </div>
                <div className="flex h-full min-h-0 flex-col lg:col-span-3 lg:min-h-[260px]">
                  <TrendChart />
                </div>
              </div>
            </div>
          </div>

          {/* 우측 운영 요약 레일 — 좌측과 동일 높이로 채움 */}
          <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 xl:col-span-4">
            <div className="glass-panel flex min-h-0 flex-[2] flex-col rounded-[24px] p-[18px]">
              <h3 className="mb-3 shrink-0 text-base font-semibold text-[var(--dash-text-primary)]">
                최근 이상 징후 ({settings.recentFeedLimit}건 기준)
              </h3>
              {isRecentLoading ? (
                <p className="text-sm text-[var(--dash-text-secondary)]">로딩 중…</p>
              ) : recentFailLogs.length === 0 ? (
                <div className="glass-panel-subtle rounded-xl px-3 py-3 text-sm text-[var(--dash-success)] flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  최근 구간에서 FAIL 이력이 없습니다.
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {recentFailLogs.slice(0, 6).map((log) => {
                    const { date, time } = formatSplitDateTime(log.inspectedAt)
                    return (
                      <div key={log.id} className="glass-panel-subtle rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-[var(--dash-text-primary)]">#{log.id} · {log.deviceId}</p>
                          <span className="text-xs text-[var(--dash-text-tertiary)] text-right">
                            {time ? (
                              <>
                                <span className="block">{date}</span>
                                <span className="font-mono">{time}</span>
                              </>
                            ) : (
                              <span className="font-mono">{date}</span>
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--dash-danger)] mt-1 truncate">
                          {log.defects.length > 0 ? defectDisplayName(log.defects[0].defectType, log.defects[0].detail) : 'FAIL'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="glass-panel flex min-h-0 flex-1 flex-col rounded-[24px] p-[18px]">
              <h3 className="mb-3 shrink-0 text-base font-semibold text-[var(--dash-text-primary)]">주요 불량 유형</h3>
              {topDefects.length === 0 ? (
                <p className="text-sm text-[var(--dash-text-secondary)]">최근 FAIL 데이터가 없어 집계할 수 없습니다.</p>
              ) : (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {topDefects.map(([label, count]) => (
                    <div key={label} className="glass-panel-subtle rounded-xl px-3 py-2 flex items-center justify-between">
                      <span className="text-sm text-[var(--dash-text-secondary)] truncate">{label}</span>
                      <span className="text-sm font-semibold text-[var(--dash-text-primary)]">{count}건</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
