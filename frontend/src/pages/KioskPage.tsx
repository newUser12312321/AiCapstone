import { useCallback, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Aperture, Camera, Loader2, RefreshCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  fetchCameraFocus,
  triggerEdgeInspection,
  updateCameraFocus,
  type CameraFocusState,
} from '@/api/edgeApi'
import { fetchRecentInspections } from '@/api/inspectionApi'
import { useRecentInspections } from '@/hooks/useInspectionData'
import clsx from 'clsx'

export default function KioskPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [focusDraft, setFocusDraft] = useState<number | null>(null)
  const { data: recentLogs = [] } = useRecentInspections(1)
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
  const manualValue = focusDraft ?? focusFromServer?.value ?? 30

  const focusDebounceRef = useRef<number | null>(null)

  const applyFocus = useCallback(
    (next: CameraFocusState) => {
      focusMutation.mutate(next)
    },
    [focusMutation]
  )

  const scheduleManualFocus = useCallback(
    (value: number) => {
      if (focusDebounceRef.current != null) {
        window.clearTimeout(focusDebounceRef.current)
      }
      focusDebounceRef.current = window.setTimeout(() => {
        focusDebounceRef.current = null
        applyFocus({ auto: false, value })
      }, 320)
    },
    [applyFocus]
  )

  const triggerMutation = useMutation({
    mutationFn: () => triggerEdgeInspection('aligned'),
    onSuccess: async () => {
      const prevLatestId = latest?.id ?? 0
      setActionMsg('검사 진행 중... 결과를 확인하고 있습니다.')
      const detectedId = await waitForNewInspectionId(prevLatestId)
      if (detectedId != null) {
        navigate(`/kiosk/complete/${detectedId}`)
        return
      }
      setActionMsg('검사 완료 기록을 아직 찾지 못했습니다. 잠시 후 다시 시도해 주세요.')
    },
    onError: (e: Error) => setActionMsg(e.message || '검사 요청 실패'),
  })

  const verdict = useMemo(() => {
    if (!latest) return '대기'
    return latest.result === 'PASS' ? '정상' : '불량'
  }, [latest])

  const verdictClass = latest?.result === 'PASS'
    ? 'bg-emerald-600'
    : latest?.result === 'FAIL'
      ? 'bg-red-600'
      : 'bg-gray-700'

  const focusAuto = focusFromServer?.auto === true
  const focusControlsDisabled =
    focusQuery.isLoading || focusMutation.isPending || focusFromServer == null
  const manualSliderDisabled = focusControlsDisabled || focusAuto

  const bumpManualFocus = (delta: number) => {
    const v = Math.max(0, Math.min(255, manualValue + delta))
    setFocusDraft(v)
    applyFocus({ auto: false, value: v })
  }

  return (
    <div className="h-screen w-full bg-gray-950 text-white p-5 md:p-8">
      <div className="mx-auto h-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl md:text-3xl font-bold">검사 화면</h1>
            <span className="text-sm text-gray-400">실시간 프리뷰</span>
          </div>
          <div className="w-full h-[52vh] md:h-[70vh] rounded-xl overflow-hidden bg-black border border-gray-800">
            <img
              src="/edge/camera/stream.mjpg"
              alt="카메라 프리뷰"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="mt-3 rounded-xl border border-gray-800 bg-gray-950/80 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <Aperture size={20} className="text-indigo-400 shrink-0" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-white">프리뷰 초점</p>
                  <p className="text-xs text-gray-500">엣지 카메라(UVC) 초점 — 오토 또는 0~255 수동</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => focusQuery.refetch()}
                disabled={focusQuery.isFetching}
                className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 disabled:opacity-50"
              >
                <RefreshCcw size={14} className={focusQuery.isFetching ? 'animate-spin' : ''} />
                초점 상태 새로고침
              </button>
            </div>

            {focusQuery.isLoading && (
              <p className="mt-3 text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="animate-spin size-4" />
                초점 정보를 불러오는 중입니다…
              </p>
            )}

            {focusQuery.isError && (
              <p className="mt-3 text-sm text-amber-400/95">
                엣지에 카메라가 없거나 연결되지 않아 초점을 조절할 수 없습니다. (Pi의 Edge API가 실행 중인지 확인하세요.)
              </p>
            )}

            {focusFromServer != null && (
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500 w-full sm:w-auto">모드</span>
                  <div className="inline-flex rounded-lg border border-gray-700 p-0.5 bg-gray-900/80">
                    <button
                      type="button"
                      disabled={focusControlsDisabled || focusAuto}
                      onClick={() => {
                        setFocusDraft(null)
                        applyFocus({ auto: true, value: manualValue })
                      }}
                      className={clsx(
                        'px-4 py-2 rounded-md text-sm font-semibold transition-colors',
                        focusAuto
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800',
                      )}
                    >
                      오토포커스
                    </button>
                    <button
                      type="button"
                      disabled={focusControlsDisabled || !focusAuto}
                      onClick={() => {
                        setFocusDraft(null)
                        applyFocus({ auto: false, value: focusFromServer.value })
                      }}
                      className={clsx(
                        'px-4 py-2 rounded-md text-sm font-semibold transition-colors',
                        !focusAuto
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800',
                      )}
                    >
                      수동 초점
                    </button>
                  </div>
                  {focusMutation.isPending && (
                    <Loader2 className="animate-spin size-4 text-indigo-400" aria-label="적용 중" />
                  )}
                </div>

                <div className={clsx('flex flex-col gap-2', manualSliderDisabled && 'opacity-60')}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">수동 값</span>
                    <span className="text-sm font-mono tabular-nums text-indigo-300">{manualValue}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={manualSliderDisabled}
                      onClick={() => bumpManualFocus(-10)}
                      className="shrink-0 w-11 h-11 rounded-lg bg-gray-800 hover:bg-gray-700 text-lg font-bold disabled:opacity-40"
                      aria-label="초점 가까이"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={255}
                      value={manualValue}
                      disabled={manualSliderDisabled}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setFocusDraft(v)
                        scheduleManualFocus(v)
                      }}
                      className="flex-1 min-w-0 h-2 accent-indigo-500 disabled:cursor-not-allowed"
                      aria-label="수동 초점"
                    />
                    <button
                      type="button"
                      disabled={manualSliderDisabled}
                      onClick={() => bumpManualFocus(10)}
                      className="shrink-0 w-11 h-11 rounded-lg bg-gray-800 hover:bg-gray-700 text-lg font-bold disabled:opacity-40"
                      aria-label="초점 멀리"
                    >
                      +
                    </button>
                  </div>
                  {focusAuto && (
                    <p className="text-xs text-gray-600">수동 슬라이더를 쓰려면 &ldquo;수동 초점&rdquo;을 누르세요.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 flex flex-col gap-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
            <p className="text-sm text-gray-400 mb-2">최신 판정</p>
            <div className={`w-full rounded-xl px-4 py-6 text-center text-4xl md:text-5xl font-extrabold ${verdictClass}`}>
              {verdict}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {latest ? `검사시각 ${new Date(latest.inspectedAt).toLocaleTimeString('ko-KR')}` : '아직 검사 기록이 없습니다.'}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
            <p className="text-sm text-gray-400 mb-3 text-center">검사</p>
            <button
              type="button"
              onClick={() => {
                setActionMsg(null)
                triggerMutation.mutate()
              }}
              disabled={triggerMutation.isPending}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-6 text-2xl font-bold inline-flex items-center justify-center gap-3"
            >
              {triggerMutation.isPending ? <Loader2 className="animate-spin" size={28} /> : <Camera size={28} />}
              검사 시작
            </button>
          </div>

          {actionMsg && <p className="text-sm text-gray-300">{actionMsg}</p>}
        </section>
      </div>
    </div>
  )
}

async function waitForNewInspectionId(previousId: number): Promise<number | null> {
  const maxAttempts = 10
  for (let i = 0; i < maxAttempts; i += 1) {
    await delay(1000)
    const logs = await fetchRecentInspections(1)
    const latest = logs[0]
    if (latest && latest.id > previousId) {
      return latest.id
    }
  }
  return null
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
