import { useEffect, useMemo, useState } from 'react'
import {
  BOARD_REFERENCES,
  boardOverlayUrl,
  toCountRows,
} from '@/config/boardReference'
import fiducialFallback from '@/config/fiducialScaleCalibration.json'

type FiducialCalibration = typeof fiducialFallback

export default function BoardReferencePage() {
  const [selectedKey, setSelectedKey] = useState<string>(BOARD_REFERENCES[0]?.key ?? '')
  const [imageError, setImageError] = useState(false)
  const [calib, setCalib] = useState<FiducialCalibration>(fiducialFallback)

  useEffect(() => {
    let cancelled = false
    fetch('/edge/board-reference/calibration.json')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: FiducialCalibration) => {
        if (!cancelled) setCalib(j)
      })
      .catch(() => {
        /* 엣지 미기동 시 src/config 폴백 유지 */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selected = useMemo(
    () => BOARD_REFERENCES.find((b) => b.key === selectedKey) ?? BOARD_REFERENCES[0],
    [selectedKey]
  )

  const rows = selected ? toCountRows(selected.expectedCounts) : []

  const boardScale = selected
    ? calib.boards[selected.key as keyof typeof calib.boards]
    : undefined

  const overlaySrc = selected ? boardOverlayUrl(selected.key) : ''

  if (!selected) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--dash-text-secondary)]">
        등록된 기판 기준 정보가 없습니다.
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-4 bg-[var(--dash-bg-secondary)]">
      <div className="max-w-[1280px] mx-auto space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--dash-text-primary)]">기판 기준 정보</h1>
            <p className="text-sm text-[var(--dash-text-secondary)] mt-1">
              정상 라벨링 기준 이미지와 클래스 정상 개수, 피듀셜 기준 픽셀·mm 스케일을 보드별로 확인합니다.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 shadow-[var(--dash-shadow-soft)]">
            <label className="text-xs text-[var(--dash-text-secondary)]">기판 선택</label>
            <select
              value={selected.key}
              onChange={(e) => {
                setSelectedKey(e.target.value)
                setImageError(false)
              }}
              className="bg-[var(--dash-bg-secondary)] border border-[var(--dash-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--dash-text-primary)]"
            >
              {BOARD_REFERENCES.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section className="border border-[var(--dash-border)] rounded-2xl bg-[var(--dash-surface)] p-4 shadow-[var(--dash-shadow-soft)] space-y-3">
          <h2 className="text-base text-[var(--dash-text-secondary)] font-semibold">피듀셜 기준 스케일 (px ↔ mm)</h2>
          <p className="text-xs text-[var(--dash-text-tertiary)] leading-relaxed">{calib.description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-2.5">
              <div className="text-xs text-[var(--dash-text-secondary)]">통합 기본값 · px/mm</div>
              <div className="text-lg font-mono text-[var(--dash-info)]">{calib.default_px_per_mm.toFixed(6)}</div>
            </div>
            <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-2.5">
              <div className="text-xs text-[var(--dash-text-secondary)]">통합 기본값 · mm/px</div>
              <div className="text-lg font-mono text-[var(--dash-info)]">{calib.default_mm_per_px.toFixed(6)}</div>
            </div>
            {boardScale ? (
              <>
                <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-2.5">
                  <div className="text-xs text-[var(--dash-text-secondary)]">{selected.label} · px/mm</div>
                  <div className="text-lg font-mono text-[var(--dash-accent)]">{boardScale.px_per_mm.toFixed(6)}</div>
                </div>
                <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-2.5">
                  <div className="text-xs text-[var(--dash-text-secondary)]">{selected.label} · mm/px</div>
                  <div className="text-lg font-mono text-[var(--dash-accent)]">{boardScale.mm_per_px.toFixed(6)}</div>
                </div>
              </>
            ) : (
              <div className="sm:col-span-2 text-sm text-[var(--dash-text-secondary)]">
                선택 기판에 대한 보드별 스케일 항목이 없습니다.
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--dash-text-tertiary)]">{calib.notes}</p>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <section className="xl:col-span-3 border border-[var(--dash-border)] rounded-2xl bg-[var(--dash-surface)] p-4 shadow-[var(--dash-shadow-soft)]">
            <h2 className="text-base text-[var(--dash-text-secondary)] font-semibold mb-3">
              정상 라벨링 기준 이미지 (YOLO 레이아웃)
            </h2>
            <p className="text-xs text-[var(--dash-text-tertiary)] mb-3">
              해당 기판 전용 가중치로 검출한 클래스만 테두리·라벨 표시합니다. 신뢰도 %는 표시하지 않습니다. 엣지 서버(
              <code className="text-[var(--dash-text-secondary)]">/edge/board-reference/overlay.jpg</code>)가 실행 중이어야 합니다.
            </p>
            {!imageError ? (
              <img
                src={overlaySrc}
                alt={`${selected.label} 기준 검출`}
                className="w-full h-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)]"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="h-72 rounded-xl border border-dashed border-[var(--dash-border)] flex flex-col items-center justify-center text-sm text-[var(--dash-text-secondary)] px-4 text-center gap-2">
                <span>오버레이 이미지를 불러오지 못했습니다. 라즈베리파이 엣지 FastAPI가 켜져 있는지·가중치·기준 이미지 경로를 확인하세요.</span>
                <code className="text-xs break-all opacity-80">{overlaySrc}</code>
              </div>
            )}
          </section>

          <section className="xl:col-span-2 border border-[var(--dash-border)] rounded-2xl bg-[var(--dash-surface)] p-4 shadow-[var(--dash-shadow-soft)]">
            <h2 className="text-base text-[var(--dash-text-secondary)] font-semibold mb-3">정상 클래스 개수</h2>
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={row.cls}
                  className="flex items-center justify-between rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-3 py-2.5"
                >
                  <span className="text-sm font-medium text-[var(--dash-text-primary)]">{row.label}</span>
                  <span className="text-sm font-mono text-[var(--dash-info)]">X{row.count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
