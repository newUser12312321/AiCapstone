/**
 * 정상/불량 비율 도넛 차트 — 세그먼트 클릭 시 검사 이력으로 이동
 */

import {
  PieChart, Pie, Cell,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useStats } from '@/hooks/useInspectionData'
import type { InspectionLog, PieDataPoint } from '@/types/inspection'
import { buildHistoryPath, getLocalDateString } from '@/utils/historyNavigation'
import type { LineFilter } from '@/utils/inspectionFilters'

const PASS_COLOR = '#16a34a'
const FAIL_COLOR = '#dc2626'

function summarize(logs: InspectionLog[]) {
  const total = logs.length
  const pass = logs.filter((l) => l.result === 'PASS').length
  const fail = logs.filter((l) => l.result === 'FAIL').length
  const failRate = total ? (fail / total) * 100 : 0
  return { pass, fail, failRate }
}

function CenterLabel({
  cx,
  cy,
  failRate,
  decimalPlaces,
  compact,
}: {
  cx: number
  cy: number
  failRate: number
  decimalPlaces: number
  compact?: boolean
}) {
  if (compact) {
    return (
      <g>
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            fill: 'var(--dash-text-primary)',
          }}
        >
          {failRate.toFixed(decimalPlaces)}%
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          style={{ fontSize: '0.6875rem', fill: 'var(--dash-text-tertiary)' }}
        >
          불량률
        </text>
      </g>
    )
  }
  return (
    <g>
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          fill: 'var(--dash-text-primary)',
        }}
      >
        {failRate.toFixed(decimalPlaces)}%
      </text>
      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        style={{ fontSize: '0.75rem', fill: 'var(--dash-text-tertiary)' }}
      >
        불량률
      </text>
    </g>
  )
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="glass-panel-subtle rounded-lg px-3 py-2 text-xs">
      <span className="text-[var(--dash-text-secondary)]">{name}: </span>
      <span className="text-[var(--dash-text-primary)] font-bold">{value.toLocaleString()}건</span>
      <p className="text-[var(--dash-text-tertiary)] mt-1">클릭하면 이력으로 이동</p>
    </div>
  )
}

export interface PassFailChartProps {
  lineFilter: LineFilter
  logs: InspectionLog[]
  /** 통계 카드 행 네 번째 칸용 — 높이·도넛 크기 축소 */
  variant?: 'default' | 'statTile'
}

export default function PassFailChart({ lineFilter, logs, variant = 'default' }: PassFailChartProps) {
  const { settings } = useDashboardSettings()
  const { data: stats, isLoading } = useStats()
  const navigate = useNavigate()
  const today = getLocalDateString()

  const useBackend =
    !(lineFilter.deviceId?.trim()) && !(lineFilter.board?.trim())

  const lineQ = {
    device: lineFilter.deviceId?.trim() || undefined,
    board: lineFilter.board?.trim() || undefined,
  }

  const goResult = (result: 'PASS' | 'FAIL') => {
    navigate(buildHistoryPath({ from: today, to: today, ...lineQ, result }))
  }

  const isTile = variant === 'statTile'
  const shellClass = isTile
    ? 'glass-panel flex min-h-[196px] h-full animate-pulse flex-col rounded-xl p-6'
    : 'glass-panel flex h-full min-h-[240px] animate-pulse flex-col rounded-xl p-5'

  if (isLoading || !stats) {
    return (
      <div className={shellClass}>
        <div className={isTile ? 'mb-2 h-4 w-32 shrink-0 rounded bg-[var(--dash-bg-secondary)]' : 'mb-4 h-4 w-36 shrink-0 rounded bg-[var(--dash-bg-secondary)]'} />
        <div className={`flex flex-1 items-center justify-center ${isTile ? 'min-h-[110px]' : ''}`}>
          <div className={`rounded-full bg-[var(--dash-bg-secondary)] ${isTile ? 'h-28 w-28' : 'h-48 w-48'}`} />
        </div>
      </div>
    )
  }

  const { pass, fail, failRate } = useBackend
    ? {
        pass: stats.passCount,
        fail: stats.failCount,
        failRate: stats.failRate,
      }
    : summarize(logs)

  const pieData: PieDataPoint[] = [
    { name: 'PASS', value: pass, fill: PASS_COLOR },
    { name: 'FAIL', value: fail, fill: FAIL_COLOR },
  ]

  if (pass === 0 && fail === 0) {
    return (
      <div
        className={
          isTile
            ? 'glass-panel flex min-h-[196px] h-full flex-col items-center justify-center rounded-xl p-6'
            : 'glass-panel flex h-full min-h-[240px] flex-col items-center justify-center rounded-xl p-5'
        }
      >
        <h2 className="mb-2 self-stretch text-[15px] font-semibold text-[var(--dash-text-secondary)]">PASS / FAIL 비율</h2>
        <p className="text-sm text-[var(--dash-text-secondary)]">표시할 PASS·FAIL 데이터가 없습니다.</p>
      </div>
    )
  }

  const handlePieClick = (_: unknown, index: number) => {
    if (index === 0) goResult('PASS')
    else goResult('FAIL')
  }

  /* statTile: 반지름이 크면 범례·패딩 안에서 도넛이 위아래로 잘림 → 여백 + 반지름 축소 */
  const innerR = isTile ? 28 : 72
  const outerR = isTile ? 44 : 100
  const chartHeight = isTile ? 130 : undefined
  const pieMargins = isTile
    ? { top: 6, right: 4, bottom: 22, left: 4 }
    : { top: 0, right: 0, bottom: 0, left: 0 }

  return (
    <div
      className={
        isTile
          ? 'glass-panel flex min-h-[196px] h-full flex-col rounded-xl p-6 transition-colors hover:border-[var(--dash-accent)]/30'
          : 'glass-panel flex h-full min-h-[240px] flex-col rounded-xl p-5'
      }
    >
      <h2 className={`shrink-0 text-[15px] font-semibold text-[var(--dash-text-secondary)] ${isTile ? 'mb-2' : 'mb-4'}`}>
        PASS / FAIL 비율
      </h2>

      <div className="min-h-0 w-full flex-1" style={chartHeight ? { height: chartHeight } : undefined}>
        <ResponsiveContainer width="100%" height={chartHeight ? chartHeight : '100%'}>
          <PieChart margin={pieMargins}>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={innerR}
              outerRadius={outerR}
              paddingAngle={3}
              dataKey="value"
              onClick={handlePieClick}
              cursor="pointer"
              label={({ cx, cy }) => (
                <CenterLabel
                  cx={cx}
                  cy={cy}
                  failRate={failRate}
                  decimalPlaces={settings.decimalPlaces}
                  compact={isTile}
                />
              )}
              labelLine={false}
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={isTile ? { fontSize: '11px', paddingTop: 4 } : undefined}
              formatter={(value) => (
                <span
                  style={{
                    color: 'var(--dash-text-secondary)',
                    fontSize: isTile ? '0.6875rem' : '0.8125rem',
                  }}
                >
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
