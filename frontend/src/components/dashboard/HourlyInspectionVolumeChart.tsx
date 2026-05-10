/**
 * 최근 24시간 · 1시간 단위 검사 건수 — 영역+라인(주식형 느낌), 점 클릭 시 해당 시각 이력
 */

import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
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

const STROKE = '#a78bfa'
const STROKE_DIM = 'rgba(167, 139, 250, 0.45)'

function VolumeTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: HourlyVolumePoint }[]
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="glass-panel-subtle rounded-lg px-3 py-2 text-xs">
      <p className="text-[var(--dash-text-tertiary)] mb-1">{p.tooltipTitle}</p>
      <p className="text-[var(--dash-text-primary)] font-bold text-sm">{p.count}건</p>
      <p className="text-[var(--dash-text-tertiary)] mt-1">점 클릭 시 이력으로 이동</p>
    </div>
  )
}

export interface HourlyInspectionVolumeChartProps {
  lineFilter?: LineFilter
}

export default function HourlyInspectionVolumeChart({ lineFilter }: HourlyInspectionVolumeChartProps) {
  const gradId = useId().replace(/:/g, '')
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

  if (isLoading) {
    return (
      <div className="glass-panel flex min-h-[280px] flex-1 animate-pulse flex-col rounded-[22px] p-5">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <div className="h-4 w-48 rounded bg-[var(--dash-bg-secondary)]" />
          <div className="h-3 w-24 rounded bg-[var(--dash-bg-secondary)]" />
        </div>
        <div className="min-h-0 flex-1 rounded bg-[var(--dash-bg-secondary)]" />
      </div>
    )
  }

  return (
    <div className="glass-panel flex min-h-[280px] flex-1 flex-col rounded-[22px] p-5">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-[var(--dash-text-secondary)]">시간대별 검사 건수</h2>
        <span className="text-xs text-[var(--dash-text-tertiary)]">
          최근 24시간 · 1시간 단위 · {settings.timeZoneMode === 'utc' ? 'UTC' : '로컬'}
        </span>
      </div>

      <div className="min-h-0 w-full flex-1" style={{ minHeight: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STROKE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={STROKE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(152,160,200,0.18)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3c9', fontSize: 10 }}
              interval={2}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#9ca3c9', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={36}
            />
            <Tooltip content={<VolumeTooltip />} cursor={{ stroke: STROKE_DIM, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke={STROKE}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              activeDot={{ r: 6, strokeWidth: 0, fill: STROKE }}
              dot={(dotProps) => {
                const { cx, cy, payload } = dotProps as {
                  cx?: number
                  cy?: number
                  payload?: HourlyVolumePoint
                }
                if (cx == null || cy == null || !payload) return <g />
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={payload.count > 0 ? 4 : 2}
                    fill={payload.count > 0 ? STROKE : 'rgba(167,139,250,0.35)'}
                    className="cursor-pointer"
                    onClick={() => goBucket(payload)}
                  />
                )
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
