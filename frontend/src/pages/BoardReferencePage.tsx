import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import {
  BOARD_REFERENCES,
  BOARD_REFERENCE_CALIBRATION_URL,
  boardOverlayUrl,
  toCountRows,
} from '@/config/boardReference'
import fiducialFallback from '@/config/fiducialScaleCalibration.json'
import { buildHistoryPath } from '@/utils/historyNavigation'

type FiducialCalibration = typeof fiducialFallback

export default function BoardReferencePage() {
  const [selectedKey, setSelectedKey] = useState<string>(BOARD_REFERENCES[0]?.key ?? '')
  const [imageError, setImageError] = useState(false)
  const [calib, setCalib] = useState<FiducialCalibration>(fiducialFallback)

  useEffect(() => {
    let cancelled = false
    fetch(BOARD_REFERENCE_CALIBRATION_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: FiducialCalibration) => {
        if (!cancelled) setCalib(j)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const selected = useMemo(
    () => BOARD_REFERENCES.find((b) => b.key === selectedKey) ?? BOARD_REFERENCES[0],
    [selectedKey]
  )

  const rows = selected ? toCountRows(selected.expectedCounts) : []
  const boardScale = selected ? calib.boards[selected.key as keyof typeof calib.boards] : undefined
  const overlaySrc = selected ? boardOverlayUrl(selected.key) : ''

  if (!selected) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--dash-text-secondary)]">
        등록된 검사 프로그램이 없습니다.
      </div>
    )
  }

  const historyForBoard = buildHistoryPath({ device: selected.key })

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--dash-bg-secondary)]">
      <div className="shrink-0 border-b border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold text-[var(--dash-text-primary)]">기판 프로그램</h1>
          <p className="text-xs text-[var(--dash-text-tertiary)]">마스터 이미지 · 기대 검출 개수 · 스케일</p>
        </div>
        <Link
          to={historyForBoard}
          className="text-xs px-3 py-1.5 rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] hover:bg-[var(--dash-bg-secondary)] text-[var(--dash-text-secondary)]"
        >
          이 기종 검사 로그
        </Link>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <aside className="shrink-0 lg:w-52 border-b lg:border-b-0 lg:border-r border-[var(--dash-border)] bg-[var(--dash-surface)] p-2 overflow-y-auto">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase text-[var(--dash-text-tertiary)]">프로그램</p>
          {BOARD_REFERENCES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => {
                setSelectedKey(b.key)
                setImageError(false)
              }}
              className={clsx(
                'w-full text-left px-3 py-2.5 rounded text-sm font-medium transition-colors',
                selected.key === b.key
                  ? 'bg-[var(--dash-accent)] text-white'
                  : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-secondary)]'
              )}
            >
              {b.label}
            </button>
          ))}
        </aside>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {selected.fiducialMarkSpacingMm != null && (
              <div className="rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2">
                <p className="text-[var(--dash-text-tertiary)]">피듀셜 간격</p>
                <p className="font-mono font-semibold text-[var(--dash-text-primary)]">{selected.fiducialMarkSpacingMm} mm</p>
              </div>
            )}
            <div className="rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2">
              <p className="text-[var(--dash-text-tertiary)]">px/mm (통합)</p>
              <p className="font-mono font-semibold">{calib.default_px_per_mm.toFixed(4)}</p>
            </div>
            {boardScale && (
              <>
                <div className="rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2">
                  <p className="text-[var(--dash-text-tertiary)]">px/mm ({selected.label})</p>
                  <p className="font-mono font-semibold text-[var(--dash-accent)]">{boardScale.px_per_mm.toFixed(4)}</p>
                </div>
                <div className="rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2">
                  <p className="text-[var(--dash-text-tertiary)]">mm/px</p>
                  <p className="font-mono font-semibold">{boardScale.mm_per_px.toFixed(6)}</p>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <section className="xl:col-span-2 border border-[var(--dash-border)] rounded-lg bg-[var(--dash-surface)] p-3">
              <h2 className="text-xs font-semibold text-[var(--dash-text-secondary)] mb-2 uppercase tracking-wide">
                마스터 오버레이
              </h2>
              {!imageError ? (
                <img
                  src={overlaySrc}
                  alt={selected.label}
                  className="w-full h-auto rounded border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)]"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-[var(--dash-text-secondary)] border border-dashed border-[var(--dash-border)] rounded">
                  이미지를 불러올 수 없습니다.
                </div>
              )}
            </section>
            <section className="border border-[var(--dash-border)] rounded-lg bg-[var(--dash-surface)] p-3">
              <h2 className="text-xs font-semibold text-[var(--dash-text-secondary)] mb-2 uppercase tracking-wide">
                기대 클래스 수량
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] text-[var(--dash-text-tertiary)] uppercase">
                    <th className="pb-2">클래스</th>
                    <th className="pb-2 text-right">수량</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--dash-border)]">
                  {rows.map((row) => (
                    <tr key={row.cls}>
                      <td className="py-2 text-[var(--dash-text-primary)]">{row.label}</td>
                      <td className="py-2 text-right font-mono text-[var(--dash-accent)]">×{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
