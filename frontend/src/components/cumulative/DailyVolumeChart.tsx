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
import type { DailyVolumePoint } from '@/types/inspection'
import { buildHistoryPath } from '@/utils/historyNavigation'

const PASS_COLOR = '#16a34a'
const FAIL_COLOR = '#dc2626'

function VolumeTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { name: string; value: number; fill: string; payload?: DailyVolumePoint }[]
}) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div className="rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-sm px-3 py-2 text-xs">
      {point?.anchorDate && (
        <p className="mb-1.5 text-[var(--dash-text-tertiary)]">{point.anchorDate}</p>
      )}
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
    </div>
  )
}

export default function DailyVolumeChart({
  data,
  isLoading,
  deviceId,
}: {
  data: DailyVolumePoint[]
  isLoading?: boolean
  deviceId?: string
}) {
  const navigate = useNavigate()

  const chartData = useMemo(
    () => data.filter((p) => p.pass + p.fail > 0),
    [data]
  )

  const handleBarClick = (raw: unknown) => {
    const rec = raw as { payload?: DailyVolumePoint }
    const pl = rec?.payload
    if (!pl?.anchorDate) return
    navigate(
      buildHistoryPath({
        from: pl.anchorDate,
        to: pl.anchorDate,
        device: deviceId,
      })
    )
  }

  if (isLoading) {
    return (
      <div className="hmi-panel h-full animate-pulse flex flex-col min-h-[220px]">
        <div className="hmi-panel__head">
          <div className="h-3 w-32 bg-[var(--dash-bg-secondary)]" />
        </div>
        <div className="flex-1 m-2 bg-[var(--dash-bg-secondary)]" />
      </div>
    )
  }

  return (
    <div className="hmi-panel h-full flex flex-col overflow-hidden min-h-[220px]">
      <div className="hmi-panel__head shrink-0">
        <span className="hmi-panel__title">일별 검사량</span>
        <span className="hmi-panel__meta">PASS/FAIL · 막대 클릭→이력</span>
      </div>
      {chartData.length === 0 ? (
        <p className="flex-1 flex items-center justify-center text-sm text-[var(--dash-text-secondary)]">
          선택 기간에 검사 데이터가 없습니다.
        </p>
      ) : (
        <div className="flex-1 min-h-0 px-1 pb-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                interval={chartData.length > 14 ? Math.floor(chartData.length / 10) : 0}
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
              <Tooltip content={<VolumeTooltip />} cursor={{ fill: 'rgba(37,99,235,0.12)' }} />
              <Legend formatter={(v) => <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>{v}</span>} />
              <Bar dataKey="pass" name="PASS" stackId="d" fill={PASS_COLOR} onClick={handleBarClick} cursor="pointer" />
              <Bar
                dataKey="fail"
                name="FAIL"
                stackId="d"
                fill={FAIL_COLOR}
                radius={[4, 4, 0, 0]}
                onClick={handleBarClick}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
