import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import type { DailyVolumePoint } from '@/types/inspection'

const YIELD_COLOR = '#1e5a9e'
const TARGET_COLOR = '#b45309'

export default function DailyYieldChart({
  data,
  isLoading,
  targetYieldPct,
}: {
  data: DailyVolumePoint[]
  isLoading?: boolean
  targetYieldPct: number
}) {
  const { formatRatePercent } = useDashboardSettings()

  const chartData = useMemo(
    () =>
      data.map((p) => {
        const n = p.pass + p.fail
        const yieldPct = n > 0 ? (p.pass / n) * 100 : null
        return {
          label: p.label,
          anchorDate: p.anchorDate,
          yieldPct,
          failRate: n > 0 ? (p.fail / n) * 100 : null,
        }
      }),
    [data]
  )

  const hasPoints = chartData.some((d) => d.yieldPct != null)

  if (isLoading) {
    return (
      <div className="hmi-panel h-full animate-pulse flex flex-col min-h-[200px]">
        <div className="hmi-panel__head">
          <div className="h-3 w-28 bg-[var(--dash-bg-secondary)]" />
        </div>
        <div className="flex-1 m-2 bg-[var(--dash-bg-secondary)]" />
      </div>
    )
  }

  return (
    <div className="hmi-panel h-full flex flex-col overflow-hidden min-h-[200px]">
      <div className="hmi-panel__head shrink-0">
        <span className="hmi-panel__title">일별 수율 추이</span>
        <span className="hmi-panel__meta">목표 {formatRatePercent(targetYieldPct)}</span>
      </div>
      {!hasPoints ? (
        <p className="flex-1 flex items-center justify-center text-sm text-[var(--dash-text-secondary)]">
          수율을 계산할 검사가 없습니다.
        </p>
      ) : (
        <div className="flex-1 min-h-0 px-1 pb-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                interval={chartData.length > 14 ? Math.floor(chartData.length / 10) : 0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value: number) => [formatRatePercent(value), '수율']}
                labelFormatter={(_, payload) =>
                  (payload?.[0]?.payload as { anchorDate?: string })?.anchorDate ?? ''
                }
                contentStyle={{
                  background: 'var(--dash-surface)',
                  border: '1px solid var(--dash-border)',
                  fontSize: 12,
                }}
              />
              <Legend formatter={(v) => <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>{v}</span>} />
              <ReferenceLine
                y={targetYieldPct}
                stroke={TARGET_COLOR}
                strokeDasharray="4 4"
                label={{ value: '목표', fill: TARGET_COLOR, fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="yieldPct"
                name="수율"
                stroke={YIELD_COLOR}
                strokeWidth={2}
                dot={{ r: 2, fill: YIELD_COLOR }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
