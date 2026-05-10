/**
 * 합격/불합격 도넛 차트 — 세그먼트 클릭 시 검사 이력으로 이동
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

const PASS_COLOR = '#34d399'
const FAIL_COLOR = '#fb7185'

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
}: {
  cx: number
  cy: number
  failRate: number
  decimalPlaces: number
}) {
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
}

export default function PassFailChart({ lineFilter, logs }: PassFailChartProps) {
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

  if (isLoading || !stats) {
    return (
      <div className="glass-panel flex h-full min-h-[240px] animate-pulse flex-col rounded-[22px] p-5">
        <div className="mb-4 h-4 w-36 shrink-0 rounded bg-[var(--dash-bg-secondary)]" />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-48 w-48 rounded-full bg-[var(--dash-bg-secondary)]" />
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
    { name: 'PASS (합격)', value: pass, fill: PASS_COLOR },
    { name: 'FAIL (불합격)', value: fail, fill: FAIL_COLOR },
  ]

  if (pass === 0 && fail === 0) {
    return (
      <div className="glass-panel flex h-full min-h-[240px] flex-col items-center justify-center rounded-[22px] p-5">
        <p className="text-sm text-[var(--dash-text-secondary)]">표시할 합격·불합격 데이터가 없습니다.</p>
      </div>
    )
  }

  const handlePieClick = (_: unknown, index: number) => {
    if (index === 0) goResult('PASS')
    else goResult('FAIL')
  }

  return (
    <div className="glass-panel flex h-full min-h-[240px] flex-col rounded-[22px] p-5">
      <h2 className="mb-4 shrink-0 text-[15px] font-semibold text-[var(--dash-text-secondary)]">
        합격 / 불합격 비율
      </h2>

      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={72}
              outerRadius={100}
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
              formatter={(value) => (
                <span
                  style={{
                    color: 'var(--dash-text-secondary)',
                    fontSize: '0.8125rem',
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
