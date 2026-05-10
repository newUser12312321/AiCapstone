import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Aperture, Camera, Loader2, RefreshCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  fetchCameraFocus,
  triggerEdgeInspection,
  updateCameraFocus,
  type CameraFocusState,
  type KioskInspectionPreset,
} from '@/api/edgeApi'
import { fetchRecentInspections } from '@/api/inspectionApi'
import { QUERY_KEYS, useRecentInspections } from '@/hooks/useInspectionData'
import KioskFailBurstLabel from '@/components/kiosk/KioskFailBurstLabel'
import KioskPassBurstLabel from '@/components/kiosk/KioskPassBurstLabel'
import { runTripleBurstFlash } from '@/utils/kioskFailFlash'
import kioskRaspberryIcon from '@/assets/kiosk-raspberry-icon.webp'
import clsx from 'clsx'

const RECENT_LOG_LIMIT = 5

export default function KioskPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [failFullScreenFlash, setFailFullScreenFlash] = useState(false)
  const [failLabelFlash, setFailLabelFlash] = useState(false)
  const [passFullScreenFlash, setPassFullScreenFlash] = useState(false)
  const [passLabelFlash, setPassLabelFlash] = useState(false)
  const [kioskPreset, setKioskPreset] = useState<KioskInspectionPreset>('standard')
  const [focusDraft, setFocusDraft] = useState<number | null>(null)
  const { data: recentLogs = [] } = useRecentInspections(RECENT_LOG_LIMIT)

  const focusQuery = useQuery({
    queryKey: ['edge', 'camera-focus'],
    queryFn: fetchCameraFocus,
    staleTime: 5000,
    retry: 1,
  })

  const focusMutation = useMutation({
    mutationFn: (next: CameraFocusState) => updateCameraFocus(next),
    onSuccess: (data) => {
      queryClient.setQueryData(['edge', 'camera-focus'], data.camera_focus)
      setFocusDraft(null)
    },
  })

  const focusFromServer = focusQuery.data
  const manualValue = focusDraft ?? focusFromServer?.value ?? 25
  const focusInitRef = useRef(false)

  const applyFocus = useCallback(
    (next: CameraFocusState) => {
      focusMutation.mutate(next)
    },
    [focusMutation]
  )

  const triggerMutation = useMutation({
    mutationFn: (preset: KioskInspectionPreset) => triggerEdgeInspection('aligned', preset),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.recent(RECENT_LOG_LIMIT) })
      const logs = await queryClient.fetchQuery({
        queryKey: QUERY_KEYS.recent(RECENT_LOG_LIMIT),
        queryFn: () => fetchRecentInspections(RECENT_LOG_LIMIT),
      })
      const newest = logs[0]
      if (newest?.result === 'FAIL') {
        await runTripleBurstFlash(setFailFullScreenFlash, setFailLabelFlash)
      } else if (newest?.result === 'PASS') {
        await runTripleBurstFlash(setPassFullScreenFlash, setPassLabelFlash)
      }
      setActionMsg('검사가 완료되었습니다. 우측 최근 검사이력에서 항목을 선택해 상세 결과를 확인하세요.')
    },
    onError: (e: Error) => setActionMsg(e.message || '검사 요청 실패'),
  })

  const focusControlsDisabled =
    focusQuery.isLoading || focusMutation.isPending || focusFromServer == null

  const bumpManualFocus = (delta: number) => {
    const v = Math.max(0, Math.min(255, manualValue + delta))
    setFocusDraft(v)
    applyFocus({ auto: false, value: v })
  }

  useEffect(() => {
    if (focusFromServer == null || focusMutation.isPending || focusInitRef.current) return
    focusInitRef.current = true
    if (focusFromServer.auto || focusFromServer.value !== 25) {
      setFocusDraft(25)
      applyFocus({ auto: false, value: 25 })
    }
  }, [applyFocus, focusFromServer, focusMutation.isPending])

  return (
    <div className="dashboard-theme relative flex h-dvh min-h-0 w-full max-h-dvh flex-col overflow-hidden text-[var(--dash-text-primary)] p-2 touch-manipulation">
      <div
        aria-hidden
        className={clsx(
          'fixed inset-0 z-[600] pointer-events-none transition-none',
          failFullScreenFlash && 'bg-[rgba(220,38,38,0.52)]',
          passFullScreenFlash && 'bg-[rgba(22,163,74,0.48)]'
        )}
      />
      <KioskFailBurstLabel visible={failLabelFlash} />
      <KioskPassBurstLabel visible={passLabelFlash} />
      <div className="glass-panel mx-auto flex min-h-0 w-full max-w-[1024px] flex-1 flex-col rounded-2xl p-3 shadow-[var(--dash-glow)]">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-stretch lg:gap-3">
          <section className="glass-panel flex min-h-0 flex-col gap-2 overflow-hidden rounded-2xl p-3 lg:flex-1">
            <div className="flex shrink-0 flex-wrap items-end justify-between gap-2 gap-y-1">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <img
                  src={kioskRaspberryIcon}
                  alt=""
                  width={40}
                  height={40}
                  draggable={false}
                  className="h-9 w-9 shrink-0 object-contain select-none lg:h-10 lg:w-10"
                />
                <h1
                  className="
                  text-xl sm:text-2xl font-extrabold leading-tight tracking-tight
                  bg-gradient-to-r from-[var(--dash-text-primary)] via-[var(--dash-accent)] to-[var(--dash-info)]
                  bg-clip-text text-transparent
                  drop-shadow-[0_0_24px_rgba(139,92,246,0.25)]
                "
                >
                  PCB 비전 검사 시스템
                </h1>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-end justify-end gap-2 sm:flex-nowrap sm:justify-end lg:max-w-[52%]">
                <span className="glass-panel-subtle hidden h-8 shrink-0 items-center rounded-full px-2.5 text-[11px] text-[var(--dash-text-secondary)] sm:inline-flex">
                  LIVE
                </span>
                <div className="min-w-[140px] flex-1 sm:max-w-[240px]">
                  <label htmlFor="kiosk-board-preset" className="mb-0.5 block text-[10px] font-medium text-[var(--dash-text-secondary)]">
                    PCB 기판명
                  </label>
                  <select
                    id="kiosk-board-preset"
                    value={kioskPreset}
                    onChange={(e) => setKioskPreset(e.target.value as KioskInspectionPreset)}
                    disabled={triggerMutation.isPending}
                    className="h-9 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-2 text-xs font-semibold text-[var(--dash-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]/40 disabled:opacity-50"
                  >
                    <option value="standard">일반검사 (실크인쇄 포함)</option>
                    <option value="gt125a">GT-125A (실크 생략)</option>
                    <option value="gn948x">gn948x (실크 생략)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="relative min-h-[100px] flex-1 overflow-hidden rounded-xl border border-[var(--dash-border)] bg-black">
              <img
                src="/edge/camera/stream.mjpg"
                alt="카메라 프리뷰"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="glass-panel-subtle shrink-0 rounded-xl p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Aperture size={16} className="shrink-0 text-[var(--dash-accent)]" aria-hidden />
                  <div>
                    <p className="text-xs font-semibold text-[var(--dash-text-primary)]">프리뷰 초점</p>
                    <p className="hidden text-[10px] text-[var(--dash-text-secondary)] sm:block">
                      ± 버튼으로 1단계 조절 · 기본 25
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => focusQuery.refetch()}
                  disabled={focusQuery.isFetching}
                  className="glass-panel-subtle inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] text-[var(--dash-text-primary)] hover:brightness-110 disabled:opacity-50"
                >
                  <RefreshCcw size={12} className={focusQuery.isFetching ? 'animate-spin' : ''} />
                  새로고침
                </button>
              </div>

              {focusQuery.isLoading && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--dash-text-secondary)]">
                  <Loader2 className="size-3.5 animate-spin" />
                  초점 불러오는 중…
                </p>
              )}

              {focusQuery.isError && (
                <p className="mt-2 text-[11px] leading-snug text-[var(--dash-warning)]">
                  카메라·엣지 미연결 시 초점 조절 불가 (Pi Edge API 확인)
                </p>
              )}

              {focusFromServer != null && (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[var(--dash-text-secondary)]">수동 초점</span>
                    {focusMutation.isPending && (
                      <Loader2 className="size-3.5 animate-spin text-[var(--dash-accent)]" aria-label="적용 중" />
                    )}
                  </div>

                  <div className={clsx('flex flex-col gap-1.5', focusControlsDisabled && 'opacity-60')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--dash-text-secondary)]">현재값</span>
                      <span className="font-mono text-sm tabular-nums text-[var(--dash-accent)]">{manualValue}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={focusControlsDisabled}
                        onClick={() => bumpManualFocus(-1)}
                        className="glass-panel-subtle h-11 w-11 shrink-0 rounded-lg text-xl font-bold hover:brightness-110 disabled:opacity-40"
                        aria-label="초점 가까이"
                      >
                        −
                      </button>
                      <div className="glass-panel-subtle grid h-11 flex-1 place-items-center rounded-lg text-sm font-semibold text-[var(--dash-text-primary)]">
                        {manualValue}
                      </div>
                      <button
                        type="button"
                        disabled={focusControlsDisabled}
                        onClick={() => bumpManualFocus(1)}
                        className="glass-panel-subtle h-11 w-11 shrink-0 rounded-lg text-xl font-bold hover:brightness-110 disabled:opacity-40"
                        aria-label="초점 멀리"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="glass-panel flex min-h-0 select-none flex-col gap-2 overflow-hidden rounded-2xl p-3 lg:flex-1">
            <div className="glass-panel-subtle flex shrink-0 flex-col rounded-xl p-2.5">
              <p className="mb-2 shrink-0 text-xs font-medium text-[var(--dash-text-secondary)]">최근 검사이력 5건</p>
              <div className="space-y-1 overflow-y-auto overscroll-contain pr-0.5">
                {recentLogs.length === 0 && (
                  <p className="text-[11px] text-[var(--dash-text-secondary)]">검사 이력이 없습니다.</p>
                )}
                {recentLogs.map((log) => (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => navigate(`/kiosk/complete/${log.id}`)}
                    className="glass-panel w-full rounded-lg px-2 py-1.5 text-left transition-all hover:brightness-110 active:brightness-95"
                  >
                    <p className="truncate text-[11px] font-semibold text-[var(--dash-text-primary)]">
                      {log.silkBoardName?.trim() || `검사 #${log.id}`}
                    </p>
                    <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px]">
                      <span className="text-[var(--dash-text-tertiary)]">
                        {new Date(log.inspectedAt).toLocaleTimeString('ko-KR')}
                      </span>
                      <span className={clsx('font-semibold', log.result === 'PASS' ? 'text-[var(--dash-success)]' : 'text-[var(--dash-danger)]')}>
                        {log.result === 'PASS' ? '정상' : '불량'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-panel-subtle flex min-h-0 flex-1 flex-col rounded-xl p-2.5">
              <p className="mb-2 shrink-0 text-center text-[11px] text-[var(--dash-text-secondary)]">검사 실행</p>
              <div className="flex min-h-0 flex-1 flex-col [container-type:size]">
                <button
                  type="button"
                  onClick={() => {
                    setActionMsg(null)
                    triggerMutation.mutate(kioskPreset)
                  }}
                  disabled={triggerMutation.isPending}
                  className={clsx(
                    'relative flex h-full min-h-[52px] w-full flex-1 flex-row items-center justify-center gap-[0.45em]',
                    'overflow-hidden rounded-2xl border border-white/25 px-4 py-3',
                    'bg-gradient-to-b from-[var(--dash-accent)] via-[var(--dash-accent)] to-[var(--dash-accent-hover)]',
                    'shadow-[0_12px_36px_rgba(139,92,246,0.38),inset_0_1px_0_rgba(255,255,255,0.22)]',
                    'text-[clamp(1.125rem,calc(0.55rem+10cqh),2.35rem)] font-extrabold tracking-tight text-white',
                    'transition-[transform,filter] hover:brightness-[1.06] active:scale-[0.99] active:brightness-95',
                    'disabled:pointer-events-none disabled:opacity-45',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50'
                  )}
                >
                  {triggerMutation.isPending ? (
                    <Loader2 className="size-[1.15em] shrink-0 animate-spin" strokeWidth={2.5} aria-hidden />
                  ) : (
                    <Camera className="size-[1.15em] shrink-0" strokeWidth={2.25} aria-hidden />
                  )}
                  <span className="leading-none">검사 시작</span>
                </button>
              </div>
            </div>

            {actionMsg && (
              <p className="line-clamp-2 shrink-0 text-[10px] leading-snug text-[var(--dash-text-secondary)]">{actionMsg}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
