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

function yieldDomain(
  values: number[],
  targetYieldPct: number
): [number, number] {
  if (values.length === 0) return [0, 100]
  const minV = Math.min(...values, targetYieldPct)
  const maxV = Math.max(...values, targetYieldPct)
  const pad = Math.max(8, (maxV - minV) * 0.15)
  return [Math.max(0, Math.floor(minV - pad)), Math.min(100, Math.ceil(maxV + pad))]
}

export default function DailyYieldChart({
  data,
  isLoading,
  targetYieldPct,
  compact = false,
}: {
  data: DailyVolumePoint[]
  isLoading?: boolean
  targetYieldPct: number
  compact?: boolean
}) {
  const { formatRatePercent } = useDashboardSettings()

  const chartData = useMemo(() => {
    return data
      .filter((p) => p.pass + p.fail > 0)
      .map((p) => {
        const n = p.pass + p.fail
        return {
          label: p.label,
          anchorDate: p.anchorDate,
          yieldPct: (p.pass / n) * 100,
        }
      })
  }, [data])

  const yDomain = useMemo(
    () => yieldDomain(chartData.map((d) => d.yieldPct), targetYieldPct),
    [chartData, targetYieldPct]
  )

  const panelClass = compact
    ? 'hmi-panel h-full flex flex-col overflow-hidden min-h-0'
    : 'hmi-panel h-full flex flex-col overflow-hidden min-h-[200px]'
  const chartPx = compact ? 112 : undefined

  if (isLoading) {
    return (
      <div className={`${panelClass} animate-pulse`}>
        <div className="hmi-panel__head py-1">
          <div className="h-3 w-28 bg-[var(--dash-bg-secondary)]" />
        </div>
        <div
          className="mx-1.5 mb-1.5 bg-[var(--dash-bg-secondary)]"
          style={{ height: chartPx ?? 120 }}
        />
      </div>
    )
  }

  return (
    <div className={panelClass}>
      <div className={`hmi-panel__head shrink-0 ${compact ? 'py-1' : ''}`}>
        <span className="hmi-panel__title">일별 수율 추이</span>
        <span className="hmi-panel__meta">
          목표 {formatRatePercent(targetYieldPct)}
          {chartData.length > 0 && chartData.length <= 14
            ? ` · ${chartData.length}일`
            : ''}
        </span>
      </div>
      {chartData.length === 0 ? (
        <p
          className={
            compact
              ? 'py-3 text-center text-xs text-[var(--dash-text-secondary)]'
              : 'flex-1 flex items-center justify-center text-sm text-[var(--dash-text-secondary)]'
          }
        >
          수율을 계산할 검사가 없습니다.
        </p>
      ) : (
        <div
          className={compact ? 'shrink-0 px-1 pb-0.5' : 'flex-1 min-h-0 px-1 pb-1'}
          style={chartPx ? { height: chartPx } : undefined}
        >
          <ResponsiveContainer width="100%" height={chartPx ?? '100%'}>
            <LineChart
              data={chartData}
              margin={compact ? { top: 4, right: 8, left: 0, bottom: 0 } : { top: 8, right: 8, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#6b7280', fontSize: compact ? 9 : 10 }}
                interval={chartData.length > 12 ? Math.floor(chartData.length / 8) : 0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: '#6b7280', fontSize: compact ? 10 : 11 }}
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
              <Legend
                wrapperStyle={compact ? { fontSize: 10, paddingTop: 0 } : undefined}
                formatter={(v) => <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>{v}</span>}
              />
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
                dot={{ r: 3, fill: YIELD_COLOR }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
