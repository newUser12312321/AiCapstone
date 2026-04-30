import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Camera, Loader2, RefreshCcw } from 'lucide-react'
import { triggerEdgeInspection, fetchRetryQueueStatus } from '@/api/edgeApi'
import { useRecentInspections } from '@/hooks/useInspectionData'

export default function KioskPage() {
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const { data: recentLogs = [] } = useRecentInspections(1)
  const latest = recentLogs[0]

  const queueQuery = useQuery({
    queryKey: ['edge', 'retry-queue'],
    queryFn: fetchRetryQueueStatus,
    refetchInterval: 3000,
    staleTime: 2000,
  })

  const triggerMutation = useMutation({
    mutationFn: () => triggerEdgeInspection('aligned'),
    onSuccess: (data) => setActionMsg(data.message),
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

  const transmissionText = queueQuery.isError
    ? '전송상태 확인 불가'
    : `대기 ${queueQuery.data?.pendingCount ?? 0}건`

  return (
    <div className="h-screen w-full bg-gray-950 text-white p-5 md:p-8">
      <div className="mx-auto h-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl md:text-3xl font-bold">검사 키오스크</h1>
            <span className="text-sm text-gray-400">실시간 프리뷰</span>
          </div>
          <div className="w-full h-[52vh] md:h-[70vh] rounded-xl overflow-hidden bg-black border border-gray-800">
            <img
              src="/edge/camera/stream.mjpg"
              alt="카메라 프리뷰"
              className="w-full h-full object-contain"
            />
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
            <p className="text-sm text-gray-400 mb-2">전송 상태</p>
            <p className="text-2xl font-bold">{transmissionText}</p>
            <button
              type="button"
              onClick={() => queueQuery.refetch()}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm"
            >
              <RefreshCcw size={16} />
              상태 새로고침
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setActionMsg(null)
              triggerMutation.mutate()
            }}
            disabled={triggerMutation.isPending}
            className="mt-auto w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-6 text-2xl font-bold inline-flex items-center justify-center gap-3"
          >
            {triggerMutation.isPending ? <Loader2 className="animate-spin" size={28} /> : <Camera size={28} />}
            검사 시작
          </button>

          {actionMsg && <p className="text-sm text-gray-300">{actionMsg}</p>}
        </section>
      </div>
    </div>
  )
}
