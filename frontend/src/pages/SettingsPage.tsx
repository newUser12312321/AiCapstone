/**
 * 대시보드 설정 — 폴링·표시 옵션, 데이터 관리
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Clock,
  Globe,
  Loader2,
  Monitor,
  Palette,
  Percent,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { deleteAllInspections } from '@/api/inspectionApi'
import { useDashboardSettings } from '@/context/DashboardSettingsContext'
import {
  POLLING_INTERVAL_OPTIONS,
  type DateStyle,
  type TimeZoneMode,
} from '@/settings/dashboardSettings'

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description?: string
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-[var(--dash-accent)]" />
        <h2 className="text-base font-semibold text-[var(--dash-text-primary)]">{title}</h2>
      </div>
      {description && (
        <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">{description}</p>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { settings, setSettings, resetSettings } = useDashboardSettings()
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const deleteMutation = useMutation({
    mutationFn: deleteAllInspections,
    onSuccess: () => {
      setActionMsg({ type: 'ok', text: '검사 이력이 모두 삭제되었습니다.' })
      queryClient.invalidateQueries({ queryKey: ['inspections'] })
    },
    onError: (e: Error) => {
      setActionMsg({ type: 'err', text: e.message || '삭제 실패' })
    },
  })

  const handleDeleteHistory = () => {
    if (
      !window.confirm(
        '저장된 검사 이력과 결함 기록을 모두 삭제합니다. 계속할까요?'
      )
    ) {
      return
    }
    deleteMutation.mutate()
  }

  return (
    <div className="h-full overflow-y-auto p-5 bg-[var(--dash-bg-secondary)]">
      <div className="max-w-[880px] mx-auto space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="glass-panel-subtle inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]"
          >
            <ArrowLeft size={16} />
            대시보드
          </Link>
          <h1 className="text-xl font-semibold text-[var(--dash-text-primary)]">설정</h1>
        </div>

        {/* 대시보드 동작 */}
        <section className="glass-panel rounded-[22px] p-5">
          <SectionTitle
            icon={RefreshCw}
            title="대시보드 동작"
            description="통계·이력 목록·최근 검사 피드의 자동 새로고침 간격입니다. 끄면 탭 포커스 시 등의 기본 갱신만 동작합니다."
          />
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-[var(--dash-text-secondary)]">
                폴링 주기
              </span>
              <select
                value={
                  settings.pollingIntervalMs === null
                    ? 'off'
                    : String(settings.pollingIntervalMs)
                }
                onChange={(e) => {
                  const v = e.target.value
                  setSettings({
                    pollingIntervalMs:
                      v === 'off' ? null : Number.parseInt(v, 10),
                  })
                }}
                className="mt-1.5 w-full max-w-xs rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm text-[var(--dash-text-primary)]"
              >
                {POLLING_INTERVAL_OPTIONS.map((opt) => (
                  <option
                    key={opt.label}
                    value={opt.value === null ? 'off' : String(opt.value)}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[var(--dash-text-secondary)]">
                최근 검사 피드 건수 (대시보드 우측 분석 기준){' '}
                <strong className="text-[var(--dash-text-primary)]">
                  {settings.recentFeedLimit}
                </strong>
              </span>
              <input
                type="range"
                min={10}
                max={100}
                step={1}
                value={settings.recentFeedLimit}
                onChange={(e) =>
                  setSettings({ recentFeedLimit: Number(e.target.value) })
                }
                className="mt-2 w-full max-w-md accent-[var(--dash-accent)]"
              />
              <div className="flex justify-between text-[10px] text-[var(--dash-text-tertiary)] max-w-md mt-0.5">
                <span>10</span>
                <span>100</span>
              </div>
            </label>
          </div>
        </section>

        {/* 표시 */}
        <section className="glass-panel rounded-[22px] p-5">
          <SectionTitle
            icon={Clock}
            title="표시 옵션"
            description="검사 이력 테이블·상세·헤더 시각 등에 적용됩니다."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className="text-xs font-medium text-[var(--dash-text-secondary)] mb-2 flex items-center gap-1">
                <Globe size={14} /> 시간대
              </legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { v: 'local' as TimeZoneMode, label: '로컬' },
                    { v: 'utc' as TimeZoneMode, label: 'UTC' },
                  ] as const
                ).map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSettings({ timeZoneMode: v })}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      settings.timeZoneMode === v
                        ? 'bg-[var(--dash-accent)] text-white'
                        : 'bg-[var(--dash-surface)] border border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <span className="text-xs font-medium text-[var(--dash-text-secondary)] mb-1 block">
                날짜·시각 형식
              </span>
              <select
                value={settings.dateStyle}
                onChange={(e) =>
                  setSettings({ dateStyle: e.target.value as DateStyle })
                }
                className="w-full rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm text-[var(--dash-text-primary)]"
              >
                <option value="compact">간단 (월/일 + 시:분:초)</option>
                <option value="iso">ISO 스타일 (YYYY-MM-DD / HH:mm:ss)</option>
                <option value="locale-long">로캘 긴 형식 (한 줄)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[var(--dash-text-secondary)] mb-1 flex items-center gap-1">
                <Percent size={14} /> 불량률·비율 소수 자릿수
              </span>
              <select
                value={settings.decimalPlaces}
                onChange={(e) =>
                  setSettings({ decimalPlaces: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm text-[var(--dash-text-primary)]"
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}자리
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-xs font-medium text-[var(--dash-text-secondary)] mb-2 flex items-center gap-1">
                <Palette size={14} /> 테마
              </legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { v: 'dark' as const, label: '다크', Icon: Monitor },
                    { v: 'light' as const, label: '라이트', Icon: Monitor },
                  ] as const
                ).map(({ v, label, Icon: I }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSettings({ colorScheme: v })}
                    className={clsx(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      settings.colorScheme === v
                        ? 'bg-[var(--dash-accent)] text-white'
                        : 'bg-[var(--dash-surface)] border border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]'
                    )}
                  >
                    <I size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <button
            type="button"
            onClick={() => resetSettings()}
            className="mt-5 text-xs text-[var(--dash-text-tertiary)] underline hover:text-[var(--dash-accent)]"
          >
            표시·동작 설정을 기본값으로 되돌리기
          </button>
        </section>

        {/* 임계값 알림 */}
        <section className="glass-panel rounded-[22px] p-5">
          <SectionTitle
            icon={Bell}
            title="운영 알림 (임계값)"
            description="조건을 넘으면 헤더에 배지가 뜨고 짧은 토스트가 표시됩니다. 값은 설정에 저장됩니다."
          />
          <label className="flex items-center gap-2 text-sm text-[var(--dash-text-secondary)] mb-4">
            <input
              type="checkbox"
              checked={settings.alertsEnabled}
              onChange={(e) => setSettings({ alertsEnabled: e.target.checked })}
              className="rounded border-[var(--dash-border)]"
            />
            알림 사용
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-[var(--dash-text-secondary)]">
                불량률 알림 기준 (%)
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={settings.alertMinFailRatePct}
                onChange={(e) =>
                  setSettings({ alertMinFailRatePct: Number(e.target.value) })
                }
                className="mt-1.5 w-full max-w-xs rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm text-[var(--dash-text-primary)]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[var(--dash-text-secondary)]">
                연속 FAIL 알림 (건)
              </span>
              <input
                type="number"
                min={1}
                max={50}
                step={1}
                value={settings.alertMinConsecutiveFail}
                onChange={(e) =>
                  setSettings({ alertMinConsecutiveFail: Number(e.target.value) })
                }
                className="mt-1.5 w-full max-w-xs rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm text-[var(--dash-text-primary)]"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-[var(--dash-text-secondary)]">
                평균 추론 시간 상한 (ms) — 최근 피드 기준, 0이면 이 조건 끔
              </span>
              <input
                type="number"
                min={0}
                max={600000}
                step={500}
                value={settings.alertMaxAvgInferenceMs}
                onChange={(e) =>
                  setSettings({ alertMaxAvgInferenceMs: Number(e.target.value) })
                }
                className="mt-1.5 w-full max-w-md rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm text-[var(--dash-text-primary)]"
              />
            </label>
          </div>
        </section>

        {/* 위험 구역 */}
        <section className="glass-panel rounded-[22px] p-5 border-[var(--dash-danger)]/35">
          <SectionTitle
            icon={AlertTriangle}
            title="데이터 관리"
            description="삭제 후에는 복구할 수 없습니다."
          />
          <button
            type="button"
            onClick={handleDeleteHistory}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-2 px-4 h-11 rounded-xl text-sm font-medium bg-[var(--dash-danger)] hover:opacity-95 border border-transparent text-white disabled:opacity-50 transition-opacity"
          >
            {deleteMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Trash2 size={18} />
            )}
            검사 이력 전체 삭제
          </button>
          {actionMsg && (
            <p
              className={clsx(
                'mt-3 text-xs',
                actionMsg.type === 'ok'
                  ? 'text-[var(--dash-success)]'
                  : 'text-[var(--dash-danger)]'
              )}
            >
              {actionMsg.text}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
