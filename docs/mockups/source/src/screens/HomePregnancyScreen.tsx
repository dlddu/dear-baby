import { PhoneFrame } from "@/components/PhoneFrame"

interface Props {
  onBack: () => void
}

export function HomePregnancyScreen({ onBack }: Props) {
  return (
    <div className="flex flex-col items-center w-full">
      <button
        onClick={onBack}
        className="self-start mb-3 text-sm font-medium text-ink-sub hover:text-coral transition-colors"
      >
        ← 갤러리로
      </button>

      <PhoneFrame label="M-17 · Daily Recording · Stage 6-1" screenClassName="bg-cream">
        {/* greeting */}
        <div className="px-5 pt-5 pb-2">
          <div className="text-[13px] text-ink-sub">9월 16일 화요일 · 오전 9:41</div>
          <div className="font-serif text-[24px] font-bold leading-[1.4] text-ink mt-1">
            오늘은 어떤 마음을<br />
            콩이에게 들려줄까요?
          </div>
        </div>

        {/* badge */}
        <div className="px-5 pt-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-coral text-white text-[12px] font-semibold tracking-wide">
            임신 17주 3일
          </span>
        </div>

        {/* baby card */}
        <div className="px-5 pt-3">
          <div className="bg-ivory rounded-db-md p-[18px] shadow-db-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 rounded-db-md flex items-center justify-center text-[30px] bg-gradient-to-br from-peach to-[#FDDDD5]">
                🌱
              </div>
              <div className="flex-1">
                <div className="text-[17px] font-bold text-ink">콩이</div>
                <div className="text-[13px] text-ink-sub">예정일 · 2026.09.15</div>
                <div className="text-[13px] text-coral font-medium mt-1">17주 3일 · D-156</div>
              </div>
            </div>

            <div className="mt-3.5 pt-3.5 border-t border-beige">
              <div className="font-serif text-[14px] leading-[1.7] text-ink-sub italic">
                "오늘은 처음으로 발길질을 느꼈어요…"
              </div>
              <div className="text-[12px] text-ink-muted mt-1">— 어제 기록 중에서</div>
            </div>
          </div>
        </div>

        {/* prompts */}
        <div className="px-5 pt-3">
          <div className="text-[13px] text-ink-sub mb-2">오늘의 기록 도움말</div>
          <div className="flex flex-wrap gap-2">
            {["콩이가 움직였을 때", "오늘의 기분", "병원 이야기", "콩이에게 한마디"].map((c) => (
              <span
                key={c}
                className="px-3 py-1.5 rounded-full bg-beige text-ink text-[13px] font-medium"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* recent records */}
        <div className="px-5 pt-4 pb-32">
          <div className="text-[13px] text-ink-muted uppercase tracking-wider mb-2 px-1">
            최근 기록
          </div>
          <div className="bg-ivory rounded-db-md shadow-db-sm overflow-hidden">
            {[
              { week: "17주 2일", title: "처음 콩이를 느꼈어", time: "어제 · 음성", icon: "🎙️" },
              { week: "17주 1일", title: "초음파 사진 받은 날", time: "9/14 · 사진 2장", icon: "📷" },
              { week: "16주 6일", title: "이름 후보 정리", time: "9/13 · 텍스트", icon: "✏️" },
            ].map((r, i) => (
              <div key={r.title} className={"flex items-center gap-3 px-4 py-3.5 " + (i > 0 ? "border-t border-beige" : "")}>
                <div className="w-10 h-10 rounded-db-sm bg-cream flex items-center justify-center text-[18px]">
                  {r.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-ink truncate">{r.title}</div>
                  <div className="text-[12px] text-ink-sub">{r.time}</div>
                </div>
                <div className="text-ink-muted text-[18px]">›</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAB */}
        <button className="fixed sticky-fab" />

        {/* tabbar */}
        <div className="sticky bottom-0 left-0 right-0 bg-ivory/95 backdrop-blur border-t border-beige flex justify-around py-2.5">
          {[
            { ic: "🏠", label: "홈", active: true },
            { ic: "📓", label: "기록" },
            { ic: "📖", label: "책" },
            { ic: "⚙", label: "설정" },
          ].map((t) => (
            <div key={t.label} className={"flex flex-col items-center gap-0.5 " + (t.active ? "text-coral" : "text-ink-muted")}>
              <div className="text-[20px]">{t.ic}</div>
              <div className="text-[10px] font-medium">{t.label}</div>
            </div>
          ))}
        </div>
      </PhoneFrame>
    </div>
  )
}
