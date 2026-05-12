import { PhoneFrame } from "@/components/PhoneFrame"
import {
  TopBar,
  PrimaryButton,
  SecondaryButton,
  Badge,
  FrameCard,
  Chip,
  Pill,
  Row,
  BottomAction,
  FAB,
  Tabbar,
  CalloutWarm,
  BackToGallery,
} from "@/components/Common"

// ─────────────────────────────────────────────────────────────────────────────
// M-18 · 홈 — 다자녀 양육 모드 (Case B)
//   준수: PRD-007 (전 AC). 2명 이상 → 헤더 좌우 화살표 활성 (AC-02).
//        활성 아이는 하준(생후 6개월). 좌 화살표로 서연(2세)으로 전환 가능.
// ─────────────────────────────────────────────────────────────────────────────
export function M18_HomeMultiChild({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-18 · Daily Recording · Stage 6-1 · 다자녀" screenClassName="bg-cream">
        {/* ─── Header (AC-007-01, 02, 03) — 다자녀, 화살표 활성 ───── */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
          <button className="w-8 h-8 flex items-center justify-center text-ink-sub">◀</button>
          <div className="text-[15px] font-bold text-ink">하준</div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 flex items-center justify-center text-ink-sub">▶</button>
            <button className="relative w-8 h-8 flex items-center justify-center text-ink-sub">
              <span className="text-[18px]">🔔</span>
              {/* 안 읽은 알림 없음 → red dot 없음 (AC-03) */}
            </button>
          </div>
        </div>

        {/* ─── 오늘의 질문 카드 (AC-007-04, 05, 06, 07) ────────────── */}
        <div className="px-5 pt-4">
          <div className="bg-ivory rounded-db-md shadow-db-sm p-4">
            <div className="flex gap-3 items-start">
              {/* 좌측 프로필 — 양육 모드 (AC-04, AC-01 양육자 표시 규칙) */}
              <div className="flex flex-col items-center w-[68px] flex-shrink-0">
                <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-peach to-coral/40 flex items-center justify-center text-[28px] shadow-db-sm">
                  👶
                </div>
                <div className="text-[12px] font-semibold text-ink mt-1.5">하준</div>
                <div className="text-[11px] text-coral font-medium">6개월 (192일째)</div>
              </div>

              {/* 우측 말풍선 — 회전 중 (AC-05) */}
              <div className="flex-1 relative">
                <div className="absolute left-[-6px] top-4 w-3 h-3 bg-cream rotate-45" />
                <div className="bg-cream rounded-db-md p-3.5">
                  <div className="font-serif text-[15px] leading-[1.55] text-ink">
                    엄마, 오늘은 제가<br />어떤 새로운 소리를 냈을까요?
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-2.5 pt-2 border-t border-beige/60">
                    <button className="text-ink-sub text-[14px]">◀</button>
                    <span className="text-[11px] text-ink-sub font-mono">2/3</span>
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

            {/* 책 진행도 — 활성 아이 기준 독립 카운트 (AC-07, PRD-006 원칙) */}
            <div className="mt-3.5 pt-3 border-t border-beige/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12px] text-ink-sub">
                  <span>하준이에게 전해줄 책이 만들어지고 있어요</span>
                  <button className="w-4 h-4 rounded-full bg-beige flex items-center justify-center text-[10px] text-ink-sub font-bold">?</button>
                </div>
                <div className="text-[12px] font-bold text-coral font-mono">38/50</div>
              </div>
              <div className="mt-1.5 h-1 bg-beige rounded-full overflow-hidden">
                <div className="h-full bg-coral rounded-full" style={{ width: "76%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── 타인 기록 피드 (AC-007-08, 09) — 활성 아이와 무관 (AC-02) */}
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
              { id: "min***7", ctx: "생후 6개월", q: "엄마, 제가 오늘 처음으로 잡은 물건이 뭐였어요?", a: "딸랑이를 한참 노려보더니 갑자기 손을 쭉 뻗어서 잡았어. 두 손으로", hearts: 124 },
              { id: "jin***2", ctx: "임신 28주차", q: "엄마, 오늘 저랑 어떤 노래를 들으셨어요?", a: "퇴근길에 라디오에서 흘러나온 옛날 발라드. 가사가 어쩐지 너에게", hearts: 89 },
              { id: "yoo***5", ctx: "3살", q: "엄마, 제가 오늘 어떤 그림을 그렸어요?", a: "도화지를 가득 채운 동그라미들. 모두 다 \"엄마 얼굴\"이래.", hearts: 201 },
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

        <Tabbar active="home" />
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-19 · 음성 녹음
// ─────────────────────────────────────────────────────────────────────────────
export function M19_VoiceRecording({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-19 · Daily Recording · Stage 6-2" screenClassName="bg-cream">
        <TopBar title="음성 녹음" />

        <div className="px-6 pt-4 text-center">
          <Badge>임신 17주 3일</Badge>
          <div className="font-serif text-[18px] font-medium text-ink-sub mt-3 leading-[1.6]">
            "오늘은 콩이가 어떻게<br />움직였나요?"
          </div>
        </div>

        {/* mic stage */}
        <div className="flex flex-col items-center justify-center pt-8 pb-4">
          <div className="relative w-40 h-40 rounded-full bg-gradient-to-br from-coral to-peach flex items-center justify-center shadow-db-lg animate-pulse-soft">
            <div className="absolute inset-3 rounded-full bg-coral flex items-center justify-center text-[44px] text-white">
              🎙️
            </div>
            <div className="absolute -inset-3 rounded-full border-2 border-coral/30 animate-pulse-soft" />
          </div>
          <div className="font-display text-[36px] font-bold text-ink tabular-nums mt-6">
            00:48
          </div>
          <div className="text-[12px] text-ink-sub mt-1">REC · 자동 변환 중</div>
        </div>

        {/* waveform */}
        <div className="px-8 pt-2 pb-4">
          <div className="flex items-center justify-center gap-1 h-16">
            {[24, 40, 60, 36, 52, 44, 28, 56, 32, 48, 24, 40, 60, 36, 52, 44, 28].map((h, i) => (
              <div
                key={i}
                className="w-1.5 bg-coral rounded-full"
                style={{ height: `${h}%`, opacity: i % 2 === 0 ? 1 : 0.6 }}
              />
            ))}
          </div>
        </div>

        <div className="px-6 pt-2 pb-4">
          <div className="flex items-center justify-around">
            <button className="flex flex-col items-center gap-1.5 text-ink-sub">
              <div className="w-12 h-12 rounded-full bg-beige flex items-center justify-center text-[20px]">
                ⏸
              </div>
              <span className="text-[11px]">일시정지</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 text-ink">
              <div className="w-16 h-16 rounded-full bg-ink flex items-center justify-center text-[20px] text-white">
                ◼
              </div>
              <span className="text-[11px] font-semibold">완료</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 text-ink-sub">
              <div className="w-12 h-12 rounded-full bg-beige flex items-center justify-center text-[18px]">
                ✕
              </div>
              <span className="text-[11px]">취소</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          <CalloutWarm icon="✨">
            말씀하시는 동안 자동으로 텍스트로 변환되고 있어요. 마음 편하게 이야기해주세요.
          </CalloutWarm>
        </div>
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-20 · STT 결과 편집
// ─────────────────────────────────────────────────────────────────────────────
export function M20_STTEdit({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-20 · Daily Recording · Stage 6-3" screenClassName="bg-cream">
        <TopBar
          title="기록 편집"
          right={<span className="text-[14px] font-semibold text-coral">완료</span>}
        />

        <div className="px-5 pt-2">
          <div className="flex items-center gap-2 mb-3">
            <Badge>임신 17주 3일</Badge>
            <span className="text-[12px] text-ink-sub">9월 16일 · 음성 0:48</span>
          </div>

          {/* play bar */}
          <div className="bg-ivory rounded-db-md p-3 shadow-db-sm flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-coral text-white flex items-center justify-center text-[14px]">
              ▶
            </div>
            <div className="flex-1">
              <div className="h-1 bg-beige rounded-full overflow-hidden">
                <div className="h-full bg-coral w-2/3" />
              </div>
              <div className="flex justify-between text-[11px] text-ink-sub mt-1">
                <span>00:32</span>
                <span>00:48</span>
              </div>
            </div>
          </div>

          {/* AI title suggestion */}
          <div className="mb-3">
            <div className="text-[11px] text-coral font-semibold tracking-wider uppercase mb-1.5 flex items-center gap-1">
              ✨ AI 제목 제안
            </div>
            <input
              defaultValue="처음 콩이를 느낀 날"
              className="w-full text-[18px] font-serif font-bold text-ink bg-transparent border-0 outline-none focus:ring-2 focus:ring-coral/40 rounded-db-sm px-1 py-1"
            />
          </div>

          {/* transcript */}
          <div className="bg-ivory rounded-db-md p-4 shadow-db-sm">
            <div className="text-[11px] text-ink-muted tracking-wider uppercase mb-2">자동 변환된 글</div>
            <div className="font-serif text-[14px] leading-[1.85] text-ink space-y-2">
              <p>
                오늘은 회사에서 점심을 먹고 돌아오는 길에, 배 안쪽에서{" "}
                <span className="bg-coral/15 px-1 rounded">작은 톡 같은 신호</span>가 왔어요.
              </p>
              <p>
                처음엔 기분 탓인 줄 알았는데, 다시 또 한 번. 콩이가 처음으로 인사를 건넨 거였어요.
                비 오는 화요일이었는데 그 자리에서 한참을 가만히 서 있었어요.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-beige flex items-center gap-3 text-[12px] text-ink-sub">
              <span>📝 168자</span>
              <span className="text-ink-muted">·</span>
              <button className="text-coral font-semibold">다시 변환</button>
            </div>
          </div>
        </div>

        <BottomAction>
          <PrimaryButton>저장하고 미디어 추가</PrimaryButton>
        </BottomAction>
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-21 · 사진/영상/음성 첨부
// ─────────────────────────────────────────────────────────────────────────────
export function M21_MediaAttach({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-21 · Daily Recording · Stage 6-4" screenClassName="bg-cream">
        <TopBar
          title="미디어 추가"
          right={<span className="text-[14px] font-semibold text-coral">2/9</span>}
        />

        <div className="px-5 pt-2">
          <div className="flex gap-2 mb-3">
            <Pill selected>사진</Pill>
            <Pill>영상</Pill>
            <Pill>음성 메모</Pill>
          </div>

          {/* selected previews */}
          <div className="bg-ivory rounded-db-md p-3 shadow-db-sm mb-4">
            <div className="text-[12px] font-semibold text-ink-sub mb-2">선택됨 · 2장</div>
            <div className="flex gap-2 overflow-x-auto">
              {[
                "from-peach to-gold",
                "from-sage/50 to-teal/40",
              ].map((g, i) => (
                <div
                  key={i}
                  className={`relative flex-shrink-0 w-20 h-20 rounded-db-sm bg-gradient-to-br ${g}`}
                >
                  <button className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-coral text-white text-[11px] flex items-center justify-center">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* camera roll grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => {
              const palettes = [
                "from-peach to-gold",
                "from-sage/40 to-teal/30",
                "from-coral/30 to-peach",
                "from-beige to-cream",
                "from-gold to-peach",
                "from-teal/30 to-sage/30",
                "from-peach/60 to-coral/30",
                "from-cream to-gold/40",
                "from-sage/30 to-cream",
              ]
              const isSelected = i === 0 || i === 4
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-db-sm bg-gradient-to-br ${palettes[i]} relative ${
                    isSelected ? "ring-2 ring-coral" : ""
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-coral text-white text-[10px] flex items-center justify-center font-bold">
                      ✓
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-4 mb-2 text-[12px] text-ink-sub">
            <span className="font-semibold">9월 16일</span> · 12장 중 2장 선택됨
          </div>
        </div>

        <BottomAction>
          <PrimaryButton>2장 추가하기</PrimaryButton>
        </BottomAction>
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-22 · 기록 저장 완료
// ─────────────────────────────────────────────────────────────────────────────
export function M22_RecordComplete({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame
        label="M-22 · Daily Recording · Stage 6-5"
        screenClassName="bg-gradient-to-b from-cream to-peach/30"
      >
        <div className="flex flex-col items-center justify-center pt-20 px-8 text-center">
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-coral to-peach flex items-center justify-center shadow-db-lg mb-6">
            <div className="text-white text-[56px]">✓</div>
            <div className="absolute -top-2 -right-2 text-[24px]">✨</div>
          </div>
          <div className="font-serif text-[24px] font-bold leading-[1.45] text-ink mb-2">
            한 페이지가<br />책에 더해졌어요
          </div>
          <div className="text-[14px] text-ink-sub leading-[1.7] max-w-[260px]">
            콩이의 17주 3일째 마음을<br />소중하게 보관할게요
          </div>

          <div className="mt-8 w-full bg-ivory rounded-db-md p-5 shadow-db-md">
            <div className="text-[11px] text-coral font-semibold tracking-wider mb-2">
              이번 기록
            </div>
            <div className="font-display text-[18px] font-bold text-ink mb-1">
              처음 콩이를 느낀 날
            </div>
            <div className="text-[12px] text-ink-sub mb-3">
              임신 17주 3일 · 음성 + 사진 2장
            </div>
            <div className="flex items-center gap-3 pt-3 border-t border-beige text-center">
              <div className="flex-1">
                <div className="font-display text-[20px] font-bold text-ink">38</div>
                <div className="text-[11px] text-ink-sub">전체 기록</div>
              </div>
              <div className="flex-1 border-l border-r border-beige">
                <div className="font-display text-[20px] font-bold text-coral">1</div>
                <div className="text-[11px] text-ink-sub">방금 추가</div>
              </div>
              <div className="flex-1">
                <div className="font-display text-[20px] font-bold text-sage">156</div>
                <div className="text-[11px] text-ink-sub">D-day</div>
              </div>
            </div>
          </div>
        </div>

        <BottomAction>
          <div className="space-y-2">
            <PrimaryButton>새 기록 시작하기</PrimaryButton>
            <SecondaryButton>홈으로 돌아가기</SecondaryButton>
          </div>
        </BottomAction>
      </PhoneFrame>
    </div>
  )
}
