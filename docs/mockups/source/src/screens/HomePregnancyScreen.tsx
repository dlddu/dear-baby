import { PhoneFrame } from "@/components/PhoneFrame"
import { Tabbar, BackToGallery } from "@/components/Common"

// ─────────────────────────────────────────────────────────────────────────────
// M-17 · 홈 — 임신 모드 (단일 아이)
//   준수: PRD-007 (전 AC). 단일 아이 → 헤더 좌우 화살표 비활성 (AC-02)
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  onBack: () => void
}

export function HomePregnancyScreen({ onBack }: Props) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />

      <PhoneFrame label="M-17 · Daily Recording · Stage 6-1 · 임신 단일" screenClassName="bg-cream">
        {/* ─── Header (AC-007-01, 02, 03) ─────────────────────────── */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
          <button
            className="w-8 h-8 flex items-center justify-center text-ink-muted/40 cursor-default"
            aria-disabled
          >
            ◀
          </button>
          <div className="text-[15px] font-bold text-ink">콩이</div>
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 flex items-center justify-center text-ink-muted/40 cursor-default"
              aria-disabled
            >
              ▶
            </button>
            <button className="relative w-8 h-8 flex items-center justify-center text-ink-sub">
              <span className="text-[18px]">🔔</span>
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-coral" />
            </button>
          </div>
        </div>

        {/* ─── 오늘의 질문 카드 (AC-007-04, 05, 06, 07) ────────────── */}
        <div className="px-5 pt-4">
          <div className="bg-ivory rounded-db-md shadow-db-sm p-4">
            <div className="flex gap-3 items-start">
              {/* 좌측 프로필 (AC-04) */}
              <div className="flex flex-col items-center w-[68px] flex-shrink-0">
                <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-peach to-[#FDDDD5] flex items-center justify-center text-[28px] shadow-db-sm">
                  🌱
                </div>
                <div className="text-[12px] font-semibold text-ink mt-1.5">콩이</div>
                <div className="text-[11px] text-coral font-medium">D-36</div>
              </div>

              {/* 우측 말풍선 (AC-04, 05) */}
              <div className="flex-1 relative">
                <div className="absolute left-[-6px] top-4 w-3 h-3 bg-cream rotate-45" />
                <div className="bg-cream rounded-db-md p-3.5">
                  <div className="font-serif text-[15px] leading-[1.55] text-ink">
                    엄마, 오늘은 제가<br />엄마 배 속에서 어떤 꿈을 꿨을까요?
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-2.5 pt-2 border-t border-beige/60">
                    <button className="text-ink-muted/40 text-[14px] cursor-default" aria-disabled>◀</button>
                    <span className="text-[11px] text-ink-sub font-mono">1/3</span>
                    <button className="text-ink-sub text-[14px]">▶</button>
                  </div>
                </div>
              </div>
            </div>

            {/* 기록 진입 버튼 (AC-06) */}
            <div className="grid grid-cols-2 gap-2 mt-3.5">
              <button className="flex items-center justify-center gap-1.5 py-3 rounded-db-sm bg-coral text-white text-[13px] font-bold shadow-db-sm">
                <span>🎙️</span>
                <span>목소리로 남기기</span>
              </button>
              <button className="flex items-center justify-center gap-1.5 py-3 rounded-db-sm bg-beige text-ink text-[13px] font-bold">
                <span>✏️</span>
                <span>글로 남기기</span>
              </button>
            </div>

            {/* 책 진행도 (AC-07) */}
            <div className="mt-3.5 pt-3 border-t border-beige/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12px] text-ink-sub">
                  <span>아이에게 전해줄 책이 만들어지고 있어요</span>
                  <button className="w-4 h-4 rounded-full bg-beige flex items-center justify-center text-[10px] text-ink-sub font-bold">?</button>
                </div>
                <div className="text-[12px] font-bold text-coral font-mono">12/50</div>
              </div>
              <div className="mt-1.5 h-1 bg-beige rounded-full overflow-hidden">
                <div className="h-full bg-coral rounded-full" style={{ width: "24%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── 타인 기록 피드 (AC-007-08, 09) ──────────────────────── */}
        <div className="px-5 pt-5 pb-32">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[14px] font-bold text-ink">다른 엄마들의 기록</div>
            <button className="text-[12px] text-ink-sub flex items-center gap-0.5">
              <span>더보기</span>
              <span>›</span>
            </button>
          </div>

          <div className="space-y-2">
            {[
              { id: "cho***3", ctx: "임신 3주차", q: "엄마, 오늘 저를 처음 알게 된 기분은 어땠어요?", a: "두 줄짜리 임테기를 보고 한참을 멍하니 앉아 있었어. 손이 떨려서", hearts: 50 },
              { id: "seo***1", ctx: "생후 5개월", q: "엄마, 제가 오늘 처음으로 보여준 표정이 뭐였어요?", a: "옹알이를 하다가 갑자기 씨익 웃었는데, 그 순간 시간이 멈춘", hearts: 365 },
              { id: "abc***9", ctx: "4살", q: "엄마, 제가 오늘 했던 말 중에 어떤 게 가장 웃겼어요?", a: '"엄마 나는 어른 되면 공룡이 될 거야"라고 말해서 한참을', hearts: 12 },
            ].map((c) => (
              <div key={c.id} className="bg-ivory rounded-db-md p-3.5 shadow-db-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-baseline gap-2 flex-1 min-w-0">
                    <span className="text-[12px] font-bold text-ink">{c.id}</span>
                    <span className="text-[11px] text-ink-muted">{c.ctx}</span>
                  </div>
                  <span className="text-[11px] text-coral flex items-center gap-0.5 flex-shrink-0">
                    <span>♥</span>
                    <span className="font-mono">{c.hearts}</span>
                  </span>
                </div>
                <div className="text-[13px] font-bold text-ink mt-1.5 leading-[1.5]">{c.q}</div>
                <div className="text-[12px] text-ink-sub mt-1 leading-[1.55]">
                  {c.a}<span className="text-ink-muted">...</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 하단 네비 (AC-007-10) ──────────────────────────────── */}
        <Tabbar active="home" />
      </PhoneFrame>
    </div>
  )
}
