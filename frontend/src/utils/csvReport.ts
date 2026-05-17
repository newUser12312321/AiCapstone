import type { InspectionLog, InspectionStats } from '@/types/inspection'
import { deviceDisplayLabel, defectDisplayName } from '@/types/inspection'

export function downloadInspectionCsv(
  logs: InspectionLog[],
  filename: string,
  formatFullDateTime: (iso: string) => string
) {
  if (!logs.length) return
  const header = ['ID', '시각', '디바이스', '보드', '결과', '리뷰', '오차(°)', '추론(ms)', '결함수', '결함요약']
  const rows = logs.map((l) => [
    l.id,
    formatFullDateTime(l.inspectedAt),
    deviceDisplayLabel(l.deviceId),
    (l.silkBoardName ?? '').trim(),
    l.result,
    l.reviewStatus ?? 'PENDING',
    l.angleErrorDeg?.toFixed(2) ?? '',
    l.inferenceTimeMs ?? '',
    l.defects.length,
    l.defects
      .slice(0, 5)
      .map((d) => defectDisplayName(d.defectType, d.detail))
      .join('; '),
  ])
  const csv = [header, ...rows].map((r) => r.map(escapeCsvCell).join(',')).join('\n')
  triggerDownload(csv, filename)
}

export function downloadDailyReportCsv(opts: {
  dateFrom: string
  dateTo: string
  stats: InspectionStats
  defectRows: { label: string; count: number }[]
  logs: InspectionLog[]
  formatFullDateTime: (iso: string) => string
}) {
  const lines: string[] = [
    'AOI 일일 품질 리포트',
    `기간,${opts.dateFrom},${opts.dateTo}`,
    '',
    '항목,값',
    `총 검사,${opts.stats.totalCount}`,
    `PASS,${opts.stats.passCount}`,
    `FAIL,${opts.stats.failCount}`,
    `불량률(%),${opts.stats.failRate}`,
    '',
    'FAIL 유형,건수',
    ...opts.defectRows.map((r) => `${escapeCsvCell(r.label)},${r.count}`),
    '',
    '--- 검사 로그 ---',
  ]
  const header = ['ID', '시각', '디바이스', '결과', '리뷰', '결함수']
  const rows = opts.logs.map((l) => [
    l.id,
    opts.formatFullDateTime(l.inspectedAt),
    deviceDisplayLabel(l.deviceId),
    l.result,
    l.reviewStatus ?? 'PENDING',
    l.defects.length,
  ])
  const csv = [...lines, header.join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\n')
  triggerDownload(csv, `aoi_report_${opts.dateTo}.csv`)
}

function escapeCsvCell(v: string | number): string {
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function triggerDownload(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
