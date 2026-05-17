/** FAIL 깜빡임 시 화면 중앙 대형 「FAIL」 문구 */
export default function KioskFailBurstLabel({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div
      className="fixed inset-0 z-[601] pointer-events-none flex items-center justify-center px-4"
      aria-live="assertive"
      role="alert"
    >
      <span
        className="select-none font-black tracking-tight text-center leading-none text-red-600"
        style={{
          fontSize: 'clamp(4rem, 18vw, 11rem)',
          textShadow: '0 0 3px #fff, 0 0 10px #fff, 2px 3px 24px rgba(0,0,0,0.45)',
        }}
      >
        FAIL
      </span>
    </div>
  )
}
