/**
 * 대시보드 설정 — 연결 정보, 폴링·표시 옵션, 데이터 관리
 */

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Globe,
  Loader2,
  Monitor,
  Palette,
  Percent,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { deleteAllInspections, getEffectiveApiBaseUrl } from '@/api/inspectionApi'
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
  icon: typeof Globe
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

  const apiBase = getEffectiveApiBaseUrl()

  const viteEnvRows = useMemo(() => {
    const env = import.meta.env as Record<string, unknown>
    return Object.keys(env)
      .filter((k) => k.startsWith('VITE_'))
      .sort()
      .map((k) => ({ key: k, value: env[k] === undefined ? '' : String(env[k]) }))
  }, [])

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

        {/* 연결·환경 */}
        <section className="glass-panel rounded-[22px] p-5">
          <SectionTitle
            icon={Globe}
            title="연결·환경 정보"
            description="데이터가 오지 않을 때 브라우저가 어떤 API 베이스와 빌드 변수를 쓰는지 확인합니다."
          />
          <div className="space-y-3 text-sm">
            <div className="glass-panel-subtle rounded-xl px-3 py-2.5 flex flex-wrap gap-2 items-baseline justify-between">
              <span className="text-[var(--dash-text-tertiary)]">REST API 베이스</span>
              <code className="text-[13px] font-mono text-[var(--dash-accent)] break-all">
                {apiBase}
              </code>
            </div>
            <p className="text-xs text-[var(--dash-text-tertiary)]">
              VITE_API_BASE_URL을 지정하지 않으면 Vite 프록시 기준 상대 경로{' '}
              <code className="font-mono">/api</code>가 사용됩니다.
            </p>
            <div className="rounded-xl border border-[var(--dash-border)] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--dash-bg-secondary)] text-left">
                    <th className="px-3 py-2 font-semibold text-[var(--dash-text-tertiary)]">
                      import.meta.env (VITE_*)
                    </th>
                    <th className="px-3 py-2 font-semibold text-[var(--dash-text-tertiary)]">
                      값
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--dash-border)]">
                  {viteEnvRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-4 text-[var(--dash-text-secondary)]">
                        정의된 VITE_* 변수가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    viteEnvRows.map((row) => (
                      <tr key={row.key} className="bg-[var(--dash-surface)]">
                        <td className="px-3 py-2 font-mono text-[var(--dash-text-secondary)] align-top">
                          {row.key}
                        </td>
                        <td className="px-3 py-2 font-mono text-[var(--dash-text-primary)] break-all">
                          {row.value || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

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
