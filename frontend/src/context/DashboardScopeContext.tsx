/**
 * 라인 모니터 장치 필터 — 헤더 알림·집계 범위와 동기화
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export interface DashboardScope {
  /** 빈 문자열이면 전체 라인 */
  deviceId: string
  setDeviceId: (id: string) => void
}

const DashboardScopeContext = createContext<DashboardScope | null>(null)

export function DashboardScopeProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState('')
  const value = useMemo(() => ({ deviceId, setDeviceId }), [deviceId])
  return (
    <DashboardScopeContext.Provider value={value}>{children}</DashboardScopeContext.Provider>
  )
}

/** 라인 모니터 밖에서는 null — 알림은 전체 라인 기준 */
export function useDashboardScope(): Pick<DashboardScope, 'deviceId'> | null {
  return useContext(DashboardScopeContext)
}

export function useDashboardScopeRequired(): DashboardScope {
  const ctx = useContext(DashboardScopeContext)
  if (!ctx) throw new Error('useDashboardScopeRequired must be used within DashboardScopeProvider')
  return ctx
}
