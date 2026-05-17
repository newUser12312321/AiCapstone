/**
 * 최근 24시간 · 1시간 단위 정상/불량 스택 막대 — 막대 클릭 시 해당 구간 이력
 */

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useHourlyInspectionVolume } from '@/hooks/useInspectionData'
import type { HourlyVolumePoint } from '@/types/inspection'
import { buildHistoryPath } from '@/utils/historyNavigation'
import type { LineFilter } from '@/utils/inspectionFilters'

const PASS_COLOR = '#16a34a'
const FAIL_COLOR = '#dc2626'

function PassFailTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { name: string; value: number; fill: string }[]
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0)
  const title = (payload[0] as { payload?: HourlyVolumePoint }).payload?.tooltipTitle

  return (
    <div className="rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-sm px-3 py-2 text-xs">
      {title && <p className="mb-1.5 text-[var(--dash-text-tertiary)]">{title}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="text-[var(--dash-text-secondary)]">{p.name}:</span>
          <span className="font-bold text-[var(--dash-text-primary)]">{p.value}건</span>
        </div>
      ))}
      <div className="mt-1.5 border-t border-[var(--dash-border)] pt-1.5 text-[var(--dash-text-tertiary)]">
        합계: <span className="text-[var(--dash-text-primary)]">{total}건</span>
      </div>
      <p className="mt-1 text-[var(--dash-text-tertiary)]">막대 클릭 시 해당 시간대 이력</p>
    </div>
  )
}

export interface HourlyInspectionVolumeChartProps {
  lineFilter?: LineFilter
  /** 대시보드 하단 슬림 차트 */
  compact?: boolean
  /** 당일 검사 건수 (소량일 때 목록 뷰 전환) */
  dayTotal?: number
  /** true면 24h 막대 대신 시간대 목록 */
  forceListView?: boolean
}

export default function HourlyInspectionVolumeChart({
  lineFilter,
  compact = false,
  dayTotal,
  forceListView = false,
}: HourlyInspectionVolumeChartProps) {
  const { settings } = useDashboardSettings()
  const { data, isLoading } = useHourlyInspectionVolume(lineFilter)
  const navigate = useNavigate()

  const lineQ = {
    device: lineFilter?.deviceId?.trim() || undefined,
    board: lineFilter?.board?.trim() || undefined,
  }

  const goBucket = (p: HourlyVolumePoint) => {
    navigate(
      buildHistoryPath({
        from: p.anchorDate,
        to: p.anchorDate,
        hour: p.hour,
        ...lineQ,
      })
    )
  }

  const handleBarClick = (raw: unknown) => {
    const rec = raw as { payload?: HourlyVolumePoint }
    const pl = rec?.payload
    if (pl?.anchorDate != null && pl.hour != null) goBucket(pl)
  }

  const total24h = useMemo(
    () => (data ?? []).reduce((sum, p) => sum + p.pass + p.fail, 0),
    [data]
  )
  const dayN = dayTotal ?? total24h
  const lowVolume = (forceListView || compact) && dayN > 0 && dayN <= 40
  const activeBuckets = useMemo(
    () => (data ?? []).filter((p) => p.pass + p.fail > 0),
    [data]
  )

  const chartH = lowVolume ? 0 : compact ? 150 : 360

  if (isLoading) {
    return (
      <div className="hmi-panel h-full animate-pulse flex flex-col">
        <div className="hmi-panel__head">
          <div className="h-3 w-40 bg-[var(--dash-bg-primary)]" />
        </div>
        <div className="flex-1 m-1 bg-[var(--dash-bg-secondary)]" style={{ minHeight: chartH }} />
      </div>
    )
  }

  if (lowVolume) {
    return (
      <div className="hmi-panel h-full flex flex-col overflow-hidden">
        <div className="hmi-panel__head">
          <span className="hmi-panel__title">시간대별 검사량</span>
          <span className="hmi-panel__meta">
            최근 24h 합계 {total24h}건 · 소량 · {settings.timeZoneMode === 'utc' ? 'UTC' : '로컬'}
          </span>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 py-1.5 text-[11px] space-y-0.5 min-h-0">
          {activeBuckets.map((p) => {
            const n = p.pass + p.fail
            return (
              <li key={`${p.anchorDate}-${p.hour}`}>
                <button
                  type="button"
                  onClick={() => goBucket(p)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1 text-left border border-[var(--dash-border)] bg-[var(--dash-surface)] hover:bg-[var(--dash-bg-secondary)]"
                >
                  <span className="text-[var(--dash-text-secondary)]">{p.label}</span>
                  <span className="dash-num shrink-0">
                    <span className="text-[var(--dash-success)]">P{p.pass}</span>
                    {' / '}
                    <span
                      className={
                        p.fail > 0 ? 'text-[var(--dash-danger)]' : 'text-[var(--dash-text-tertiary)]'
                      }
                    >
                      F{p.fail}
                    </span>
                    <span className="text-[var(--dash-text-tertiary)] ml-1">({n})</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="hmi-panel h-full flex flex-col overflow-hidden">
      <div className="hmi-panel__head">
        <span className="hmi-panel__title">시간대별 검사량</span>
        <span className="hmi-panel__meta">
          PASS/FAIL · 24h · 1h · {settings.timeZoneMode === 'utc' ? 'UTC' : '로컬'}
        </span>
      </div>

      <div className="flex-1 w-full min-h-0 px-1 pb-1" style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barCategoryGap="12%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              interval={2}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={36}
            />
            <Tooltip content={<PassFailTooltip />} cursor={{ fill: 'rgba(37,99,235,0.12)' }} />
            <Legend
              formatter={(value) => (
                <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>{value}</span>
              )}
            />
            <Bar
              dataKey="pass"
              name="PASS"
              stackId="hour"
              fill={PASS_COLOR}
              radius={[0, 0, 0, 0]}
              onClick={handleBarClick}
              cursor="pointer"
            />
            <Bar
              dataKey="fail"
              name="FAIL"
              stackId="hour"
              fill={FAIL_COLOR}
              radius={[4, 4, 0, 0]}
              onClick={handleBarClick}
              cursor="pointer"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {data.length > 0 && data.every((p) => p.pass === 0 && p.fail === 0) && (
        <p className="mt-2 text-center text-xs text-[var(--dash-text-tertiary)]">
          최근 24시간 구간에 집계된 검사가 없습니다.
        </p>
      )}
    </div>
  )
}
