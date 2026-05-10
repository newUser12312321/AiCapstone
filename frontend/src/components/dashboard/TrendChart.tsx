/**
 * 시간대별 검사 추이 — 막대 클릭 시 해당 일·시간대 이력으로 이동
 */

import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useTrendData } from '@/hooks/useInspectionData'
import { buildHistoryPath, getLocalDateString } from '@/utils/historyNavigation'
import type { LineFilter } from '@/utils/inspectionFilters'

const PASS_COLOR = '#34d399'
const FAIL_COLOR = '#fb7185'

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: { name: string; value: number; fill: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0)

  return (
    <div className="glass-panel-subtle rounded-lg px-3 py-2 text-xs">
      <p className="text-[var(--dash-text-tertiary)] mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: p.fill }}
          />
          <span className="text-[var(--dash-text-secondary)]">{p.name}:</span>
          <span className="text-[var(--dash-text-primary)] font-bold">{p.value}건</span>
        </div>
      ))}
      <div className="border-t border-[var(--dash-border)] mt-1.5 pt-1.5 text-[var(--dash-text-tertiary)]">
        합계: <span className="text-[var(--dash-text-primary)]">{total}건</span>
      </div>
      <p className="text-[var(--dash-text-tertiary)] mt-1">막대 클릭 시 이력 필터</p>
    </div>
  )
}

export interface TrendChartProps {
  lineFilter: LineFilter
}

export default function TrendChart({ lineFilter }: TrendChartProps) {
  const { data: trendData, isLoading } = useTrendData(lineFilter)
  const navigate = useNavigate()
  const today = getLocalDateString()

  const lineQ = {
    device: lineFilter.deviceId?.trim() || undefined,
    board: lineFilter.board?.trim() || undefined,
  }

  const handleBarClick = (raw: unknown) => {
    const rec = raw as { payload?: { label: string; anchorDate?: string } }
    const pl = rec?.payload
    if (!pl?.label) return
    const hour = Number.parseInt(pl.label.split(':')[0], 10)
    if (Number.isNaN(hour)) return
    const anchor = pl.anchorDate ?? today
    navigate(
      buildHistoryPath({
        from: anchor,
        to: anchor,
        hour,
        ...lineQ,
      })
    )
  }

  if (isLoading) {
    return (
      <div className="glass-panel flex h-full min-h-[240px] animate-pulse flex-col rounded-[22px] p-5">
        <div className="mb-4 h-4 w-36 shrink-0 rounded bg-[var(--dash-bg-secondary)]" />
        <div className="min-h-0 flex-1 rounded bg-[var(--dash-bg-secondary)]" />
      </div>
    )
  }

  if (!trendData.length) {
    return (
      <div className="glass-panel flex h-full min-h-[240px] flex-col items-center justify-center rounded-[22px] p-5">
        <p className="text-sm text-[var(--dash-text-secondary)]">최근 24시간 검사 데이터가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="glass-panel flex h-full min-h-[240px] flex-col rounded-[22px] p-5">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h2 className="text-[15px] font-semibold text-[var(--dash-text-secondary)]">시간대별 검사 추이</h2>
        <span className="text-xs text-[var(--dash-text-tertiary)]">최근 24시간</span>
      </div>

      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={trendData}
          margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          barSize={14}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(152,160,200,0.22)"
            vertical={false}
          />

          <XAxis
            dataKey="label"
            tick={{ fill: '#c7cdef', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tick={{ fill: '#c7cdef', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(139,92,246,0.16)' }}
          />

          <Legend
            formatter={(value) => (
              <span style={{ color: '#c7cdef', fontSize: '0.8125rem' }}>{value}</span>
            )}
          />

          <Bar
            dataKey="pass"
            name="정상"
            stackId="stack"
            fill={PASS_COLOR}
            radius={[0, 0, 0, 0]}
            onClick={handleBarClick}
            cursor="pointer"
          />

          <Bar
            dataKey="fail"
            name="불량"
            stackId="stack"
            fill={FAIL_COLOR}
            radius={[3, 3, 0, 0]}
            onClick={handleBarClick}
            cursor="pointer"
          />
        </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
