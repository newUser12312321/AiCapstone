/**
 * 검사 상세 뷰어 — 보정 전/후 이미지에 피듀셜(F1·F2)과 결함 박스를 오버레이한다.
 */

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { X, ImageOff, AlertCircle } from 'lucide-react'
import { useInspectionById } from '@/hooks/useInspectionData'
import type { InspectionLog } from '@/types/inspection'
import { DEFECT_COLOR, defectDisplayName } from '@/types/inspection'

// ── 이미지 로드 전 기본값 (로드 후 naturalWidth/Height 사용) ───────────────
const DEFAULT_REF_WIDTH = 1920
const DEFAULT_REF_HEIGHT = 1080

/** F1·F2 중심 좌표가 모두 있을 때 화면 픽셀 기준 거리 */
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

/** 좌표 소수 표시 (검출 원본용) */
function formatFiducialPair(
  x: number | null | undefined,
  y: number | null | undefined,
): string | null {
  if (x == null || y == null) return null
  return `(${Number(x).toFixed(4)}, ${Number(y).toFixed(4)})`
}

/** 결함 박스 좌표·크기 (서브픽셀 float) 표시 */
function fmtPx(n: number): string {
  return Number(n).toFixed(4)
}

/** 정합 전(Raw) 좌표: 있으면 좌표 문자열, 정합 후만 있고 Raw만 없으면 안내(구이력/미전송) */
function formatFiducialRawOrPlaceholder(
  x: number | null | undefined,
  y: number | null | undefined,
  hasPostAlignPair: boolean,
): string | null {
  const pair = formatFiducialPair(x, y)
  if (pair != null) return pair
  if (hasPostAlignPair) {
    return '— (Raw 미저장: 이전에 저장된 이력이거나 엣지·서버가 Raw 필드 이전)'
  }
  return null
}

/** YOLO 박스 중심만: 있으면 좌표, 정합 후가 있는데 YOLO 미전송이면 안내 */
function formatFiducialYoloOrPlaceholder(
  x: number | null | undefined,
  y: number | null | undefined,
  hasPostAlignPair: boolean,
): string | null {
  const pair = formatFiducialPair(x, y)
  if (pair != null) return pair
  if (hasPostAlignPair) {
    return '— (YOLO 좌표 미저장: 구 이력 또는 엣지·서버 미배포)'
  }
  return null
}

/**
 * 엣지 `alignment.compute_alignment`: 피듀셜이 2개 미만이면 angle_error_deg = 999.
 * 이 경우 Stage2(결함) 검사는 실행되지 않으며, 결함 박스 데이터도 없다.
 */
function isFiducialAlignmentSentinel(log: InspectionLog): boolean {
  const a = log.angleErrorDeg
  return a != null && a >= 500
}

// ── 피듀셜/결함 오버레이 ───────────────────────────────────────────────────────

function FiducialMarker({
  x,
  y,
  label,
  confidence,
  scaleX,
  scaleY,
}: {
  x: number
  y: number
  label: string
  confidence: number | null | undefined
  scaleX: number
  scaleY: number
}) {
  const sx = x * scaleX
  const sy = y * scaleY
  const color = '#38bdf8'
  const gap = 5
  const arm = 16
  const cap =
    confidence != null && !Number.isNaN(confidence)
      ? `${label} ${(confidence * 100).toFixed(0)}%`
      : label
  const tw = Math.min(160, Math.max(44, cap.length * 6.2))
  const labelY = sy - 14

  return (
    <g>
      {/* 십자선 — 중앙은 비움 (실제 마크가 보이도록) */}
      <line
        x1={sx - arm}
        y1={sy}
        x2={sx - gap}
        y2={sy}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <line
        x1={sx + gap}
        y1={sy}
        x2={sx + arm}
        y2={sy}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <line
        x1={sx}
        y1={sy - arm}
        x2={sx}
        y2={sy - gap}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <line
        x1={sx}
        y1={sy + gap}
        x2={sx}
        y2={sy + arm}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <circle cx={sx} cy={sy} r={11} fill="none" stroke={color} strokeWidth={1.75} />
      {/* 라벨·신뢰도 — 마크 위쪽으로만 배치 (마크 가리지 않음) */}
      <rect
        x={sx - tw / 2}
        y={labelY - 12}
        width={tw}
        height={14}
        rx={4}
        fill="rgba(15,23,42,0.78)"
        stroke="rgba(56,189,248,0.5)"
        strokeWidth={1}
      />
      <text
        x={sx}
        y={labelY - 1}
        fill="#e0f2fe"
        fontSize={10}
        fontWeight={600}
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
      >
        {cap}
      </text>
      {/* 중심 좌표 (원본 픽셀) — 배경·큰 글자 */}
      <rect
        x={sx - 88}
        y={sy + arm + 2}
        width={176}
        height={28}
        rx={6}
        fill="rgba(15,23,42,0.95)"
        stroke="rgba(56,189,248,0.85)"
        strokeWidth={1.5}
      />
      <text
        x={sx}
        y={sy + arm + 21}
        fill="#f0f9ff"
        fontSize={14}
        fontWeight={700}
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
      >
        {`(${Number(x).toFixed(4)}, ${Number(y).toFixed(4)}) px`}
      </text>
    </g>
  )
}

function DefectBox({
  x,
  y,
  w,
  h,
  label,
  confidence,
  color,
  scaleX,
  scaleY,
}: {
  x: number
  y: number
  w: number
  h: number
  label: string
  confidence: number
  color: string
  scaleX: number
  scaleY: number
}) {
  const sx = x * scaleX
  const sy = y * scaleY
  const sw = Math.max(1, w * scaleX)
  const sh = Math.max(1, h * scaleY)
  const cap = `${label} ${(confidence * 100).toFixed(0)}%`
  const tw = Math.min(220, Math.max(88, cap.length * 7.2))
  const ty = sy > 22 ? sy - 21 : sy + 3

  return (
    <g>
      <rect x={sx} y={sy} width={sw} height={sh} rx={2} fill="none" stroke={color} strokeWidth={2} />
      <rect x={sx} y={ty} width={tw} height={17} rx={4} fill="rgba(15,23,42,0.86)" stroke={color} strokeWidth={1.1} />
      <text
        x={sx + 6}
        y={ty + 12}
        fill={color}
        fontSize={11}
        fontWeight={700}
        fontFamily="ui-monospace, monospace"
      >
        {cap}
      </text>
    </g>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

interface DefectViewerProps {
  inspectionId: number
  onClose:      () => void
  inline?: boolean
}

/**
 * 캡처 이미지 URL — 항상 `/captures/...` 상대 경로만 사용한다.
 * `npm run dev` 시 Vite가 `vite.config.ts`의 프록시로 라즈베리파이 :8000에 넘긴다.
 * (브라우저가 Pi에 직접 접속하면 PC 방화벽/망 설정에 따라 실패하기 쉬움)
 */
function resolveImageSrc(imagePath: string | null): string | null {
  if (!imagePath) return null
  const p = imagePath.replace(/\\/g, '/')
  if (p.startsWith('http://') || p.startsWith('https://')) return p

  let relative: string
  if (p.startsWith('/captures/')) {
    relative = p
  } else if (p.startsWith('captures/')) {
    relative = `/${p}`
  } else {
    const capturesIndex = p.indexOf('/captures/')
    relative = capturesIndex >= 0 ? p.slice(capturesIndex) : p
  }

  if (relative.startsWith('/')) return relative
  return relative.startsWith('captures/') ? `/${relative}` : relative
}

/**
 * 엣지 저장 규칙: `타임스탬프_deskew.jpg` ↔ 원본 `타임스탬프.jpg`
 * 보정 전 이미지 URL을 유추한다. 패턴이 아니면 null (구 이력·정렬 FAIL 등).
 */
function deriveRawImagePathFromStored(stored: string | null): string | null {
  if (!stored) return null
  const p = stored.replace(/\\/g, '/')
  const last = p.lastIndexOf('/')
  const dir = last >= 0 ? p.slice(0, last + 1) : ''
  const file = last >= 0 ? p.slice(last + 1) : p
  const m = file.match(/^(.+)_deskew(\.[^.]+)$/)
  if (!m) return null
  return `${dir}${m[1]}${m[2]}`
}

function PanelBadge({ children }: { children: ReactNode }) {
  return (
    <span className="absolute top-2 left-2 z-10 text-[10px] font-semibold uppercase tracking-wide bg-[var(--dash-overlay-bg)]/70 text-white px-2 py-0.5 rounded border border-[var(--dash-border)]">
      {children}
    </span>
  )
}

export default function DefectViewer({ inspectionId, onClose, inline = false }: DefectViewerProps) {
  const { data: log, isLoading } = useInspectionById(inspectionId)
  const deskewSrc = resolveImageSrc(log?.imagePath ?? null)
  const rawStored = deriveRawImagePathFromStored(log?.imagePath ?? null)
  const rawSrc = rawStored ? resolveImageSrc(rawStored) : null
  const showSideBySide = Boolean(rawSrc && deskewSrc)
  const f12DistancePx = log != null ? fiducialDistancePx(log) : null
  const defects = log?.defects ?? []
  const overlayDefects = defects.filter((d) => !d.defectType.startsWith('MISSING:'))
  const missingReasons = defects.filter((d) => d.defectType.startsWith('MISSING:'))

  /* 오버레이는 보정 후 이미지 기준 */
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgSize, setImgSize] = useState({ w: DEFAULT_REF_WIDTH, h: DEFAULT_REF_HEIGHT })
  const [refPixels, setRefPixels] = useState({ w: DEFAULT_REF_WIDTH, h: DEFAULT_REF_HEIGHT })
  const [deskewLoadError, setDeskewLoadError] = useState(false)
  const [rawLoadError, setRawLoadError] = useState(false)

  useEffect(() => {
    setDeskewLoadError(false)
    setRawLoadError(false)
    setRefPixels({ w: DEFAULT_REF_WIDTH, h: DEFAULT_REF_HEIGHT })
  }, [inspectionId, deskewSrc, rawSrc])

  /* 이미지가 로드되거나 창 크기가 변경되면 실제 크기 재측정 (보정 후 패널만) */
  useEffect(() => {
    const measure = () => {
      if (imgRef.current) {
        setImgSize({
          w: imgRef.current.clientWidth,
          h: imgRef.current.clientHeight,
        })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [log, showSideBySide])

  /* 픽셀 좌표 → 표시 크기 스케일 비율 */
  const scaleX = imgSize.w / Math.max(1, refPixels.w)
  const scaleY = imgSize.h / Math.max(1, refPixels.h)

  return (
    <div className={`${inline ? 'mt-0' : 'mt-4'} bg-[var(--dash-surface)] rounded-xl border border-[var(--dash-border)] overflow-hidden shadow-[var(--dash-shadow-soft)]`}>

      {/* 헤더 바 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--dash-border)]">
        <div className="flex items-center gap-2">
          <AlertCircle size={15} className="text-[var(--dash-accent)]" />
          <span className="text-sm font-semibold text-[var(--dash-text-primary)]">
            검사 상세 (피듀셜)
            {log && (
              <span className="ml-2 text-xs text-[var(--dash-text-tertiary)] font-normal">
                #{log.id} — {log.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}
              </span>
            )}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--dash-bg-secondary)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>

      {log && isFiducialAlignmentSentinel(log) && (
        <div className="px-4 py-2.5 bg-[var(--dash-warning)]/10 border-b border-[var(--dash-warning)]/25 text-[11px] text-[var(--dash-warning)] leading-relaxed">
          <strong className="text-[var(--dash-warning)]">정렬(피듀셜) 단계에서 실패했습니다.</strong> 마크가 2개
          이상 잡히지 않아 기울기 값이 999°로 기록됩니다. 이 상태에서는{' '}
          <strong>결함 검사가 실행되지 않습니다</strong> — 표시할 결함 박스가 없는 것이 정상입니다.
          <span className="text-[var(--dash-warning)]/80">
            {' '}
            엣지 <code className="text-[var(--dash-warning)]/90">YOLO_FIDUCIAL_CONFIDENCE_THRESHOLD</code>를
            0.2~0.35로 낮추거나, 학습 이미지와 비슷한 밝기·구도로 촬영해 보세요.
          </span>
        </div>
      )}

      {/* 본문 */}
      {isLoading ? (
        /* 로딩 스켈레톤 */
        <div className="h-64 animate-pulse bg-[var(--dash-bg-secondary)]" />
      ) : !log ? (
        <div className="h-32 flex items-center justify-center text-[var(--dash-text-secondary)] text-sm">
          데이터를 불러올 수 없습니다.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-0">

          {/* 좌: 보정 전 / 우: 보정 후(+오버레이) — 또는 단일 이미지 */}
          <div
            className={
              showSideBySide
                ? 'flex flex-col sm:flex-row flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-[var(--dash-border)]'
                : 'relative flex-1 bg-[var(--dash-overlay-bg)] min-h-48 border-b lg:border-b-0 lg:border-r border-[var(--dash-border)]'
            }
          >
            {showSideBySide ? (
              <>
                <div className="relative flex-1 min-w-0 bg-[var(--dash-overlay-bg)] border-b sm:border-b-0 sm:border-r border-[var(--dash-border)]">
                  <PanelBadge>보정 전</PanelBadge>
                  {rawSrc && !rawLoadError ? (
                    <img
                      src={rawSrc}
                      alt="촬영 원본"
                      className="w-full h-auto block"
                      onError={() => setRawLoadError(true)}
                    />
                  ) : (
                    <div className="w-full min-h-32 flex flex-col items-center justify-center gap-2 px-4 py-8 bg-[var(--dash-overlay-soft)]/60">
                      <ImageOff size={28} className="text-[var(--dash-text-tertiary)]" />
                      <p className="text-xs text-[var(--dash-text-secondary)]">원본 이미지를 불러오지 못했습니다.</p>
                    </div>
                  )}
                </div>
                <div className="relative flex-1 min-w-0 bg-[var(--dash-overlay-bg)]">
                  <PanelBadge>보정 후 · 피듀셜 + 결함</PanelBadge>
                  {deskewSrc && !deskewLoadError ? (
                    <>
                      <img
                        ref={imgRef}
                        src={deskewSrc}
                        alt="기울기 보정 후"
                        className="w-full h-auto block"
                        onLoad={(e) => {
                          const el = e.currentTarget
                          setRefPixels({
                            w: el.naturalWidth || DEFAULT_REF_WIDTH,
                            h: el.naturalHeight || DEFAULT_REF_HEIGHT,
                          })
                          setImgSize({ w: el.clientWidth, h: el.clientHeight })
                        }}
                        onError={() => setDeskewLoadError(true)}
                      />
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
                      >
                        {log.fiducial1X != null && log.fiducial1Y != null && (
                          <FiducialMarker
                            x={log.fiducial1X}
                            y={log.fiducial1Y}
                            label="F1"
                            confidence={log.fiducial1Confidence ?? null}
                            scaleX={scaleX}
                            scaleY={scaleY}
                          />
                        )}
                        {log.fiducial2X != null && log.fiducial2Y != null && (
                          <FiducialMarker
                            x={log.fiducial2X}
                            y={log.fiducial2Y}
                            label="F2"
                            confidence={log.fiducial2Confidence ?? null}
                            scaleX={scaleX}
                            scaleY={scaleY}
                          />
                        )}
                        {overlayDefects.map((d, i) => (
                          <DefectBox
                            key={`${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`}
                            x={d.bboxX}
                            y={d.bboxY}
                            w={d.bboxWidth}
                            h={d.bboxHeight}
                            label={defectDisplayName(d.defectType, d.detail)}
                            confidence={d.confidence}
                            color={DEFECT_COLOR[d.defectType] ?? '#f87171'}
                            scaleX={scaleX}
                            scaleY={scaleY}
                          />
                        ))}
                      </svg>
                    </>
                  ) : (
                    <div className="w-full aspect-video bg-[var(--dash-overlay-soft)]/70 flex flex-col items-center justify-center gap-2 px-4 text-center">
                      <ImageOff size={32} className="text-[var(--dash-text-tertiary)]" />
                      <p className="text-xs text-[var(--dash-text-secondary)]">보정 이미지를 불러오지 못했습니다.</p>
                    </div>
                  )}
                </div>
              </>
            ) : deskewSrc && !deskewLoadError ? (
              <div className="relative w-full">
                <img
                  ref={imgRef}
                  src={deskewSrc}
                  alt="검사 캡처 이미지"
                  className="w-full h-auto"
                  onLoad={(e) => {
                    const el = e.currentTarget
                    setRefPixels({
                      w: el.naturalWidth || DEFAULT_REF_WIDTH,
                      h: el.naturalHeight || DEFAULT_REF_HEIGHT,
                    })
                    setImgSize({ w: el.clientWidth, h: el.clientHeight })
                  }}
                  onError={() => setDeskewLoadError(true)}
                />
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
                >
                  {log.fiducial1X != null && log.fiducial1Y != null && (
                    <FiducialMarker
                      x={log.fiducial1X}
                      y={log.fiducial1Y}
                      label="F1"
                      confidence={log.fiducial1Confidence ?? null}
                      scaleX={scaleX}
                      scaleY={scaleY}
                    />
                  )}
                  {log.fiducial2X != null && log.fiducial2Y != null && (
                    <FiducialMarker
                      x={log.fiducial2X}
                      y={log.fiducial2Y}
                      label="F2"
                      confidence={log.fiducial2Confidence ?? null}
                      scaleX={scaleX}
                      scaleY={scaleY}
                    />
                  )}
                  {overlayDefects.map((d, i) => (
                    <DefectBox
                      key={`${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`}
                      x={d.bboxX}
                      y={d.bboxY}
                      w={d.bboxWidth}
                      h={d.bboxHeight}
                      label={defectDisplayName(d.defectType, d.detail)}
                      confidence={d.confidence}
                      color={DEFECT_COLOR[d.defectType] ?? '#f87171'}
                      scaleX={scaleX}
                      scaleY={scaleY}
                    />
                  ))}
                </svg>
              </div>
            ) : deskewSrc && deskewLoadError ? (
              <div className="w-full aspect-video bg-[var(--dash-overlay-soft)]/70 flex flex-col items-center justify-center gap-2 px-4 text-center">
                <ImageOff size={32} className="text-[var(--dash-text-tertiary)]" />
                <p className="text-xs text-[var(--dash-text-secondary)]">캡처 이미지를 불러오지 못했습니다.</p>
                <p className="text-xs text-[var(--dash-text-tertiary)]">
                  <code className="text-[var(--dash-accent)]">frontend/vite.config.ts</code>의{' '}
                  <code className="text-[var(--dash-accent)]">/captures</code> 프록시가 Pi IP와 맞는지,
                  Pi에서 <code className="text-[var(--dash-accent)]">uvicorn</code>이 떠 있는지 확인하세요.
                </p>
              </div>
            ) : (
              <div
                ref={imgRef as React.RefObject<HTMLDivElement> as React.RefObject<any>}
                className="w-full aspect-video bg-[var(--dash-overlay-soft)]/70 flex flex-col items-center justify-center gap-2"
              >
                <ImageOff size={32} className="text-[var(--dash-text-tertiary)]" />
                <p className="text-xs text-[var(--dash-text-secondary)]">캡처 이미지 없음</p>
                <p className="text-xs text-[var(--dash-text-tertiary)]">(더미 모드에서는 이미지가 저장되지 않습니다)</p>
              </div>
            )}
          </div>

          {/* 우측: 검사 메타데이터 패널 */}
          <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-[var(--dash-border)] p-4 shrink-0">
            <h3 className="text-xs font-semibold text-[var(--dash-text-tertiary)] uppercase tracking-wider mb-3">
              검사 정보
            </h3>

            <dl className="space-y-2.5 text-xs">
              <MetaRow label="검사 ID"     value={`#${log.id}`}              />
              <MetaRow label="디바이스"    value={log.deviceId}              />
              <MetaRow label="검사 시각"   value={new Date(log.inspectedAt).toLocaleString('ko-KR')} />
              <MetaRow
                label="시리즈명 (실크)"
                value={log.silkSeriesName?.trim() || '—'}
              />
              <MetaRow label="기판명 (실크)" value={log.silkBoardName?.trim() || '—'} />
              <MetaRow
                label="제조회사 (실크)"
                value={log.silkManufacturer?.trim() || '—'}
              />
              <MetaRow
                label="제조일자 (실크)"
                value={log.silkManufactureDate?.trim() || '—'}
              />
              <MetaRow
                label="촬영 시 기울기"
                value={
                  log.angleErrorDeg == null
                    ? '—'
                    : isFiducialAlignmentSentinel(log)
                      ? `${log.angleErrorDeg.toFixed(2)}° — 피듀셜 2개 미탐지(결함검사 생략)`
                      : `${log.angleErrorDeg.toFixed(2)}° (보정 전)`
                }
              />
              {(log.fiducial1Confidence != null || log.fiducial2Confidence != null) && (
                <MetaRow
                  label="피듀셜 conf"
                  value={[
                    log.fiducial1Confidence != null
                      ? `F1 ${(log.fiducial1Confidence * 100).toFixed(0)}%`
                      : null,
                    log.fiducial2Confidence != null
                      ? `F2 ${(log.fiducial2Confidence * 100).toFixed(0)}%`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              )}
              {formatFiducialYoloOrPlaceholder(
                log.fiducial1XYolo,
                log.fiducial1YYolo,
                log.fiducial1X != null && log.fiducial1Y != null,
              ) != null && (
                <MetaCoordRow
                  label="F1 — YOLO 박스 중심 (촬영 프레임)"
                  value={
                    formatFiducialYoloOrPlaceholder(
                      log.fiducial1XYolo,
                      log.fiducial1YYolo,
                      log.fiducial1X != null && log.fiducial1Y != null,
                    )!
                  }
                />
              )}
              {formatFiducialYoloOrPlaceholder(
                log.fiducial2XYolo,
                log.fiducial2YYolo,
                log.fiducial2X != null && log.fiducial2Y != null,
              ) != null && (
                <MetaCoordRow
                  label="F2 — YOLO 박스 중심 (촬영 프레임)"
                  value={
                    formatFiducialYoloOrPlaceholder(
                      log.fiducial2XYolo,
                      log.fiducial2YYolo,
                      log.fiducial2X != null && log.fiducial2Y != null,
                    )!
                  }
                />
              )}
              {formatFiducialRawOrPlaceholder(
                log.fiducial1XRaw,
                log.fiducial1YRaw,
                log.fiducial1X != null && log.fiducial1Y != null,
              ) != null && (
                <MetaCoordRow
                  label="F1 — 서브픽셀 보정 후 · 정합 전 (촬영 프레임)"
                  value={
                    formatFiducialRawOrPlaceholder(
                      log.fiducial1XRaw,
                      log.fiducial1YRaw,
                      log.fiducial1X != null && log.fiducial1Y != null,
                    )!
                  }
                />
              )}
              {formatFiducialRawOrPlaceholder(
                log.fiducial2XRaw,
                log.fiducial2YRaw,
                log.fiducial2X != null && log.fiducial2Y != null,
              ) != null && (
                <MetaCoordRow
                  label="F2 — 서브픽셀 보정 후 · 정합 전 (촬영 프레임)"
                  value={
                    formatFiducialRawOrPlaceholder(
                      log.fiducial2XRaw,
                      log.fiducial2YRaw,
                      log.fiducial2X != null && log.fiducial2Y != null,
                    )!
                  }
                />
              )}
              {log.fiducial1X != null && log.fiducial1Y != null && (
                <MetaCoordRow
                  label="F1 — 정합 후 (기준 좌표계)"
                  value={formatFiducialPair(log.fiducial1X, log.fiducial1Y) ?? '—'}
                />
              )}
              {log.fiducial2X != null && log.fiducial2Y != null && (
                <MetaCoordRow
                  label="F2 — 정합 후 (기준 좌표계)"
                  value={formatFiducialPair(log.fiducial2X, log.fiducial2Y) ?? '—'}
                />
              )}
              {f12DistancePx != null && (
                <MetaRow label="F1–F2 거리" value={`${f12DistancePx.toFixed(1)} px`} />
              )}
              <MetaRow label="추론 시간"   value={log.inferenceTimeMs != null ? `${log.inferenceTimeMs}ms` : '—'} />
              <MetaRow label="총 처리"     value={log.totalTimeMs != null ? `${log.totalTimeMs}ms` : '—'} />
              <MetaRow label="검출 수"     value={`${overlayDefects.length}건`} />
            </dl>

            {missingReasons.length > 0 && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <h4 className="text-[11px] font-semibold text-[var(--dash-danger)] mb-1">FAIL 원인</h4>
                <ul className="space-y-1">
                  {missingReasons.map((d, i) => (
                    <li key={`${d.defectType}-${i}`} className="text-[11px] text-[var(--dash-danger)]">
                      - {defectDisplayName(d.defectType, d.detail)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {overlayDefects.length > 0 && (
              <div className="mt-4 border-t border-[var(--dash-border)] pt-3">
                <h4 className="text-[11px] font-semibold text-[var(--dash-text-tertiary)] uppercase tracking-wider mb-2">
                  검출 좌표
                </h4>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {overlayDefects.map((d, i) => {
                    const cx = d.bboxX + d.bboxWidth / 2
                    const cy = d.bboxY + d.bboxHeight / 2
                    const color = DEFECT_COLOR[d.defectType] ?? '#f87171'
                    return (
                      <div
                        key={`${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`}
                        className="rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)] px-2.5 py-2"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-semibold truncate" style={{ color }}>
                            {i + 1}. {defectDisplayName(d.defectType, d.detail)}
                          </span>
                          <span className="text-[11px] font-mono text-[var(--dash-text-secondary)]">
                            {(d.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[var(--dash-text-secondary)] leading-relaxed">
                          <div>
                            좌상단: ({fmtPx(d.bboxX)}, {fmtPx(d.bboxY)})
                          </div>
                          <div>
                            크기: {fmtPx(d.bboxWidth)}×{fmtPx(d.bboxHeight)} px
                          </div>
                          <div className="text-[var(--dash-info)]">
                            중심: ({fmtPx(cx)}, {fmtPx(cy)})
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

/** 검사 메타 정보 행 */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-[var(--dash-text-tertiary)] shrink-0">{label}</dt>
      <dd className="text-[var(--dash-text-secondary)] font-mono text-right truncate">{value}</dd>
    </div>
  )
}

/** 피듀셜 중심 좌표 — 패널에서 가장 눈에 띄게 */
function MetaCoordRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--dash-info)]/40 bg-cyan-50 px-3 py-2.5">
      <dt className="text-[11px] font-semibold text-[var(--dash-info)] tracking-wide">{label}</dt>
      <dd className="text-base sm:text-lg font-bold font-mono text-[var(--dash-info)] tabular-nums tracking-tight break-all">
        {value}
      </dd>
    </div>
  )
}
