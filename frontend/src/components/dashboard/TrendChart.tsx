/**
 * 시간대별 검사 추이 차트 컴포넌트
 *
 * Recharts의 BarChart를 사용하여 최근 24시간 동안의 시간대별
 * PASS/FAIL 건수를 스택(누적) 막대 그래프로 시각화한다.
 *
 * 데이터는 useTrendData() 훅이 전체 이력에서 시간 단위로 집계하여 제공한다.
 */

import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useTrendData } from '@/hooks/useInspectionData'

/* 색상 상수 */
const PASS_COLOR = '#16a34a'
const FAIL_COLOR = '#dc2626'

// ── 커스텀 툴팁 ───────────────────────────────────────────────────────────────

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
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-lg px-3 py-2 text-xs shadow-[var(--dash-shadow-soft)]">
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
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function TrendChart() {
  const { data: trendData, isLoading } = useTrendData()

  /* 로딩 스켈레톤 */
  if (isLoading) {
    return (
      <div className="bg-[var(--dash-surface)] rounded-xl p-5 border border-[var(--dash-border)] h-72 animate-pulse">
        <div className="h-4 w-36 bg-[var(--dash-bg-secondary)] rounded mb-4" />
        <div className="h-full bg-[var(--dash-bg-secondary)] rounded" />
      </div>
    )
  }

  /* 데이터 없음 안내 */
  if (!trendData.length) {
    return (
      <div className="bg-[var(--dash-surface)] rounded-xl p-5 border border-[var(--dash-border)] flex items-center justify-center h-72">
        <p className="text-sm text-[var(--dash-text-secondary)]">최근 24시간 검사 데이터가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--dash-surface)] rounded-xl p-5 border border-[var(--dash-border)] shadow-[var(--dash-shadow-soft)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--dash-text-secondary)]">시간대별 검사 추이</h2>
        <span className="text-xs text-[var(--dash-text-tertiary)]">최근 24시간</span>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={trendData}
          margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          barSize={14}
        >
          {/* 배경 그리드 */}
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            vertical={false}
          />

          {/* X축: 시간 레이블 */}
          <XAxis
            dataKey="label"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />

          {/* Y축: 건수 */}
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />

          {/* 호버 툴팁 */}
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(37,99,235,0.06)' }}
          />

          {/* 범례 */}
          <Legend
            formatter={(value) => (
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{value}</span>
            )}
          />

          {/* PASS 막대 (스택 하단) */}
          <Bar dataKey="pass" name="PASS" stackId="stack" fill={PASS_COLOR} radius={[0, 0, 0, 0]} />

          {/* FAIL 막대 (스택 상단) — 상단 모서리만 둥글게 */}
          <Bar dataKey="fail" name="FAIL" stackId="stack" fill={FAIL_COLOR} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
