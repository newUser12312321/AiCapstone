import { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Settings,
} from 'lucide-react'
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
    <div className="p-5 h-full bg-transparent overflow-hidden">
      <div className="max-w-[1320px] h-full mx-auto flex flex-col gap-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 flex-1 min-h-0">
          {/* 좌측 메인 운영 보드 */}
          <div className="xl:col-span-8 space-y-4 min-h-0">
            <div className="glass-panel rounded-[26px] p-6">
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
          <div className="xl:col-span-4 space-y-4 min-h-0 overflow-y-auto pr-1">
            <div className="glass-panel rounded-[24px] p-[18px]">
              <h3 className="text-base font-semibold text-[var(--dash-text-primary)] mb-3">
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
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
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

            <div className="glass-panel rounded-[24px] p-[18px]">
              <h3 className="text-base font-semibold text-[var(--dash-text-primary)] mb-3">결함 Hotspot</h3>
              {topDefects.length === 0 ? (
                <p className="text-sm text-[var(--dash-text-secondary)]">최근 FAIL 데이터가 없어 집계할 수 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {topDefects.map(([label, count]) => (
                    <div key={label} className="glass-panel-subtle rounded-xl px-3 py-2 flex items-center justify-between">
                      <span className="text-sm text-[var(--dash-text-secondary)] truncate">{label}</span>
                      <span className="text-sm font-semibold text-[var(--dash-text-primary)]">{count}건</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-[24px] p-[18px]">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-[var(--dash-warning)] mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[var(--dash-text-primary)]">운영 안내</p>
                  <p className="text-xs text-[var(--dash-text-secondary)] mt-1">
                    상세 좌표·원인 분석은 `검사 이력` 메뉴에서 확인하세요. 저장된 이력 일괄 삭제는{' '}
                    <Link
                      to="/settings"
                      className="text-[var(--dash-accent)] hover:underline font-medium"
                    >
                      설정 → 데이터 관리
                    </Link>
                    에서 수행할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
