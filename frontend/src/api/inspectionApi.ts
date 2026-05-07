/**
 * Spring Boot REST API 클라이언트
 *
 * Axios 인스턴스를 생성하고 인터셉터로 공통 에러 처리를 설정한다.
 * vite.config.ts의 proxy 설정 덕분에 /api/* 요청은 자동으로
 * http://localhost:8080 으로 포워딩된다.
 */

import axios from 'axios'
import type { InspectionLog, InspectionStats } from '@/types/inspection'

// ── Axios 인스턴스 생성 ───────────────────────────────────────────────────────
const apiBaseUrlFromEnv = import.meta.env.VITE_API_BASE_URL?.trim()

const apiClient = axios.create({
  /*
   * 기본은 Vite 프록시(/api).
   * 라즈베리파이 키오스크에서 프록시 타깃 설정이 어려우면
   * VITE_API_BASE_URL(예: http://192.168.0.10:8080/api)로 직접 지정할 수 있다.
   */
  baseURL: apiBaseUrlFromEnv || '/api',
  /* Pi 키오스크 → 클라우드 VM 왕복 시 10초 부족으로 폴링 실패하는 경우가 있어 여유를 둠 */
  timeout: 45_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ── 응답 인터셉터: 전역 에러 처리 ─────────────────────────────────────────────

apiClient.interceptors.response.use(
  /* 성공 응답은 그대로 통과 */
  (response) => response,
  /* 에러 응답은 콘솔에 로깅 후 reject */
  (error) => {
    const status  = error.response?.status
    const message = error.response?.data?.message ?? error.message

    if (status === 404) {
      console.warn(`[API] 리소스 없음: ${message}`)
    } else if (status >= 500) {
      console.error(`[API] 서버 오류 ${status}: ${message}`)
    } else {
      console.error(`[API] 요청 오류: ${message}`)
    }

    return Promise.reject(error)
  }
)

// ── API 함수 모음 ─────────────────────────────────────────────────────────────

/**
 * 전체 검사 이력 목록을 조회한다.
 * 대시보드 이력 테이블 및 트렌드 차트에 사용.
 */
export const fetchAllInspections = async (): Promise<InspectionLog[]> => {
  const { data } = await apiClient.get<InspectionLog[]>('/inspections')
  return data
}

/**
 * 단건 검사 이력을 ID로 조회한다.
 * DefectViewer에서 바운딩박스 렌더링에 사용.
 *
 * @param id 검사 로그 ID
 */
export const fetchInspectionById = async (id: number): Promise<InspectionLog> => {
  const { data } = await apiClient.get<InspectionLog>(`/inspections/${id}`)
  return data
}

/**
 * 최근 N건의 검사 이력을 조회한다.
 * 대시보드 실시간 피드 영역에 사용.
 *
 * @param limit 조회 건수 (기본값 10)
 */
export const fetchRecentInspections = async (limit = 10): Promise<InspectionLog[]> => {
  const { data } = await apiClient.get<InspectionLog[]>('/inspections/recent', {
    params: { limit },
  })
  return data
}

/**
 * 최근 N건 조회(요청 타임아웃 커스터마이즈 가능).
 * 키오스크 폴링처럼 "빠른 실패 + 재시도"가 필요한 호출에서 사용한다.
 */
export const fetchRecentInspectionsWithTimeout = async (
  limit = 10,
  timeoutMs = 45_000
): Promise<InspectionLog[]> => {
  const { data } = await apiClient.get<InspectionLog[]>('/inspections/recent', {
    params: { limit },
    timeout: timeoutMs,
  })
  return data
}

/**
 * 전체 검사 통계 요약을 조회한다.
 * 대시보드 상단 StatCard에 사용.
 */
export const fetchStats = async (): Promise<InspectionStats> => {
  const { data } = await apiClient.get<InspectionStats>('/inspections/stats')
  return data
}

/**
 * 특정 기간의 검사 이력을 조회한다.
 * 이력 페이지 날짜 필터에 사용.
 *
 * @param from 시작 시각 (ISO 8601)
 * @param to   종료 시각 (ISO 8601)
 */
export const fetchInspectionsByPeriod = async (
  from: string,
  to: string
): Promise<InspectionLog[]> => {
  const { data } = await apiClient.get<InspectionLog[]>('/inspections/period', {
    params: { from, to },
  })
  return data
}

/**
 * 검사 이력·결함 상세 전체 삭제 (대시보드 초기화).
 */
export const deleteAllInspections = async (): Promise<void> => {
  await apiClient.delete('/inspections')
}
