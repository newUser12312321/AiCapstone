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
import { useQueries } from '@tanstack/react-query'
import { fetchStats } from '@/api/inspectionApi'
import { QUERY_KEYS } from '@/hooks/useInspectionData'
import { deviceDisplayLabel } from '@/types/inspection'

const PASS_COLOR = '#16a34a'
const FAIL_COLOR = '#dc2626'

export default function DeviceVolumeChart({
  deviceIds,
  from,
  to,
  isLoadingFacets,
}: {
  deviceIds: string[]
  from?: string
  to: string
  isLoadingFacets?: boolean
}) {
  const queries = useQueries({
    queries: deviceIds.map((deviceId) => ({
      queryKey: QUERY_KEYS.stats({ from, to, deviceId }),
      queryFn: () => fetchStats({ from, to, deviceId }),
      enabled: deviceIds.length > 0,
    })),
  })

  const chartData = useMemo(() => {
    return deviceIds
      .map((id, i) => {
        const s = queries[i]?.data
        if (!s || s.totalCount === 0) return null
        return {
          deviceId: id,
          name: deviceDisplayLabel(id),
          pass: s.passCount,
          fail: s.failCount,
          total: s.totalCount,
          failRate: s.failRate,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
      .sort((a, b) => b.total - a.total)
  }, [deviceIds, queries])

  const loading = isLoadingFacets || queries.some((q) => q.isLoading)

  if (loading) {
    return (
      <div className="hmi-panel h-full min-h-[220px] animate-pulse flex flex-col">
        <div className="hmi-panel__head">
          <div className="h-3 w-24 bg-[var(--dash-bg-secondary)]" />
        </div>
        <div className="flex-1 m-2 bg-[var(--dash-bg-secondary)]" />
      </div>
    )
  }

  return (
    <div className="hmi-panel h-full flex flex-col overflow-hidden min-h-[220px]">
      <div className="hmi-panel__head shrink-0">
        <span className="hmi-panel__title">기종별 검사량</span>
        <span className="hmi-panel__meta">PASS/FAIL</span>
      </div>
      {chartData.length === 0 ? (
        <p className="flex-1 flex items-center justify-center text-sm text-[var(--dash-text-secondary)]">
          기종별 데이터 없음
        </p>
      ) : (
        <div className="flex-1 min-h-0 px-1 pb-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis
                type="category"
                dataKey="name"
                width={72}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v: number, name: string) => [`${v}건`, name]}
                labelFormatter={(label) => String(label)}
              />
              <Legend formatter={(v) => <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>{v}</span>} />
              <Bar dataKey="pass" name="PASS" stackId="dev" fill={PASS_COLOR} />
              <Bar dataKey="fail" name="FAIL" stackId="dev" fill={FAIL_COLOR} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
