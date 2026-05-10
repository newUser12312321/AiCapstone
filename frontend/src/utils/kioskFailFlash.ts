/**
 * 키오스크 불량 판정 시 전역 레드 오버레이를 짧게 3회 토글한다.
 */
export async function runTripleRedFlash(setVisible: (visible: boolean) => void): Promise<void> {
  for (let i = 0; i < 3; i++) {
    setVisible(true)
    await new Promise((r) => setTimeout(r, 220))
    setVisible(false)
    await new Promise((r) => setTimeout(r, 180))
  }
}
