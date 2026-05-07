import { PhoneFrame } from "@/components/PhoneFrame"

interface Props {
  onBack: () => void
}

export function BirthDateScreen({ onBack }: Props) {
  return (
    <div className="flex flex-col items-center w-full">
      <button
        onClick={onBack}
        className="self-start mb-3 text-sm font-medium text-ink-sub hover:text-coral transition-colors"
      >
        ← 갤러리로
      </button>

      <PhoneFrame
        label="M-24 ★ Birth Date Input · 감정 봉우리"
        screenClassName="bg-gradient-to-b from-cream via-[#FDDDD5] to-peach"
      >
        {/* top bar (transparent) */}
        <div className="flex items-center justify-between px-4 pt-1 pb-1">
          <button className="w-10 h-10 flex items-center justify-center text-[22px] text-ink/80">
            ←
          </button>
          <div className="flex-1" />
          <div className="w-10" />
        </div>

        {/* hero copy */}
        <div className="px-6 pt-2 pb-4 text-center">
          <div className="font-hand text-[44px] text-coral leading-[1.2] mb-1">
            드디어 만났어요
          </div>
          <div className="font-serif text-[18px] leading-[1.6] text-ink font-medium">
            콩이가 세상에 나온 날을<br />
            기억해드릴게요
          </div>
        </div>

        {/* date card */}
        <div className="px-6 pt-2 pb-2">
          <div className="bg-white/90 backdrop-blur rounded-db-md p-6 shadow-db-md text-center">
            <div className="text-[12px] font-semibold text-coral tracking-[0.12em] mb-1.5">
              BIRTH DAY
            </div>
            <div className="font-display text-[44px] font-bold text-ink leading-none mb-1.5">
              9월 15일
            </div>
            <div className="text-[13px] text-ink-sub mb-5">2026년 · 월요일</div>

            {/* date picker (3 columns) */}
            <div className="flex items-center justify-around py-4 border-y border-beige">
              {[
                { prev: "2025", curr: "2026", next: "2027" },
                { prev: "8월", curr: "9월", next: "10월" },
                { prev: "14일", curr: "15일", next: "16일", coral: true },
              ].map((col, i) => (
                <div key={i} className="text-center min-w-[56px]">
                  <div className="text-[11px] text-ink-muted">{col.prev}</div>
                  <div className={"text-[20px] font-bold " + (col.coral ? "text-coral" : "text-ink")}>
                    {col.curr}
                  </div>
                  <div className="text-[11px] text-ink-muted">{col.next}</div>
                </div>
              ))}
            </div>

            <div className="text-[12px] text-ink-sub mt-3.5">위로 스크롤하여 날짜를 맞춰주세요</div>
          </div>
        </div>

        {/* time field */}
        <div className="px-6 py-3">
          <div className="bg-white/70 rounded-db-sm flex items-center px-4 py-3.5">
            <div className="w-10 h-10 rounded-full bg-cream flex items-center justify-center text-[18px]">
              🕐
            </div>
            <div className="flex-1 ml-3">
              <div className="text-[12px] text-ink-sub">
                태어난 시간 <span className="text-ink-muted">(선택)</span>
              </div>
              <div className="text-[15px] text-ink font-semibold">오전 04:32</div>
            </div>
            <div className="text-ink-muted text-[18px]">›</div>
          </div>
        </div>

        {/* encouragement */}
        <div className="px-6 pt-2 pb-4 text-center">
          <div className="font-serif text-[14px] leading-[1.75] text-ink max-w-[300px] mx-auto">
            이 날짜부터<br />
            콩이의 양육 일기가 시작돼요.<br />
            <span className="text-coral">지금까지 남긴 이야기는 그대로 보관됩니다.</span>
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pt-4 pb-8">
          <button className="w-full h-14 rounded-full bg-coral text-white font-semibold text-[15px] shadow-db-md active:scale-[0.99] transition-transform">
            콩이의 첫 날 저장하기 💗
          </button>
        </div>
      </PhoneFrame>
    </div>
  )
}
