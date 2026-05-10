/**
 * 키오스크 판정 깜빡임 — 배경 오버레이와 중앙 라벨을 같은 타이밍으로 3회 토글한다.
 * (정상=초록 / 불량=빨강은 호출부 오버레이·라벨 색으로 구분)
 */
export async function runTripleBurstFlash(
  setOverlay: (visible: boolean) => void,
  setLabel?: (visible: boolean) => void
): Promise<void> {
  const label = setLabel ?? (() => {})
  for (let i = 0; i < 3; i++) {
    setOverlay(true)
    label(true)
    await new Promise((r) => setTimeout(r, 220))
    setOverlay(false)
    label(false)
    await new Promise((r) => setTimeout(r, 180))
  }
}

/** 하위 호환 — 불량 깜빡임과 동일 로직 */
export const runTripleRedFlash = runTripleBurstFlash
