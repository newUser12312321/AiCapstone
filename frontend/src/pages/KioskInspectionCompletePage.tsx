import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Home, Loader2 } from 'lucide-react'
import { fetchInspectionById } from '@/api/inspectionApi'
import { DEFECT_COLOR, defectDisplayName } from '@/types/inspection'

function resolveImageSrc(imagePath: string | null): string | null {
  if (!imagePath) return null
  const p = imagePath.replace(/\\/g, '/')
  if (p.startsWith('http://') || p.startsWith('https://')) return p
  if (p.startsWith('/captures/')) return p
  if (p.startsWith('captures/')) return `/${p}`
  const capturesIndex = p.indexOf('/captures/')
  if (capturesIndex >= 0) return p.slice(capturesIndex)
  return p.startsWith('/') ? p : `/${p}`
}

function fiducialDistancePx(log: {
  fiducial1X: number | null
  fiducial1Y: number | null
  fiducial2X: number | null
  fiducial2Y: number | null
}): number | null {
  const { fiducial1X: x1, fiducial1Y: y1, fiducial2X: x2, fiducial2Y: y2 } = log
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null
  return Math.hypot(x2 - x1, y2 - y1)
}

export default function KioskInspectionCompletePage() {
  const navigate = useNavigate()
  const { inspectionId } = useParams<{ inspectionId: string }>()
  const id = Number(inspectionId)
  const isValidId = Number.isFinite(id) && id > 0

  const { data: log, isLoading, isError } = useQuery({
    queryKey: ['inspection', id],
    queryFn: () => fetchInspectionById(id),
    enabled: isValidId,
  })

  const imageSrc = resolveImageSrc(log?.imagePath ?? null)
  const overlayDefects = useMemo(
    () => (log?.defects ?? []).filter((d) => !d.defectType.startsWith('MISSING:')),
    [log?.defects]
  )
  const isPass = log?.result === 'PASS'
  const distance = log ? fiducialDistancePx(log) : null

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="mx-auto h-full max-w-[1700px] flex flex-col gap-4">
        <header className="rounded-2xl border border-sky-900/50 bg-gradient-to-b from-slate-900 to-slate-950 px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-cyan-100">검사 완료 (피두셜)</h1>
            <p className="text-cyan-200/70 mt-1">
              {log ? new Date(log.inspectedAt).toLocaleString('ko-KR') : '검사 결과 불러오는 중'}
            </p>
          </div>
          <div
            className={`rounded-xl px-5 py-2 text-2xl md:text-3xl font-black ${
              isPass ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {log?.result ?? 'PENDING'}
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-4 flex-1 min-h-0">
          <section className="rounded-2xl border border-sky-900/50 bg-slate-900/50 p-3 min-h-[420px] xl:min-h-0 overflow-hidden">
            {isLoading ? (
              <div className="h-full w-full grid place-items-center text-slate-300">
                <Loader2 className="animate-spin" size={36} />
              </div>
            ) : isError || !log ? (
              <div className="h-full w-full grid place-items-center text-slate-300">검사 데이터를 불러오지 못했습니다.</div>
            ) : !imageSrc ? (
              <div className="h-full w-full grid place-items-center text-slate-300">검사 이미지가 없습니다.</div>
            ) : (
              <div className="relative h-full w-full">
                <img src={imageSrc} alt="검사 결과" className="h-full w-full object-contain rounded-xl" />
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1920 1080" preserveAspectRatio="none">
                  {overlayDefects.map((d, i) => (
                    <g key={`${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`}>
                      <rect
                        x={d.bboxX}
                        y={d.bboxY}
                        width={d.bboxWidth}
                        height={d.bboxHeight}
                        fill="none"
                        stroke={DEFECT_COLOR[d.defectType] ?? '#38bdf8'}
                        strokeWidth={3}
                      />
                      <rect
                        x={d.bboxX}
                        y={Math.max(0, d.bboxY - 24)}
                        width={190}
                        height={22}
                        rx={4}
                        fill="rgba(2, 6, 23, 0.92)"
                      />
                      <text x={d.bboxX + 8} y={Math.max(0, d.bboxY - 9)} fill={DEFECT_COLOR[d.defectType] ?? '#7dd3fc'} fontSize={14} fontWeight={700}>
                        {defectDisplayName(d.defectType)} {(d.confidence * 100).toFixed(0)}%
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-sky-900/50 bg-slate-900/70 p-4 flex flex-col gap-3">
            <h2 className="text-2xl font-bold text-cyan-100">검사 정보</h2>
            <InfoRow
              label="시리즈명 (실크 OCR)"
              value={log?.silkSeriesName?.trim() || '—'}
            />
            <InfoRow
              label="기판명 (실크 OCR)"
              value={log?.silkBoardName?.trim() || '—'}
            />
            <InfoRow
              label="제조회사 (실크 OCR)"
              value={log?.silkManufacturer?.trim() || '—'}
            />
            <InfoRow
              label="제조일자 (실크 OCR)"
              value={log?.silkManufactureDate?.trim() || '—'}
            />
            <InfoRow label="검사 ID" value={log ? `#${log.id}` : '-'} />
            <InfoRow label="디바이스" value={log?.deviceId ?? '-'} />
            <InfoRow label="검출 수" value={log ? `${overlayDefects.length}건` : '-'} />
            <InfoRow label="F1 중심(px)" value={log?.fiducial1X != null && log.fiducial1Y != null ? `(${log.fiducial1X}, ${log.fiducial1Y})` : '-'} />
            <InfoRow label="F2 중심(px)" value={log?.fiducial2X != null && log.fiducial2Y != null ? `(${log.fiducial2X}, ${log.fiducial2Y})` : '-'} />
            <InfoRow label="F1-F2 거리" value={distance != null ? `${distance.toFixed(1)} px` : '-'} />
            <InfoRow label="추론 시간" value={log?.inferenceTimeMs != null ? `${log.inferenceTimeMs} ms` : '-'} />
            <InfoRow label="총 처리 시간" value={log?.totalTimeMs != null ? `${log.totalTimeMs} ms` : '-'} />

            <button
              type="button"
              onClick={() => navigate('/kiosk')}
              className="mt-auto w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-5 text-xl md:text-2xl font-bold inline-flex items-center justify-center gap-3"
            >
              <Home size={24} />
              메인 화면으로 돌아가기
            </button>
          </aside>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sky-900/40 bg-slate-950/70 px-3 py-2">
      <p className="text-sm text-cyan-300/70">{label}</p>
      <p className="text-xl font-bold text-cyan-50 mt-1">{value}</p>
    </div>
  )
}
