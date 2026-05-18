import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import type { InspectionStats } from '@/types/inspection'
import { buildHistoryPath } from '@/utils/historyNavigation'

const PASS_COLOR = '#16a34a'
const FAIL_COLOR = '#dc2626'

export default function CumulativePassFailChart({
  stats,
  isLoading,
  from,
  to,
  deviceId,
}: {
  stats?: InspectionStats | null
  isLoading?: boolean
  from?: string
  to?: string
  deviceId?: string
}) {
  const { formatRatePercent } = useDashboardSettings()
  const navigate = useNavigate()

  if (isLoading || !stats) {
    return (
      <div className="hmi-panel h-full min-h-[220px] animate-pulse flex flex-col">
        <div className="hmi-panel__head">
          <div className="h-3 w-28 bg-[var(--dash-bg-secondary)]" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-32 w-32 rounded-full bg-[var(--dash-bg-secondary)]" />
        </div>
      </div>
    )
  }

  const { passCount: pass, failCount: fail, failRate } = stats
  const total = pass + fail

  if (total === 0) {
    return (
      <div className="hmi-panel h-full min-h-[220px] flex flex-col items-center justify-center">
        <span className="hmi-panel__title self-stretch px-2 pt-2">PASS / FAIL 비율</span>
        <p className="text-sm text-[var(--dash-text-secondary)] py-8">데이터 없음</p>
      </div>
    )
  }

  const pieData = [
    { name: 'PASS', value: pass, fill: PASS_COLOR },
    { name: 'FAIL', value: fail, fill: FAIL_COLOR },
  ]

  const goResult = (result: 'PASS' | 'FAIL') => {
    navigate(
      buildHistoryPath({
        from,
        to,
        result,
        device: deviceId,
      })
    )
  }

  return (
    <div className="hmi-panel h-full flex flex-col overflow-hidden min-h-[220px]">
      <div className="hmi-panel__head shrink-0">
        <span className="hmi-panel__title">PASS / FAIL 비율</span>
        <span className="hmi-panel__meta">클릭→이력</span>
      </div>
      <div className="flex-1 min-h-0 px-1 pb-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
              dataKey="value"
              onClick={(_, i) => goResult(i === 0 ? 'PASS' : 'FAIL')}
              cursor="pointer"
              label={({ cx, cy }) => (
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontSize: 14, fontWeight: 700, fill: 'var(--dash-text-primary)' }}
                >
                  <tspan x={cx} dy="-0.4em">
                    {formatRatePercent(failRate)}
                  </tspan>
                  <tspan x={cx} dy="1.4em" style={{ fontSize: 10, fill: 'var(--dash-text-tertiary)' }}>
                    불량률
                  </tspan>
                </text>
              )}
              labelLine={false}
            >
              {pieData.map((e) => (
                <Cell key={e.name} fill={e.fill} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip formatter={(v: number, name: string) => [`${v.toLocaleString()}건`, name]} />
            <Legend formatter={(v) => <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
