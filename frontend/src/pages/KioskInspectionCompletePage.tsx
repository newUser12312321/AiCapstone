import { useMemo } from 'react'

import { useNavigate, useParams } from 'react-router-dom'

import { useQuery } from '@tanstack/react-query'

import { Home, Loader2 } from 'lucide-react'

import { fetchInspectionById } from '@/api/inspectionApi'



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



  const silkPrintDefect = useMemo(

    () => (log?.defects ?? []).some((d) => d.defectType === 'SILK_SCREEN_PRINT_DEFECT'),

    [log?.defects],

  )

  const overlayDefects = useMemo(

    () =>

      (log?.defects ?? []).filter(

        (d) =>

          !d.defectType.startsWith('MISSING:') &&

          d.defectType !== 'SILK_SCREEN_PRINT_DEFECT',

      ),

    [log?.defects],

  )

  const isPass = log?.result === 'PASS'

  const kioskVerdictPrimary = silkPrintDefect ? '실크인쇄불량' : log?.result ?? 'PENDING'

  const distance = log ? fiducialDistancePx(log) : null



  return (

    <div className="kiosk-theme h-screen w-full bg-[var(--kiosk-bg-primary)] text-[var(--kiosk-text-primary)] p-4 md:p-6">

      <div className="mx-auto h-full max-w-[980px] flex flex-col gap-4">

        <header className="rounded-3xl border border-[var(--kiosk-border)] bg-[var(--kiosk-surface)] px-6 py-5 flex items-center justify-between gap-4 shadow-[var(--kiosk-shadow-soft)]">

          <div>

            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--kiosk-text-primary)]">검사 완료</h1>

            <p className="text-[var(--kiosk-text-secondary)] mt-1 text-base">

              {log ? new Date(log.inspectedAt).toLocaleString('ko-KR') : '검사 결과 불러오는 중'}

            </p>

            {silkPrintDefect && log && (

              <p className="text-[var(--kiosk-warning)] text-base font-semibold mt-2">

                실크 OCR 필드 미검출 — 시리즈·기판명·제조사·제조일을 모두 읽어야 합니다.

              </p>

            )}

          </div>

          <div

            className={`rounded-2xl px-6 py-3 text-2xl md:text-3xl font-black text-white ${

              isPass ? 'bg-[var(--kiosk-success)]' : 'bg-[var(--kiosk-danger)]'

            }`}

          >

            {kioskVerdictPrimary}

          </div>

        </header>



        <section className="flex-1 min-h-0 rounded-3xl border border-[var(--kiosk-border)] bg-[var(--kiosk-surface)] p-4 md:p-6 flex flex-col gap-4 overflow-y-auto shadow-[var(--kiosk-shadow-soft)]">

          {isLoading ? (

            <div className="flex-1 grid place-items-center text-[var(--kiosk-text-secondary)] py-24">

              <Loader2 className="animate-spin" size={36} />

            </div>

          ) : isError || !log ? (

            <div className="flex-1 grid place-items-center text-[var(--kiosk-text-secondary)] py-24">검사 데이터를 불러오지 못했습니다.</div>

          ) : (

            <>

              <h2 className="text-3xl font-bold tracking-tight text-[var(--kiosk-text-primary)] mb-1">검사 정보</h2>
              <p className="text-sm text-[var(--kiosk-text-secondary)]">핵심 정보는 상단에, 정합/좌표 상세는 하단에 배치했습니다.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InfoRow label="시리즈명 (실크 OCR)" value={log?.silkSeriesName?.trim() || '—'} />
                <InfoRow label="기판명 (실크 OCR)" value={log?.silkBoardName?.trim() || '—'} />
                <InfoRow label="제조회사 (실크 OCR)" value={log?.silkManufacturer?.trim() || '—'} />
                <InfoRow label="제조일자 (실크 OCR)" value={log?.silkManufactureDate?.trim() || '—'} />
                <InfoRow label="검사 ID" value={log ? `#${log.id}` : '-'} />
                <InfoRow label="디바이스" value={log?.deviceId ?? '-'} />
                <InfoRow label="검출 수" value={log ? `${overlayDefects.length}건` : '-'} />
                <InfoRow label="F1-F2 거리" value={distance != null ? `${distance.toFixed(1)} px` : '-'} />
                <InfoRow label="추론 시간" value={log?.inferenceTimeMs != null ? `${log.inferenceTimeMs} ms` : '-'} />
                <InfoRow label="총 처리 시간" value={log?.totalTimeMs != null ? `${log.totalTimeMs} ms` : '-'} />
              </div>

              <div className="mt-2">
                <h3 className="text-xl font-semibold tracking-tight">좌표 상세</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <InfoRow
                    label="F1 YOLO 박스 중심(px)"
                    value={log?.fiducial1XYolo != null && log.fiducial1YYolo != null ? `(${Number(log.fiducial1XYolo).toFixed(4)}, ${Number(log.fiducial1YYolo).toFixed(4)})` : '-'}
                  />
                  <InfoRow
                    label="F2 YOLO 박스 중심(px)"
                    value={log?.fiducial2XYolo != null && log.fiducial2YYolo != null ? `(${Number(log.fiducial2XYolo).toFixed(4)}, ${Number(log.fiducial2YYolo).toFixed(4)})` : '-'}
                  />
                  <InfoRow
                    label="F1 서브픽셀·정합 전(px)"
                    value={log?.fiducial1XRaw != null && log?.fiducial1YRaw != null ? `(${Number(log.fiducial1XRaw).toFixed(4)}, ${Number(log.fiducial1YRaw).toFixed(4)})` : '-'}
                  />
                  <InfoRow
                    label="F2 서브픽셀·정합 전(px)"
                    value={log?.fiducial2XRaw != null && log?.fiducial2YRaw != null ? `(${Number(log.fiducial2XRaw).toFixed(4)}, ${Number(log.fiducial2YRaw).toFixed(4)})` : '-'}
                  />
                  <InfoRow
                    label="F1 정합 후(px)"
                    value={log?.fiducial1X != null && log.fiducial1Y != null ? `(${Number(log.fiducial1X).toFixed(4)}, ${Number(log.fiducial1Y).toFixed(4)})` : '-'}
                  />
                  <InfoRow
                    label="F2 정합 후(px)"
                    value={log?.fiducial2X != null && log.fiducial2Y != null ? `(${Number(log.fiducial2X).toFixed(4)}, ${Number(log.fiducial2Y).toFixed(4)})` : '-'}
                  />
                </div>
              </div>

            </>

          )}



          <button

            type="button"

            onClick={() => navigate('/kiosk')}

            className="mt-auto w-full rounded-full bg-[var(--kiosk-accent)] hover:bg-[var(--kiosk-accent-hover)] px-6 py-5 min-h-[72px] text-2xl font-bold text-white inline-flex items-center justify-center gap-3 shrink-0"

          >

            <Home size={24} />

            메인 화면으로 돌아가기

          </button>

        </section>

      </div>

    </div>

  )

}



function InfoRow({ label, value }: { label: string; value: string }) {

  return (

    <div className="rounded-2xl border border-[var(--kiosk-border)] bg-[var(--kiosk-bg-secondary)] px-4 py-3">

      <p className="text-sm text-[var(--kiosk-text-secondary)]">{label}</p>

      <p className="text-2xl font-bold text-[var(--kiosk-text-primary)] mt-1">{value}</p>

    </div>

  )

}

