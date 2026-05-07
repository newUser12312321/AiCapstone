import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Aperture, Camera, Loader2, MonitorX, RefreshCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  fetchCameraFocus,
  exitKioskToDesktop,
  triggerEdgeInspection,
  updateCameraFocus,
  type CameraFocusState,
} from '@/api/edgeApi'
import { fetchRecentInspectionsWithTimeout } from '@/api/inspectionApi'
import { useRecentInspections } from '@/hooks/useInspectionData'
import clsx from 'clsx'

export default function KioskPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [focusDraft, setFocusDraft] = useState<number | null>(null)
  const { data: recentLogs = [] } = useRecentInspections(5)
  const latest = recentLogs[0]

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
    mutationFn: () => triggerEdgeInspection('aligned'),
    onSuccess: async () => {
      const prevLatestId = latest?.id ?? 0
      setActionMsg('검사 진행 중... 결과를 확인하고 있습니다.')
      try {
        const detectedId = await waitForNewInspectionId(prevLatestId)
        if (detectedId != null) {
          navigate(`/kiosk/complete/${detectedId}`)
          return
        }
        setActionMsg(
          '클라우드에서 검사 이력을 찾지 못했습니다. Pi의 SERVER_BASE_URL(http)과 GCP 방화벽(8080)을 확인하세요.',
        )
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setActionMsg(`이력 조회 실패: ${msg}`)
      }
    },
    onError: (e: Error) => setActionMsg(e.message || '검사 요청 실패'),
  })

  const exitMutation = useMutation({
    mutationFn: exitKioskToDesktop,
    onSuccess: () => {
      setActionMsg('키오스크 종료 요청을 보냈습니다. 잠시 후 라즈베리파이 바탕화면으로 복귀합니다.')
    },
    onError: (e: Error) => setActionMsg(e.message || '키오스크 종료 요청 실패'),
  })

  const verdict = !latest ? '대기' : latest.result === 'PASS' ? '정상' : '불량'

  const verdictClass = latest?.result === 'PASS'
    ? 'bg-emerald-500'
    : latest?.result === 'FAIL'
      ? 'bg-red-500'
      : 'bg-gray-400'

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
    <div className="kiosk-theme h-screen w-full bg-[var(--kiosk-bg-primary)] text-[var(--kiosk-text-primary)] p-4 md:p-6 overflow-hidden">
      <div className="mx-auto h-full max-w-7xl grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
        <section className="rounded-3xl border border-[var(--kiosk-border)] bg-[var(--kiosk-surface)] p-5 md:p-6 shadow-[var(--kiosk-shadow-soft)] overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-[var(--kiosk-text-secondary)]">PCB Inspection Kiosk</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">검사 화면</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm px-3 h-9 inline-flex items-center rounded-full border border-[var(--kiosk-border)] bg-[var(--kiosk-bg-secondary)] text-[var(--kiosk-text-secondary)]">실시간 프리뷰</span>
              <button
                type="button"
                onClick={() => exitMutation.mutate()}
                disabled={exitMutation.isPending}
                className="h-11 px-4 rounded-full bg-[var(--kiosk-text-primary)] text-white inline-flex items-center gap-2 text-sm font-semibold hover:brightness-110 disabled:opacity-50"
              >
                {exitMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <MonitorX size={16} />}
                키오스크 종료
              </button>
            </div>
          </div>
          <div className="w-full h-[42vh] md:h-[48vh] rounded-2xl overflow-hidden bg-black border border-[var(--kiosk-border)]">
            <img
              src="/edge/camera/stream.mjpg"
              alt="카메라 프리뷰"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-bg-secondary)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <Aperture size={20} className="text-[var(--kiosk-accent)] shrink-0" aria-hidden />
                <div>
                  <p className="text-base font-semibold text-[var(--kiosk-text-primary)]">프리뷰 초점</p>
                  <p className="text-sm text-[var(--kiosk-text-secondary)]">수동 초점값 기본 25, 버튼으로 1단계씩 조절</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => focusQuery.refetch()}
                disabled={focusQuery.isFetching}
                className="self-start inline-flex items-center gap-2 px-4 h-12 rounded-full border border-[var(--kiosk-border)] bg-[var(--kiosk-surface)] hover:bg-[var(--kiosk-bg-primary)] text-sm text-[var(--kiosk-text-primary)] disabled:opacity-50"
              >
                <RefreshCcw size={14} className={focusQuery.isFetching ? 'animate-spin' : ''} />
                초점 상태 새로고침
              </button>
            </div>

            {focusQuery.isLoading && (
              <p className="mt-3 text-sm text-[var(--kiosk-text-secondary)] flex items-center gap-2">
                <Loader2 className="animate-spin size-4" />
                초점 정보를 불러오는 중입니다…
              </p>
            )}

            {focusQuery.isError && (
              <p className="mt-3 text-sm text-[var(--kiosk-warning)]">
                엣지에 카메라가 없거나 연결되지 않아 초점을 조절할 수 없습니다. (Pi의 Edge API가 실행 중인지 확인하세요.)
              </p>
            )}

            {focusFromServer != null && (
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[var(--kiosk-text-secondary)] w-full sm:w-auto">수동 초점</span>
                  {focusMutation.isPending && (
                    <Loader2 className="animate-spin size-4 text-[var(--kiosk-accent)]" aria-label="적용 중" />
                  )}
                </div>

                <div className={clsx('flex flex-col gap-2', focusControlsDisabled && 'opacity-60')}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[var(--kiosk-text-secondary)]">현재 초점값</span>
                    <span className="text-base font-mono tabular-nums text-[var(--kiosk-accent)]">{manualValue}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={focusControlsDisabled}
                      onClick={() => bumpManualFocus(-1)}
                      className="shrink-0 w-14 h-14 rounded-xl border border-[var(--kiosk-border)] bg-[var(--kiosk-surface)] hover:bg-[var(--kiosk-bg-secondary)] text-2xl font-bold disabled:opacity-40"
                      aria-label="초점 가까이"
                    >
                      −
                    </button>
                    <div className="flex-1 h-14 rounded-xl border border-[var(--kiosk-border)] bg-[var(--kiosk-surface)] grid place-items-center text-lg font-semibold text-[var(--kiosk-text-primary)]">
                      {manualValue}
                    </div>
                    <button
                      type="button"
                      disabled={focusControlsDisabled}
                      onClick={() => bumpManualFocus(1)}
                      className="shrink-0 w-14 h-14 rounded-xl border border-[var(--kiosk-border)] bg-[var(--kiosk-surface)] hover:bg-[var(--kiosk-bg-secondary)] text-2xl font-bold disabled:opacity-40"
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

        <section className="rounded-3xl border border-[var(--kiosk-border)] bg-[var(--kiosk-surface)] p-5 md:p-6 flex flex-col gap-4 shadow-[var(--kiosk-shadow-soft)] overflow-auto">
          <div className="rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-bg-secondary)] p-4">
            <p className="text-base text-[var(--kiosk-text-secondary)] mb-2">최신 판정</p>
            <div className={`w-full rounded-2xl px-4 py-10 text-center text-6xl md:text-7xl text-white font-extrabold ${verdictClass}`}>
              {verdict}
            </div>
            <p className="mt-3 text-sm text-[var(--kiosk-text-secondary)]">
              {latest ? `검사시각 ${new Date(latest.inspectedAt).toLocaleTimeString('ko-KR')}` : '아직 검사 기록이 없습니다.'}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-bg-secondary)] p-4">
            <p className="text-base text-[var(--kiosk-text-secondary)] mb-3 text-center">검사 실행</p>
            <button
              type="button"
              onClick={() => {
                setActionMsg(null)
                triggerMutation.mutate()
              }}
              disabled={triggerMutation.isPending}
              className="w-full rounded-full bg-[var(--kiosk-accent)] hover:bg-[var(--kiosk-accent-hover)] disabled:opacity-50 px-6 py-6 min-h-[72px] text-2xl font-bold text-white inline-flex items-center justify-center gap-3"
            >
              {triggerMutation.isPending ? <Loader2 className="animate-spin" size={28} /> : <Camera size={28} />}
              검사 시작
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-bg-secondary)] p-4">
            <p className="text-base text-[var(--kiosk-text-secondary)] mb-3">최근 검사이력 5건</p>
            <div className="space-y-2">
              {recentLogs.length === 0 && (
                <p className="text-sm text-[var(--kiosk-text-secondary)]">표시할 검사 이력이 없습니다.</p>
              )}
              {recentLogs.map((log) => (
                <div key={log.id} className="rounded-xl border border-[var(--kiosk-border)] bg-[var(--kiosk-surface)] px-3 py-2">
                  <p className="text-sm font-semibold text-[var(--kiosk-text-primary)] truncate">
                    {log.silkBoardName?.trim() || `검사 #${log.id}`}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--kiosk-text-secondary)]">{new Date(log.inspectedAt).toLocaleTimeString('ko-KR')}</span>
                    <span className={clsx('font-semibold', log.result === 'PASS' ? 'text-[var(--kiosk-success)]' : 'text-[var(--kiosk-danger)]')}>
                      {log.result === 'PASS' ? '정상' : '불량'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {actionMsg && <p className="text-sm text-[var(--kiosk-text-secondary)]">{actionMsg}</p>}
        </section>
      </div>
    </div>
  )
}

async function waitForNewInspectionId(previousId: number): Promise<number | null> {
  /* 트리거는 파이프라인 완료 후 응답하므로 보통 1~2회 안에 잡힘. 클라우드 반영 지연 대비 여유. */
  const maxAttempts = 40
  let networkFailCount = 0
  for (let i = 0; i < maxAttempts; i += 1) {
    await delay(i === 0 ? 500 : 1000)
    let logs
    try {
      // 폴링은 짧게 실패하고 다음 턴으로 넘어가야 화면이 오래 멈추지 않는다.
      logs = await fetchRecentInspectionsWithTimeout(1, 5000)
    } catch {
      networkFailCount += 1
      if (networkFailCount >= 3) {
        throw new Error(
          '클라우드 이력 API 응답이 지연됩니다. Pi의 VITE_API_PROXY_TARGET 또는 VITE_API_BASE_URL 설정을 확인하세요.',
        )
      }
      continue
    }
    const head = logs[0]
    if (head && head.id > previousId) {
      return head.id
    }
  }
  return null
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
