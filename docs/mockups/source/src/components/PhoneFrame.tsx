import type { ReactNode } from "react"

interface PhoneFrameProps {
  children: ReactNode
  /** screen 컨테이너 className 으로 배경/그라디언트 등 전달 */
  screenClassName?: string
  /** 우측 상단 라벨 (예: "M-17 · Daily Recording") */
  label?: string
}

export function PhoneFrame({ children, screenClassName = "bg-cream", label }: PhoneFrameProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <div className="text-[11px] font-medium text-ink-sub tracking-[0.08em] uppercase">
          {label}
        </div>
      )}
      <div className="relative bg-[#1a1410] rounded-[44px] p-[10px] shadow-2xl">
        {/* notch */}
        <div className="absolute top-[18px] left-1/2 -translate-x-1/2 z-20 w-[110px] h-[28px] bg-[#1a1410] rounded-full" />
        <div
          className={
            "phone-screen relative w-[393px] h-[780px] max-w-[88vw] rounded-[36px] overflow-y-auto overflow-x-hidden " +
            screenClassName
          }
        >
          {/* status bar */}
          <div className="sticky top-0 z-10 flex justify-between items-center px-7 pt-3 pb-1 text-[13px] font-semibold text-ink bg-inherit">
            <span className="tabular-nums">9:41</span>
            <span className="flex items-center gap-1 text-[12px]">
              <span>●●●●</span>
              <span>▮</span>
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
