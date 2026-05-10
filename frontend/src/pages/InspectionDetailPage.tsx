/**
 * 단일 검사 상세 페이지 — DefectViewer를 전체 폭으로 표시
 */

import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import DefectViewer from '@/components/inspection/DefectViewer'

type LocationState = { returnTo?: string }

export default function InspectionDetailPage() {
  const { inspectionId: raw } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const id = Number.parseInt(raw ?? '', 10)
  const returnTo = (location.state as LocationState | null)?.returnTo?.trim() || '/history'

  const onClose = () => {
    navigate(returnTo)
  }

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="p-6 overflow-y-auto h-full bg-[var(--dash-bg-secondary)]">
        <div className="max-w-[1280px] mx-auto space-y-4">
          <p className="text-sm text-[var(--dash-text-secondary)]">잘못된 검사 ID입니다.</p>
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="text-sm font-medium text-[var(--dash-accent)] hover:underline"
          >
            검사 이력으로 이동
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 overflow-y-auto h-full bg-[var(--dash-bg-secondary)]">
      <div className="max-w-[1400px] mx-auto space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          돌아가기
        </button>
        <DefectViewer inspectionId={id} onClose={onClose} />
      </div>
    </div>
  )
}
