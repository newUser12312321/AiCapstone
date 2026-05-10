/**
 * 검사 상세 뷰어 — 보정 전/후 이미지에 피듀셜(F1·F2)과 결함 박스를 오버레이한다.
 */

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { X, ImageOff, AlertCircle, Ruler, Scale } from 'lucide-react'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useInspectionById } from '@/hooks/useInspectionData'
import type { DefectDetail, InspectionLog } from '@/types/inspection'
import { DEFECT_COLOR, defectDisplayName, deviceDisplayLabel, inspectionResultLabel } from '@/types/inspection'
import fiducialCalib from '@/config/fiducialScaleCalibration.json'

// ── 이미지 로드 전 기본값 (로드 후 naturalWidth/Height 사용) ───────────────
const DEFAULT_REF_WIDTH = 1920
const DEFAULT_REF_HEIGHT = 1080

const DEFAULT_PX_PER_MM = fiducialCalib.default_px_per_mm as number

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

/** 서브픽셀 보정 후·정합 전(Raw) 두 피듀셜 중심 간 거리(px) */
function subpixelF12DistancePx(log: InspectionLog): number | null {
  const x1 = log.fiducial1XRaw
  const y1 = log.fiducial1YRaw
  const x2 = log.fiducial2XRaw
  const y2 = log.fiducial2YRaw
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null
  return Math.hypot(x2 - x1, y2 - y1)
}

/** 기판별 피듀셜 마크 실측 간격(mm) — 전시·오차 비교용 */
function truthFiducialSpacingMm(deviceId: string): { mm: number; label: string } | null {
  const id = (deviceId ?? '').trim()
  if (id === 'GN_948X') return { mm: 117, label: 'GN-948X (117 mm)' }
  if (id === 'G_SERIES' || id === 'GT_125A') return { mm: 140, label: 'GT-125A (140 mm)' }
  return null
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

/** 검출 박스 중심 (픽셀, 정합 후 좌표계와 동일 기준) */
function defectBoxCenter(d: DefectDetail): { cx: number; cy: number } {
  return {
    cx: d.bboxX + d.bboxWidth / 2,
    cy: d.bboxY + d.bboxHeight / 2,
  }
}

type FiducialClassDistanceRow = {
  key: string
  index: number
  label: string
  cx: number
  cy: number
  distF1: number | null
  distF2: number | null
  minPx: number | null
  nearest: 'F1' | 'F2' | '—'
}

function buildFiducialClassDistanceRows(
  log: InspectionLog,
  defects: DefectDetail[],
): FiducialClassDistanceRow[] {
  const f1 =
    log.fiducial1X != null && log.fiducial1Y != null
      ? { x: log.fiducial1X, y: log.fiducial1Y }
      : null
  const f2 =
    log.fiducial2X != null && log.fiducial2Y != null
      ? { x: log.fiducial2X, y: log.fiducial2Y }
      : null

  return defects.map((d, i) => {
    const { cx, cy } = defectBoxCenter(d)
    const distF1 = f1 != null ? Math.hypot(cx - f1.x, cy - f1.y) : null
    const distF2 = f2 != null ? Math.hypot(cx - f2.x, cy - f2.y) : null
    let minPx: number | null = null
    let nearest: 'F1' | 'F2' | '—' = '—'
    if (distF1 != null && distF2 != null) {
      minPx = Math.min(distF1, distF2)
      nearest = distF1 <= distF2 ? 'F1' : 'F2'
    } else if (distF1 != null) {
      minPx = distF1
      nearest = 'F1'
    } else if (distF2 != null) {
      minPx = distF2
      nearest = 'F2'
    }
    return {
      key: `${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`,
      index: i + 1,
      label: defectDisplayName(d.defectType, d.detail),
      cx,
      cy,
      distF1,
      distF2,
      minPx,
      nearest,
    }
  })
}

/** 얇은 헤일로 + 가는 점선 — PCB 위 과밀 완화 */
function FiducialDistanceRayLines(props: {
  x1: number
  y1: number
  x2: number
  y2: number
  outerStroke: string
  innerStroke: string
  dash: string
}) {
  const { x1, y1, x2, y2, outerStroke, innerStroke, dash } = props
  return (
    <>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={outerStroke}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
      />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={innerStroke}
        strokeWidth={1.35}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
      />
    </>
  )
}

/** 거리 레이 선 생략 — 고정홀 등 대량 클래스가 선을 과도하게 늘릴 때 (표에는 그대로 유지) */
const FIDUCIAL_RAY_SKIP_DEFECT_TYPES = new Set<string>(['mount_hole', 'fiducial'])

/** 보정 후 오버레이 SVG 안 — 최단 피듀셜 ↔ 박스 중심만 연결 (F1+F2 동시 연결 생략으로 선 수 절반) */
function FiducialToClassDistanceLines({
  log,
  defects,
  scaleX,
  scaleY,
  visible,
}: {
  log: InspectionLog
  defects: DefectDetail[]
  scaleX: number
  scaleY: number
  visible: boolean
}) {
  if (!visible) return null
  const f1 =
    log.fiducial1X != null && log.fiducial1Y != null
      ? { x: log.fiducial1X * scaleX, y: log.fiducial1Y * scaleY }
      : null
  const f2 =
    log.fiducial2X != null && log.fiducial2Y != null
      ? { x: log.fiducial2X * scaleX, y: log.fiducial2Y * scaleY }
      : null

  return (
    <g aria-hidden className="pointer-events-none opacity-[0.92]">
      {defects.map((d, i) => {
        if (FIDUCIAL_RAY_SKIP_DEFECT_TYPES.has(d.defectType)) return null

        const cx = (d.bboxX + d.bboxWidth / 2) * scaleX
        const cy = (d.bboxY + d.bboxHeight / 2) * scaleY

        const distF1 = f1 != null ? Math.hypot(cx - f1.x, cy - f1.y) : Number.POSITIVE_INFINITY
        const distF2 = f2 != null ? Math.hypot(cx - f2.x, cy - f2.y) : Number.POSITIVE_INFINITY

        let from: { x: number; y: number } | null = null
        let innerStroke = '#94a3b8'
        let dash = '10 8'
        if (f1 != null && f2 != null) {
          if (distF1 <= distF2) {
            from = f1
            innerStroke = '#fcd34d'
            dash = '10 8'
          } else {
            from = f2
            innerStroke = '#d8b4fe'
            dash = '6 7'
          }
        } else if (f1 != null) {
          from = f1
          innerStroke = '#fcd34d'
          dash = '10 8'
        } else if (f2 != null) {
          from = f2
          innerStroke = '#d8b4fe'
          dash = '6 7'
        }

        if (from == null) return null

        return (
          <g key={`fid-dist-${d.defectType}-${d.bboxX}-${i}`}>
            <FiducialDistanceRayLines
              x1={from.x}
              y1={from.y}
              x2={cx}
              y2={cy}
              outerStroke="rgba(15, 23, 42, 0.42)"
              innerStroke={innerStroke}
              dash={dash}
            />
            <circle cx={cx} cy={cy} r={3} fill="rgba(15,23,42,0.55)" stroke="#f8fafc" strokeWidth={0.9} />
          </g>
        )
      })}
    </g>
  )
}

// ── 피듀셜/결함 오버레이 ───────────────────────────────────────────────────────

function FiducialMarker({
  x,
  y,
  label,
  confidence,
  scaleX,
  scaleY,
  compact = false,
}: {
  x: number
  y: number
  label: string
  confidence: number | null | undefined
  scaleX: number
  scaleY: number
  /** 거리 레이 등 다른 요소와 겹칠 때 좌표 패널·십자 크기 축소 */
  compact?: boolean
}) {
  const sx = x * scaleX
  const sy = y * scaleY
  const color = '#38bdf8'
  const gap = compact ? 4 : 5
  const arm = compact ? 12 : 16
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
      <circle cx={sx} cy={sy} r={compact ? 9 : 11} fill="none" stroke={color} strokeWidth={compact ? 1.35 : 1.75} />
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
        x={sx - (compact ? 72 : 88)}
        y={sy + arm + 2}
        width={compact ? 144 : 176}
        height={compact ? 22 : 28}
        rx={compact ? 4 : 6}
        fill="rgba(15,23,42,0.92)"
        stroke="rgba(56,189,248,0.75)"
        strokeWidth={compact ? 1.1 : 1.5}
      />
      <text
        x={sx}
        y={sy + arm + (compact ? 16 : 21)}
        fill="#f0f9ff"
        fontSize={compact ? 11 : 14}
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
      <rect x={sx} y={sy} width={sw} height={sh} rx={2} fill="none" stroke={color} strokeWidth={1.45} opacity={0.92} />
      <rect x={sx} y={ty} width={tw} height={16} rx={4} fill="rgba(15,23,42,0.82)" stroke={color} strokeWidth={0.95} />
      <text
        x={sx + 5}
        y={ty + 11}
        fill={color}
        fontSize={10}
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

function SubpixelScaleCheckPanel({
  log,
  distPx,
}: {
  log: InspectionLog
  distPx: number | null
}) {
  const x1 = log.fiducial1XRaw
  const y1 = log.fiducial1YRaw
  const x2 = log.fiducial2XRaw
  const y2 = log.fiducial2YRaw

  if (distPx == null) {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-950 dark:text-amber-100">
        서브픽셀 보정 후(Raw) F1/F2 좌표가 이 이력에 없습니다.
      </div>
    )
  }

  const derivedMm = distPx / DEFAULT_PX_PER_MM
  const truth = truthFiducialSpacingMm(log.deviceId)

  const fmtPair = (x: number | null | undefined, y: number | null | undefined) =>
    x != null && y != null ? `(${Number(x).toFixed(4)}, ${Number(y).toFixed(4)})` : '—'

  return (
    <div className="mt-3 rounded-xl border border-emerald-500/45 bg-emerald-500/[0.09] px-3 py-3 text-[11px] shadow-md">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
        서브픽셀 F1–F2 간격 vs 실측
      </h4>
      <dl className="space-y-1.5 font-mono text-[var(--dash-text-secondary)]">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--dash-text-tertiary)] shrink-0">F1 서브픽셀 (촬영)</dt>
          <dd className="min-w-0 text-right break-all">{fmtPair(x1, y1)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--dash-text-tertiary)] shrink-0">F2 서브픽셀 (촬영)</dt>
          <dd className="min-w-0 text-right break-all">{fmtPair(x2, y2)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-[var(--dash-border)]/70 pt-2">
          <dt className="text-[var(--dash-text-tertiary)] shrink-0">피듀셜 간 거리</dt>
          <dd className="tabular-nums font-semibold text-[var(--dash-text-primary)]">{distPx.toFixed(4)} px</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--dash-text-tertiary)] shrink-0">통합 기본 px/mm</dt>
          <dd className="tabular-nums">{DEFAULT_PX_PER_MM}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--dash-text-tertiary)] shrink-0">환산 길이</dt>
          <dd className="tabular-nums font-semibold text-emerald-800 dark:text-emerald-300">
            {derivedMm.toFixed(3)} mm
          </dd>
        </div>
      </dl>

      {truth != null ? (
        <div className="mt-3 rounded-lg border border-emerald-600/30 bg-[var(--dash-surface)]/80 px-2.5 py-2">
          <div className="text-[10px] font-semibold text-[var(--dash-text-tertiary)] mb-1">
            디바이스: {deviceDisplayLabel(log.deviceId)} · 기준 실측 {truth.mm} mm ({truth.label})
          </div>
          <div className="font-mono tabular-nums text-sm font-semibold">
            오차{' '}
            <span
              className={
                Math.abs(derivedMm - truth.mm) > 2
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-emerald-700 dark:text-emerald-400'
              }
            >
              {(() => {
                const errMm = derivedMm - truth.mm
                const pct = (errMm / truth.mm) * 100
                return `${errMm >= 0 ? '+' : ''}${errMm.toFixed(2)} mm (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`
              })()}
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-[var(--dash-text-tertiary)]">
            비교: 서브픽셀 두 점 거리 ÷ {DEFAULT_PX_PER_MM} 과 해당 기판 피듀셜 실측 간격의 차이입니다.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)]/80 px-2.5 py-2">
          <p className="text-[10px] font-semibold text-[var(--dash-text-tertiary)]">
            디바이스 키가 GT-125A / GN-948X 로 매핑되지 않아 두 기준을 모두 표시합니다.
          </p>
          {[
            { name: 'GT-125A', mm: 140 },
            { name: 'GN-948X', mm: 117 },
          ].map(({ name, mm }) => {
            const err = derivedMm - mm
            const pct = (err / mm) * 100
            return (
              <div key={name} className="font-mono text-[11px] tabular-nums border-t border-[var(--dash-border)]/60 pt-2 first:border-t-0 first:pt-0">
                <span className="text-[var(--dash-text-tertiary)]">{name} 실측 {mm} mm · 오차 </span>
                <span className={Math.abs(err) > 2 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-400'}>
                  {err >= 0 ? '+' : ''}
                  {err.toFixed(2)} mm ({pct >= 0 ? '+' : ''}
                  {pct.toFixed(2)}%)
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PanelBadge({ children }: { children: ReactNode }) {
  return (
    <span className="absolute top-2 left-2 z-10 text-[10px] font-semibold uppercase tracking-wide bg-[var(--dash-overlay-bg)]/70 text-white px-2 py-0.5 rounded border border-[var(--dash-border)]">
      {children}
    </span>
  )
}

export default function DefectViewer({ inspectionId, onClose, inline = false }: DefectViewerProps) {
  const { formatFullDateTime } = useDashboardSettings()
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
  const [showFiducialClassDistances, setShowFiducialClassDistances] = useState(false)
  const [showSubpixelScalePanel, setShowSubpixelScalePanel] = useState(false)

  useEffect(() => {
    setDeskewLoadError(false)
    setRawLoadError(false)
    setRefPixels({ w: DEFAULT_REF_WIDTH, h: DEFAULT_REF_HEIGHT })
  }, [inspectionId, deskewSrc, rawSrc])

  useEffect(() => {
    setShowFiducialClassDistances(false)
    setShowSubpixelScalePanel(false)
  }, [inspectionId])

  const distanceRows =
    log != null ? buildFiducialClassDistanceRows(log, overlayDefects) : []
  const hasFiducialPair =
    log != null &&
    ((log.fiducial1X != null && log.fiducial1Y != null) ||
      (log.fiducial2X != null && log.fiducial2Y != null))
  const subpixelDistPx = log != null ? subpixelF12DistancePx(log) : null
  const classDistToolEnabled =
    Boolean(log) &&
    !deskewLoadError &&
    Boolean(deskewSrc) &&
    hasFiducialPair &&
    overlayDefects.length > 0
  const scaleToolEnabled = subpixelDistPx != null

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
                #{log.id} — {log.result === 'PASS' ? '✅ 정상' : `❌ ${inspectionResultLabel(log.result)}`}
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
        <div className="flex flex-col gap-0">
          <div className="border-b border-[var(--dash-border)] bg-gradient-to-br from-[var(--dash-bg-secondary)] via-[var(--dash-surface)] to-[var(--dash-bg-secondary)]/90 px-4 py-3 shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex flex-wrap gap-3 items-stretch">
              <button
                type="button"
                disabled={!classDistToolEnabled}
                onClick={() => setShowFiducialClassDistances((v) => !v)}
                title={
                  classDistToolEnabled
                    ? '정합 후 오버레이 기준'
                    : '보정 후 이미지·피듀셜·검출 박스가 필요합니다'
                }
                className={`inline-flex min-h-[44px] flex-1 min-w-[min(100%,280px)] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md transition-all sm:max-w-md ${
                  !classDistToolEnabled
                    ? 'cursor-not-allowed border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)]/80 text-[var(--dash-text-tertiary)] opacity-55'
                    : showFiducialClassDistances
                      ? 'border-2 border-[var(--dash-accent)] bg-[var(--dash-accent)]/18 text-[var(--dash-accent)] ring-2 ring-[var(--dash-accent)]/25'
                      : 'border border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text-primary)] hover:border-[var(--dash-accent)]/50 hover:bg-[var(--dash-bg-secondary)]'
                }`}
              >
                <Ruler size={18} className="shrink-0" aria-hidden />
                <span className="text-left leading-snug">피듀셜 마크와 클래스간의 거리 확인</span>
              </button>
              <button
                type="button"
                disabled={!scaleToolEnabled}
                onClick={() => setShowSubpixelScalePanel((v) => !v)}
                title={
                  scaleToolEnabled
                    ? '서브픽셀 보정 후 두 마크 간 거리로 스케일 검증'
                    : 'F1/F2 서브픽셀(Raw) 좌표가 저장된 이력에서만 사용할 수 있습니다'
                }
                className={`inline-flex min-h-[44px] flex-1 min-w-[min(100%,280px)] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md transition-all sm:max-w-md ${
                  !scaleToolEnabled
                    ? 'cursor-not-allowed border border-[var(--dash-border)] bg-[var(--dash-bg-secondary)]/80 text-[var(--dash-text-tertiary)] opacity-55'
                    : showSubpixelScalePanel
                      ? 'border-2 border-emerald-500/90 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/25'
                      : 'border border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text-primary)] hover:border-emerald-500/45 hover:bg-[var(--dash-bg-secondary)]'
                }`}
              >
                <Scale size={18} className="shrink-0" aria-hidden />
                <span className="text-left leading-snug">피듀셜 간격 · 스케일 오차 확인</span>
              </button>
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--dash-text-tertiary)]">
              {!classDistToolEnabled && (
                <span className="block sm:inline">
                  [클래스 거리] 보정 후 캡처·피듀셜·검출 박스가 모두 있어야 합니다.{' '}
                </span>
              )}
              {!scaleToolEnabled && (
                <span className="block sm:inline">
                  [스케일] 서브픽셀 보정 후 좌표(Raw) 미저장 이력에서는 사용할 수 없습니다.{' '}
                </span>
              )}
              {classDistToolEnabled && scaleToolEnabled && (
                <span>
                  왼쪽: 정합 후 좌표 기준 오버레이 · 오른쪽: 촬영 프레임 서브픽셀 F1–F2 간격과 통합 px/mm{' '}
                  <span className="font-mono text-[var(--dash-text-secondary)]">{DEFAULT_PX_PER_MM}</span> 로 실측
                  (GT-125A 140 mm / GN-948X 117 mm) 대비 오차를 확인합니다.
                </span>
              )}
            </p>

            {showFiducialClassDistances && classDistToolEnabled && (
              <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-md">
                <table className="min-w-[640px] w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-[var(--dash-border)] bg-[var(--dash-bg-secondary)]/80">
                      <th className="px-2 py-2 font-semibold text-[var(--dash-text-tertiary)]">#</th>
                      <th className="px-2 py-2 font-semibold text-[var(--dash-text-tertiary)]">클래스</th>
                      <th className="px-2 py-2 font-semibold text-[var(--dash-text-tertiary)] whitespace-nowrap">
                        박스 중심 (px)
                      </th>
                      <th className="px-2 py-2 font-semibold text-[var(--dash-text-tertiary)] whitespace-nowrap">
                        → F1 (px)
                      </th>
                      <th className="px-2 py-2 font-semibold text-[var(--dash-text-tertiary)] whitespace-nowrap">
                        → F2 (px)
                      </th>
                      <th className="px-2 py-2 font-semibold text-[var(--dash-text-tertiary)] whitespace-nowrap">
                        최단
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--dash-border)]">
                    {distanceRows.map((row) => (
                      <tr key={row.key} className="hover:bg-[var(--dash-bg-secondary)]/40">
                        <td className="px-2 py-1.5 font-mono text-[var(--dash-text-secondary)]">{row.index}</td>
                        <td className="px-2 py-1.5 font-medium text-[var(--dash-text-primary)] max-w-[220px] truncate">
                          {row.label}
                        </td>
                        <td className="px-2 py-1.5 font-mono tabular-nums text-[var(--dash-text-secondary)] whitespace-nowrap">
                          ({row.cx.toFixed(2)}, {row.cy.toFixed(2)})
                        </td>
                        <td className="px-2 py-1.5 font-mono tabular-nums text-[var(--dash-text-secondary)]">
                          {row.distF1 != null ? row.distF1.toFixed(2) : '—'}
                        </td>
                        <td className="px-2 py-1.5 font-mono tabular-nums text-[var(--dash-text-secondary)]">
                          {row.distF2 != null ? row.distF2.toFixed(2) : '—'}
                        </td>
                        <td className="px-2 py-1.5 font-mono tabular-nums text-[var(--dash-accent)] font-semibold whitespace-nowrap">
                          {row.minPx != null ? `${row.minPx.toFixed(2)} (${row.nearest})` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-[10px] leading-snug text-[var(--dash-text-tertiary)] border-t border-[var(--dash-border)]">
                  이미지 위 선은 각 박스에서{' '}
                  <strong className="text-[var(--dash-text-secondary)]">더 가까운 피듀셜</strong>으로만 연결합니다.
                  고정홀·피듀셜 클래스는 선 밀도를 줄이기 위해 생략합니다(표에는 그대로).
                </p>
              </div>
            )}

            {showSubpixelScalePanel && log && (
              <SubpixelScaleCheckPanel log={log} distPx={subpixelDistPx} />
            )}
          </div>

          {/* 상단: 보정 전 / 보정 후(+오버레이) — 또는 단일 이미지 */}
          <div
            className={
              showSideBySide
                ? 'flex flex-col sm:flex-row flex-1 min-w-0 w-full border-b border-[var(--dash-border)]'
                : 'relative flex-1 w-full bg-[var(--dash-overlay-bg)] min-h-48 border-b border-[var(--dash-border)]'
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
                            compact={showFiducialClassDistances}
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
                            compact={showFiducialClassDistances}
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
                        <FiducialToClassDistanceLines
                          log={log}
                          defects={overlayDefects}
                          scaleX={scaleX}
                          scaleY={scaleY}
                          visible={showFiducialClassDistances && overlayDefects.length > 0}
                        />
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
                      compact={showFiducialClassDistances}
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
                      compact={showFiducialClassDistances}
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
                  <FiducialToClassDistanceLines
                    log={log}
                    defects={overlayDefects}
                    scaleX={scaleX}
                    scaleY={scaleY}
                    visible={showFiducialClassDistances && overlayDefects.length > 0}
                  />
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

          {/* 하단: 검사 메타데이터·좌표·검출 목록 */}
          <div className="w-full p-4 pb-6 shrink-0 bg-[var(--dash-bg-secondary)]/40">
            <h3 className="text-xs font-semibold text-[var(--dash-text-tertiary)] uppercase tracking-wider mb-3">
              검사 정보
            </h3>

            <dl className="space-y-2.5 text-xs">
              <MetaRow label="검사 ID"     value={`#${log.id}`}              />
              <MetaRow label="디바이스"    value={deviceDisplayLabel(log.deviceId)}              />
              <MetaRow label="검사 시각"   value={formatFullDateTime(log.inspectedAt)} />
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
                <MetaRow
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
                <MetaRow
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
                <MetaRow
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
                <MetaRow
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
                <MetaRow
                  label="F1 — 정합 후 (기준 좌표계)"
                  value={formatFiducialPair(log.fiducial1X, log.fiducial1Y) ?? '—'}
                />
              )}
              {log.fiducial2X != null && log.fiducial2Y != null && (
                <MetaRow
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
                <h4 className="text-[11px] font-semibold text-[var(--dash-danger)] mb-1">불량 원인</h4>
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
    <div className="flex justify-between gap-3 items-start">
      <dt className="text-[var(--dash-text-tertiary)] shrink-0 max-w-[46%]">{label}</dt>
      <dd className="min-w-0 flex-1 text-[var(--dash-text-secondary)] font-mono text-right break-all">
        {value}
      </dd>
    </div>
  )
}

