/**
 * 합격/불합격 도넛 차트 컴포넌트
 *
 * Recharts의 PieChart를 사용하여 PASS/FAIL 비율을 도넛 형태로 시각화한다.
 * 중앙에 불량률 수치를 직접 표시하여 한눈에 파악 가능하도록 설계했다.
 */

import {
  PieChart, Pie, Cell,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import { useStats } from '@/hooks/useInspectionData'
import type { PieDataPoint } from '@/types/inspection'

/* 합격/불합격 색상 */
const PASS_COLOR = '#34d399'
const FAIL_COLOR = '#fb7185'

// ── 커스텀 중앙 레이블 ────────────────────────────────────────────────────────

/**
 * 도넛 차트 중앙에 불량률을 표시하는 SVG 커스텀 레이블.
 * Recharts의 label prop으로 주입된다.
 */
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

// ── 커스텀 툴팁 ───────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="glass-panel-subtle rounded-lg px-3 py-2 text-xs">
      <span className="text-[var(--dash-text-secondary)]">{name}: </span>
      <span className="text-[var(--dash-text-primary)] font-bold">{value.toLocaleString()}건</span>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function PassFailChart() {
  const { settings } = useDashboardSettings()
  const { data: stats, isLoading } = useStats()

  /* 로딩 스켈레톤 */
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

  /* Recharts 데이터 배열 구성 */
  const pieData: PieDataPoint[] = [
    { name: 'PASS (합격)', value: stats.passCount, fill: PASS_COLOR },
    { name: 'FAIL (불합격)', value: stats.failCount, fill: FAIL_COLOR },
  ]

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
              label={({ cx, cy }) => (
                <CenterLabel
                  cx={cx}
                  cy={cy}
                  failRate={stats.failRate}
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
