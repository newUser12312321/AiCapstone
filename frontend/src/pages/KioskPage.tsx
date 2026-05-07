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
import { fetchRecentInspectionsWithTimeout } from '@/api/inspectionApi'
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

  const verdict = useMemo(() => {
    if (!latest) return '대기'
    return latest.result === 'PASS' ? '정상' : '불량'
  }, [latest])

  const verdictClass = latest?.result === 'PASS'
    ? 'bg-emerald-500'
    : latest?.result === 'FAIL'
      ? 'bg-red-500'
      : 'bg-gray-400'

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
    <div className="h-screen w-full bg-[#f5f5f7] text-[#111111] p-4 md:p-8">
      <div className="mx-auto h-full max-w-7xl grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <section className="rounded-3xl border border-[#d2d2d7] bg-white p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-[#6e6e73]">PCB Inspection Kiosk</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">검사 화면</h1>
            </div>
            <span className="text-sm px-3 h-9 inline-flex items-center rounded-full border border-[#d2d2d7] bg-[#f5f5f7] text-[#6e6e73]">실시간 프리뷰</span>
          </div>
          <div className="w-full h-[52vh] md:h-[70vh] rounded-2xl overflow-hidden bg-black border border-[#d2d2d7]">
            <img
              src="/edge/camera/stream.mjpg"
              alt="카메라 프리뷰"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="mt-4 rounded-2xl border border-[#d2d2d7] bg-[#f5f5f7] p-4 md:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <Aperture size={20} className="text-[#0071e3] shrink-0" aria-hidden />
                <div>
                  <p className="text-base font-semibold text-[#111111]">프리뷰 초점</p>
                  <p className="text-sm text-[#6e6e73]">엣지 카메라(UVC) 초점 - 오토 또는 0~255 수동</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => focusQuery.refetch()}
                disabled={focusQuery.isFetching}
                className="self-start inline-flex items-center gap-2 px-4 h-12 rounded-full border border-[#d2d2d7] bg-white hover:bg-[#f0f0f2] text-sm text-[#111111] disabled:opacity-50"
              >
                <RefreshCcw size={14} className={focusQuery.isFetching ? 'animate-spin' : ''} />
                초점 상태 새로고침
              </button>
            </div>

            {focusQuery.isLoading && (
              <p className="mt-3 text-sm text-[#6e6e73] flex items-center gap-2">
                <Loader2 className="animate-spin size-4" />
                초점 정보를 불러오는 중입니다…
              </p>
            )}

            {focusQuery.isError && (
              <p className="mt-3 text-sm text-amber-700">
                엣지에 카메라가 없거나 연결되지 않아 초점을 조절할 수 없습니다. (Pi의 Edge API가 실행 중인지 확인하세요.)
              </p>
            )}

            {focusFromServer != null && (
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[#6e6e73] w-full sm:w-auto">모드</span>
                  <div className="inline-flex rounded-xl border border-[#d2d2d7] p-1 bg-white">
                    <button
                      type="button"
                      disabled={focusControlsDisabled || focusAuto}
                      onClick={() => {
                        setFocusDraft(null)
                        applyFocus({ auto: true, value: manualValue })
                      }}
                      className={clsx(
                        'px-5 h-12 rounded-lg text-base font-semibold transition-colors',
                        focusAuto
                          ? 'bg-[#0071e3] text-white'
                          : 'text-[#6e6e73] hover:text-[#111111] hover:bg-[#f5f5f7]',
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
                        'px-5 h-12 rounded-lg text-base font-semibold transition-colors',
                        !focusAuto
                          ? 'bg-[#0071e3] text-white'
                          : 'text-[#6e6e73] hover:text-[#111111] hover:bg-[#f5f5f7]',
                      )}
                    >
                      수동 초점
                    </button>
                  </div>
                  {focusMutation.isPending && (
                    <Loader2 className="animate-spin size-4 text-[#0071e3]" aria-label="적용 중" />
                  )}
                </div>

                <div className={clsx('flex flex-col gap-2', manualSliderDisabled && 'opacity-60')}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[#6e6e73]">수동 값</span>
                    <span className="text-base font-mono tabular-nums text-[#0071e3]">{manualValue}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={manualSliderDisabled}
                      onClick={() => bumpManualFocus(-10)}
                      className="shrink-0 w-14 h-14 rounded-xl border border-[#d2d2d7] bg-white hover:bg-[#f5f5f7] text-2xl font-bold disabled:opacity-40"
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
                      className="flex-1 min-w-0 h-3 accent-[#0071e3] disabled:cursor-not-allowed"
                      aria-label="수동 초점"
                    />
                    <button
                      type="button"
                      disabled={manualSliderDisabled}
                      onClick={() => bumpManualFocus(10)}
                      className="shrink-0 w-14 h-14 rounded-xl border border-[#d2d2d7] bg-white hover:bg-[#f5f5f7] text-2xl font-bold disabled:opacity-40"
                      aria-label="초점 멀리"
                    >
                      +
                    </button>
                  </div>
                  {focusAuto && (
                    <p className="text-sm text-[#6e6e73]">수동 슬라이더를 쓰려면 &ldquo;수동 초점&rdquo;을 누르세요.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-[#d2d2d7] bg-white p-5 md:p-6 flex flex-col gap-4 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
          <div className="rounded-2xl border border-[#d2d2d7] bg-[#f5f5f7] p-4">
            <p className="text-base text-[#6e6e73] mb-2">최신 판정</p>
            <div className={`w-full rounded-2xl px-4 py-8 text-center text-5xl md:text-6xl text-white font-extrabold ${verdictClass}`}>
              {verdict}
            </div>
            <p className="mt-3 text-sm text-[#6e6e73]">
              {latest ? `검사시각 ${new Date(latest.inspectedAt).toLocaleTimeString('ko-KR')}` : '아직 검사 기록이 없습니다.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#d2d2d7] bg-[#fafafc] px-4 py-3">
              <p className="text-xs text-[#6e6e73]">상태</p>
              <p className="text-lg font-semibold">{triggerMutation.isPending ? '검사중' : '대기중'}</p>
            </div>
            <div className="rounded-2xl border border-[#d2d2d7] bg-[#fafafc] px-4 py-3">
              <p className="text-xs text-[#6e6e73]">초점 모드</p>
              <p className="text-lg font-semibold">{focusAuto ? '오토' : '수동'}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d2d2d7] bg-[#f5f5f7] p-4">
            <p className="text-base text-[#6e6e73] mb-3 text-center">검사 실행</p>
            <button
              type="button"
              onClick={() => {
                setActionMsg(null)
                triggerMutation.mutate()
              }}
              disabled={triggerMutation.isPending}
              className="w-full rounded-full bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-50 px-6 py-6 min-h-[72px] text-2xl font-bold text-white inline-flex items-center justify-center gap-3"
            >
              {triggerMutation.isPending ? <Loader2 className="animate-spin" size={28} /> : <Camera size={28} />}
              검사 시작
            </button>
          </div>

          {actionMsg && <p className="text-sm text-[#6e6e73]">{actionMsg}</p>}
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
