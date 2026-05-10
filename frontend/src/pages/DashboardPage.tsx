import { useMemo } from 'react'
import clsx from 'clsx'
import { ArrowRight, CheckCircle2, Settings } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import HourlyInspectionVolumeChart from '@/components/dashboard/HourlyInspectionVolumeChart'
import StatCardGroup from '@/components/dashboard/StatCard'
import PassFailChart from '@/components/dashboard/PassFailChart'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useAllInspections, useRecentInspections, useStats } from '@/hooks/useInspectionData'
import { defectDashboardAggregateLabel, deviceDisplayLabel } from '@/types/inspection'
import { buildHistoryPath, getLocalDateString, inspectionDetailPath } from '@/utils/historyNavigation'

export default function DashboardPage() {
  const { settings, formatSplitDateTime } = useDashboardSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: allLogs = [] } = useAllInspections()
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
        const label = defectDashboardAggregateLabel(d.defectType, d.detail)
        counter.set(label, (counter.get(label) ?? 0) + 1)
      })
    })
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [recentFailLogs])

  const statusTone = stats && stats.failRate >= 3 ? 'text-[var(--dash-danger)]' : 'text-[var(--dash-success)]'
  const today = getLocalDateString()

  const lineQ = {}

  const goDefectHistory = (label: string) => {
    navigate(
      buildHistoryPath({
        to: today,
        result: 'FAIL',
        defect: label,
        ...lineQ,
      })
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent px-5 pt-5 pb-4">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1320px] flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-12 xl:items-stretch">
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

            <div className="shrink-0">
              <StatCardGroup
                lineFilter={{}}
                allLogs={allLogs}
                chartSlot={<PassFailChart variant="statTile" lineFilter={{}} logs={allLogs} />}
              />
            </div>

            {/* 통계 카드와 동일 가로 폭(8/12 컬럼), 세로는 카드 아래 */}
            <div className="min-h-0 w-full shrink-0">
              <HourlyInspectionVolumeChart />
            </div>
          </div>

          <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 xl:col-span-4">
            <div className="glass-panel flex shrink-0 flex-col rounded-[24px] p-[18px]">
              <h3 className="mb-3 shrink-0 text-base font-semibold text-[var(--dash-text-primary)]">
                최근 검사 내역
              </h3>
              <p className="mb-3 shrink-0 text-xs text-[var(--dash-text-tertiary)]">최근 5건 · 클릭 시 상세</p>
              {isRecentLoading ? (
                <p className="text-sm text-[var(--dash-text-secondary)]">로딩 중…</p>
              ) : recentLogs.length === 0 ? (
                <div className="glass-panel-subtle rounded-xl px-3 py-3 text-sm text-[var(--dash-text-secondary)] flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[var(--dash-text-tertiary)]" />
                  검사 내역이 없습니다.
                </div>
              ) : (
                <div className="space-y-2.5 pr-1">
                  {recentLogs.slice(0, 5).map((log) => {
                    const { date, time } = formatSplitDateTime(log.inspectedAt)
                    const pass = log.result === 'PASS'
                    return (
                      <button
                        type="button"
                        key={log.id}
                        onClick={() =>
                          navigate(inspectionDetailPath(log.id), {
                            state: {
                              returnTo: `${location.pathname}${location.search}` || '/',
                            },
                          })
                        }
                        className={clsx(
                          'glass-panel-subtle w-full rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-[var(--dash-bg-secondary)] border-l-[5px]',
                          pass ? 'border-[var(--dash-success)]' : 'border-[var(--dash-danger)]'
                        )}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <p className="text-sm font-semibold text-[var(--dash-text-primary)]">
                            #{log.id} · {deviceDisplayLabel(log.deviceId)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <span
                              className={clsx(
                                'inline-flex shrink-0 items-center justify-center whitespace-nowrap min-w-[5.5rem] text-sm font-black uppercase tracking-wide px-4 py-2 rounded-xl border-2 shadow-[0_2px_12px_rgba(0,0,0,0.12)]',
                                pass
                                  ? 'bg-[var(--dash-success)]/25 text-[var(--dash-success)] border-[var(--dash-success)]'
                                  : 'bg-[var(--dash-danger)]/28 text-[var(--dash-danger)] border-[var(--dash-danger)]'
                              )}
                            >
                              {pass ? '정상' : '불량'}
                            </span>
                            <span className="text-[11px] text-[var(--dash-text-tertiary)] text-right tabular-nums">
                              {time ? (
                                <>
                                  <span className="block">{date}</span>
                                  <span className="font-mono text-[var(--dash-text-secondary)]">{time}</span>
                                </>
                              ) : (
                                <span className="font-mono">{date}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="glass-panel flex min-h-0 flex-1 flex-col rounded-[24px] p-[18px]">
              <h3 className="mb-3 shrink-0 text-base font-semibold text-[var(--dash-text-primary)]">주요 불량 유형</h3>
              {topDefects.length === 0 ? (
                <p className="min-h-0 flex-1 text-sm leading-relaxed text-[var(--dash-text-secondary)]">
                  최근 불량 데이터가 없어 집계할 수 없습니다.
                </p>
              ) : (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {topDefects.map(([label, count]) => (
                    <button
                      type="button"
                      key={label}
                      onClick={() => goDefectHistory(label)}
                      className="glass-panel-subtle w-full rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors hover:bg-[var(--dash-bg-secondary)]"
                    >
                      <span className="text-sm text-[var(--dash-text-secondary)] truncate">{label}</span>
                      <span className="text-sm font-semibold text-[var(--dash-text-primary)] shrink-0">{count}건</span>
                    </button>
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
