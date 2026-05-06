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
// M-18 · 홈 (다자녀 / 양육 모드, Case B)
// ─────────────────────────────────────────────────────────────────────────────
export function M18_HomeMultiChild({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-18 · Daily Recording · Stage 6-1 (다자녀)" screenClassName="bg-cream">
        {/* date + greeting */}
        <div className="px-5 pt-5 pb-2">
          <div className="text-[13px] text-ink-sub">9월 16일 화요일 · 오전 9:41</div>
          <div className="font-serif text-[22px] font-bold leading-[1.45] text-ink mt-1">
            오늘 하준이는<br />어떤 표정이었나요?
          </div>
        </div>

        {/* child tabs */}
        <div className="px-5 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full bg-ivory shadow-db-sm">
              <div className="w-7 h-7 rounded-full bg-sage/40 flex items-center justify-center text-[14px]">
                👧
              </div>
              <span className="text-[13px] font-medium text-ink-sub">서연 · 2세</span>
            </button>
            <button className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full bg-coral text-white shadow-db-md">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[14px]">
                👶
              </div>
              <span className="text-[13px] font-bold">하준 · 6개월</span>
            </button>
            <button className="flex-shrink-0 w-10 h-10 rounded-full bg-ivory shadow-db-sm flex items-center justify-center text-ink-muted">
              +
            </button>
          </div>
        </div>

        {/* baby card */}
        <div className="px-5 pt-3">
          <Badge>생후 6개월 12일</Badge>
          <div className="bg-ivory rounded-db-md p-[18px] shadow-db-sm mt-3">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 rounded-db-md flex items-center justify-center text-[30px] bg-gradient-to-br from-peach to-coral/40">
                👶
              </div>
              <div className="flex-1">
                <div className="text-[17px] font-bold text-ink">하준이</div>
                <div className="text-[13px] text-ink-sub">2026.03.04 출생</div>
                <div className="text-[13px] text-coral font-medium mt-0.5">하준이의 86번째 기록</div>
              </div>
            </div>
            <div className="mt-3.5 pt-3.5 border-t border-beige">
              <div className="font-serif text-[14px] leading-[1.65] text-ink-sub italic">
                "처음으로 옹알이 비슷한 소리를 냈다. 콩, 콩 같은 발음이…"
              </div>
              <div className="text-[12px] text-ink-muted mt-1">— 그제 음성 기록</div>
            </div>
          </div>
        </div>

        {/* prompts */}
        <div className="px-5 pt-3">
          <div className="text-[13px] text-ink-sub mb-2">오늘의 기록 도움말 (하준)</div>
          <div className="flex flex-wrap gap-2">
            {["오늘의 옹알이", "새 표정", "잠자는 모습", "이유식 반응"].map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </div>
        </div>

        <div className="px-5 pt-4 pb-32">
          <div className="text-[13px] text-ink-muted uppercase tracking-wider mb-2 px-1">
            최근 (하준)
          </div>
          <FrameCard className="overflow-hidden">
            <Row icon="🎙️" iconBg="bg-cream" title="처음 옹알이" subtitle="그제 · 음성 0:42" border={false} />
            <Row icon="📷" iconBg="bg-cream" title="새 친구 인형 받은 날" subtitle="9/14 · 사진 3장" />
            <Row icon="✏️" iconBg="bg-cream" title="이유식 첫 시도" subtitle="9/12 · 텍스트" />
          </FrameCard>
        </div>

        <FAB />
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
