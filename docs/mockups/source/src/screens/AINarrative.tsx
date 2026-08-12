import { PhoneFrame } from "@/components/PhoneFrame"
import {
  TopBar,
  PrimaryButton,
  SecondaryButton,
  FrameCard,
  Pill,
  BottomAction,
  CalloutWarm,
  BookPage,
  BackToGallery,
} from "@/components/Common"

// ─────────────────────────────────────────────────────────────────────────────
// M-27 · AI 서사 요청
// ─────────────────────────────────────────────────────────────────────────────
export function M27_NarrativeRequest({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-27 · AI Narrative · Stage 8-1" screenClassName="bg-cream">
        <TopBar title="책 만들기" />

        <div className="px-6 pt-2 pb-3 text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-coral to-peach flex items-center justify-center text-[44px] mb-4">
            📖
          </div>
          <div className="font-serif text-[20px] font-bold leading-[1.5] text-ink mb-2">
            기록을 한 권의 이야기로<br />엮어드릴게요
          </div>
          <div className="text-[13px] text-ink-sub leading-[1.7]">
            AI가 그동안의 기록을 시간순으로 정리하고<br />
            자연스러운 문장으로 다듬어 드려요
          </div>
        </div>

        <div className="px-5 pt-2">
          <FrameCard className="p-4">
            <div className="text-[12px] font-semibold text-ink-sub mb-3">이번에 엮을 기록</div>
            <div className="flex gap-2">
              {[
                { num: 38, label: "기록", color: "text-coral" },
                { num: 16, label: "사진·영상", color: "text-sage" },
                { num: 9, label: "음성", color: "text-gold" },
              ].map((s) => (
                <div key={s.label} className="flex-1 text-center bg-cream rounded-db-sm py-2.5">
                  <div className={`font-display text-[22px] font-bold ${s.color}`}>{s.num}</div>
                  <div className="text-[11px] text-ink-sub">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-ink-sub mt-3 pt-3 border-t border-beige">
              기간 · 2026.03.12 — 2026.09.15 (콩이 임신 기간 전체)
            </div>
          </FrameCard>
        </div>

        <div className="px-5 pt-4">
          <div className="text-[13px] font-semibold text-ink pl-1 mb-2">
            어떤 분위기로 엮을까요?
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill selected>따뜻한 일기체</Pill>
            <Pill>담담한 회고체</Pill>
            <Pill>경쾌한 편지체</Pill>
          </div>
        </div>

        <div className="px-5 pt-4">
          <CalloutWarm icon="🛡️">
            <div>
              <strong className="text-coral">원본 기록은 그대로 보존됩니다.</strong>
              <br />
              AI가 만든 서사는 별도 사본이며,
              <br />
              마음에 들지 않으면 다시 만들 수 있어요.
            </div>
          </CalloutWarm>
        </div>

        <BottomAction>
          <PrimaryButton>AI에게 맡기기 ✨</PrimaryButton>
        </BottomAction>
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-28 · AI 처리 로딩
// ─────────────────────────────────────────────────────────────────────────────
export function M28_NarrativeLoading({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame
        label="M-28 · AI Narrative · Stage 8-2"
        screenClassName="bg-gradient-to-b from-cream to-beige"
      >
        <div className="flex flex-col items-center justify-center pt-16 pb-6 px-8 text-center">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-coral to-peach flex items-center justify-center text-[56px] shadow-db-lg animate-pulse-soft">
            ✨
          </div>
          <div className="font-serif text-[22px] font-bold leading-[1.45] text-ink mt-6 mb-2">
            콩이의 이야기를<br />엮고 있어요
          </div>
          <div className="text-[13px] text-ink-sub leading-[1.7]">
            잠시만 기다려주세요. 약 1~2분 걸려요.
          </div>
        </div>

        <div className="px-8 pt-2">
          <div className="h-2 bg-beige rounded-full overflow-hidden">
            <div className="h-full bg-coral rounded-full" style={{ width: "62%" }} />
          </div>
          <div className="flex justify-between mt-2">
            <div className="text-[12px] text-coral font-bold">62%</div>
            <div className="text-[12px] text-ink-sub">예상 잔여 ~40초</div>
          </div>
        </div>

        <div className="px-6 pt-6">
          <FrameCard className="overflow-hidden">
            {[
              { dot: "✓", state: "done", title: "기록 38개 불러오기", note: "완료" },
              { dot: "✓", state: "done", title: "시간순 정리", note: "완료" },
              { dot: "3", state: "active", title: "자연스러운 문장으로 다듬기", note: "진행 중" },
              { dot: "4", state: "pending", title: "사진·영상 위치 매칭", note: "대기 중" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-t border-beige first:border-t-0">
                <div
                  className={
                    "w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold " +
                    (s.state === "done"
                      ? "bg-sage text-white"
                      : s.state === "active"
                        ? "bg-coral text-white ring-4 ring-coral/20"
                        : "bg-beige text-ink-muted")
                  }
                >
                  {s.dot}
                </div>
                <div
                  className={
                    "flex-1 text-[14px] font-medium " +
                    (s.state === "active" ? "text-coral font-bold" : s.state === "pending" ? "text-ink-muted" : "text-ink")
                  }
                >
                  {s.title}
                </div>
                <div
                  className={
                    "text-[11px] " +
                    (s.state === "active" ? "text-coral" : s.state === "pending" ? "text-ink-muted" : "text-ink-sub")
                  }
                >
                  {s.note}
                </div>
              </div>
            ))}
          </FrameCard>
        </div>

        <div className="px-8 pt-6 pb-8 text-center">
          <div className="font-serif text-[14px] leading-[1.75] text-ink-sub italic">
            "기억은 사라져도<br />이야기는 남아요."
          </div>
        </div>
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-29 ★ 서사 미리보기 — 두 번째 감정 봉우리
// ─────────────────────────────────────────────────────────────────────────────
export function M29_NarrativePreview({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame
        label="M-29 ★ AI Narrative · Stage 8-3 · 감정 봉우리"
        screenClassName="bg-gradient-to-b from-cream via-[#F0E6D8] to-peach"
      >
        <TopBar transparent right={<span className="text-[18px] text-ink-sub">⋯</span>} />

        {/* hero */}
        <div className="px-6 pt-2 pb-3 text-center">
          <div className="text-[12px] font-semibold text-coral tracking-[0.12em] mb-2">
            YOUR STORY IS READY
          </div>
          <div className="font-hand text-[34px] text-ink leading-[1.3] mb-1">
            한 권의 이야기가<br />완성됐어요
          </div>
          <div className="text-[12px] text-ink-sub mt-1">38개 기록이 12개 챕터로 엮였어요</div>
        </div>

        {/* book page */}
        <div className="px-7 pt-2 pb-3">
          <BookPage chapter="CHAPTER 03" title="처음 콩이를 느낀 날" signature="— 임신 17주 3일">
            <p>
              그날은 비가 왔다. 회사에서 점심을 먹고 돌아오는 길에, 배 안쪽에서 작은 톡 — 누군가 손가락
              끝으로 살짝 두드린 것 같은 신호가 왔다.
            </p>
            <p>
              처음엔 기분 탓인 줄 알았다. 그런데 다시, 또 한 번. 콩이가 내게 처음으로 인사를 건넨 거였다.
            </p>
            <p>
              그 자리에서 한참을 가만히 서 있었다. 비 내리는 소리보다 더 또렷한, 작은 발끝의 안부.
            </p>
          </BookPage>
        </div>

        {/* page indicator */}
        <div className="px-6 pt-3 text-center">
          <div className="text-[12px] text-ink-sub">3 / 12 페이지</div>
          <div className="flex justify-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-muted opacity-40" />
            <span className="w-1.5 h-1.5 rounded-full bg-ink-muted opacity-40" />
            <span className="w-4 h-1.5 rounded-full bg-coral" />
            <span className="w-1.5 h-1.5 rounded-full bg-ink-muted opacity-40" />
            <span className="w-1.5 h-1.5 rounded-full bg-ink-muted opacity-40" />
          </div>
        </div>

        <BottomAction className="bg-gradient-to-t from-peach via-peach/80 to-transparent">
          <div className="flex gap-2">
            <SecondaryButton className="!w-24">편집</SecondaryButton>
            <PrimaryButton>책으로 만들기 📖</PrimaryButton>
          </div>
        </BottomAction>
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-30 · 서사 편집
// ─────────────────────────────────────────────────────────────────────────────
export function M30_NarrativeEdit({ onBack }: { onBack: () => void }) {
  const chapters = [
    { num: "01", icon: "🌱", title: "너를 처음 알게 된 날", meta: "5주차 · 기록 4개" },
    { num: "02", icon: "💗", title: "첫 심장소리", meta: "8주차 · 기록 3개" },
    { num: "03", icon: "🌧️", title: "처음 콩이를 느낀 날", meta: "17주차 · 기록 5개", active: true },
    { num: "04", icon: "🎀", title: "너의 이름을 정한 밤", meta: "22주차 · 기록 6개" },
    { num: "05", icon: "🍼", title: "준비물을 사는 토요일", meta: "28주차 · 기록 4개" },
    { num: "06", icon: "🌙", title: "잠 못 드는 새벽", meta: "34주차 · 기록 4개" },
  ]

  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-30 · AI Narrative · Stage 8-3 alt" screenClassName="bg-cream">
        <TopBar
          title="이야기 편집"
          right={<span className="text-[14px] font-semibold text-coral">완료</span>}
        />

        <div className="px-5 pt-2">
          <div className="flex gap-2 mb-3">
            <Pill selected>챕터 순서</Pill>
            <Pill>제목·문장</Pill>
            <Pill>사진·영상</Pill>
          </div>
          <div className="text-[12px] text-ink-sub pl-1 mb-3">
            길게 눌러 드래그로 순서를 바꿀 수 있어요
          </div>

          <FrameCard className="overflow-hidden">
            {chapters.map((c, i) => (
              <div
                key={c.num}
                className={
                  "flex items-center gap-3 px-4 py-3.5 " +
                  (i > 0 ? "border-t border-beige " : "") +
                  (c.active ? "bg-coral/8" : "")
                }
              >
                <div className={c.active ? "text-coral text-[18px]" : "text-ink-muted text-[18px]"}>
                  ⋮⋮
                </div>
                <div
                  className={
                    "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold " +
                    (c.active ? "bg-coral text-white" : "bg-cream text-ink")
                  }
                >
                  {c.num}
                </div>
                <div className="w-11 h-11 rounded-db-sm bg-gradient-to-br from-peach to-[#FDDDD5] flex items-center justify-center text-[18px]">
                  {c.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={
                      "text-[14px] truncate " + (c.active ? "font-bold text-coral" : "font-semibold text-ink")
                    }
                  >
                    {c.title}
                  </div>
                  <div
                    className={
                      "text-[11px] " + (c.active ? "text-coral" : "text-ink-sub")
                    }
                  >
                    {c.meta + (c.active ? " · 편집 중" : "")}
                  </div>
                </div>
              </div>
            ))}
          </FrameCard>

          <button className="w-full h-12 mt-3 rounded-db-sm border border-dashed border-ink-muted text-[13px] text-ink-sub font-medium">
            + 빈 챕터 추가
          </button>
        </div>

        <BottomAction>
          <PrimaryButton>변경사항 저장</PrimaryButton>
        </BottomAction>
      </PhoneFrame>
    </div>
  )
}
