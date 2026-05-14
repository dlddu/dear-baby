import { PhoneFrame } from "@/components/PhoneFrame"
import { Tabbar, BackToGallery } from "@/components/Common"

// ─────────────────────────────────────────────────────────────────────────────
// M-36 · 일기 탭 — 목록 (단일 아이, 통합 표시)
//   준수: PRD-008 (AC-008-01·02·03·10). 단일 아이도 아이 컨텍스트 칩 표시.
//   헤더는 일기 탭 전용 — 좌우 화살표·아이 이름 없음, "내 기록" + 🔔 만.
// ─────────────────────────────────────────────────────────────────────────────
export function M36_DiaryListSingle({ onBack }: { onBack: () => void }) {
  // 임신 28주차 작성 — 콩이
  const nov = [
    {
      date: "11/22 (금)",
      childChip: { emoji: "🌱", name: "콩이", ctx: "임신 28주차" },
      privacy: "🔒 비공개",
      privacyColor: "text-ink-muted",
      q: "엄마, 제 첫 태동을 어떻게 알아채셨어요?",
      a: "회의 중에 갑자기 뱃속이 꿈틀거려서 깜짝 놀랐어. 처음엔 가스인 줄 알았는데",
      media: ["🖼️ ×2", "🎙️"],
    },
    {
      date: "11/19 (화)",
      childChip: { emoji: "🌱", name: "콩이", ctx: "임신 27주차" },
      privacy: "🌐 공개",
      privacyColor: "text-sage",
      q: "엄마, 오늘 저한테 어떤 음악을 들려주셨어요?",
      a: "출근길에 너에게 노래를 불러줬어. 너도 듣고 있는 것 같은 기분이",
      media: ["🎙️"],
    },
    {
      date: "11/17 (일)",
      childChip: { emoji: "🌱", name: "콩이", ctx: "임신 27주차" },
      privacy: "🔒 비공개",
      privacyColor: "text-ink-muted",
      q: "엄마, 오늘 제 검진 결과는 어땠어요?",
      a: "초음파에서 너의 손가락 다섯 개를 다 볼 수 있었어. 정말 작은데",
      media: ["🖼️ ×3"],
    },
    {
      date: "11/06 (수)",
      childChip: { emoji: "🌱", name: "콩이", ctx: "임신 25주차" },
      privacy: "🌐 공개",
      privacyColor: "text-sage",
      q: "엄마, 오늘 저랑 무엇을 했어요?",
      a: "임산부 요가 클래스에 처음 갔어. 다른 엄마들 만나니까 마음이",
      media: ["🖼️ ×1", "🎙️"],
    },
  ]
  // 10월 작성 — 콩이 (24주차)
  const oct = [
    {
      date: "10/28 (화)",
      childChip: { emoji: "🌱", name: "콩이", ctx: "임신 24주차" },
      privacy: "🔒 비공개",
      privacyColor: "text-ink-muted",
      q: "엄마, 오늘 저를 위해 어떤 결심을 했어요?",
      a: "너에게 부끄럽지 않은 엄마가 되고 싶어서 술을 끊었어",
      media: [],
    },
  ]

  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />

      <PhoneFrame label="M-36 · Diary Browsing · Stage 6½-1·2 · 단일 아이 통합" screenClassName="bg-cream">
        {/* ─── 일기 탭 전용 헤더 (AC-008-10) — "내 기록" + 🔔 ─────── */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
          <div className="w-8 h-8"></div>
          <div className="text-[17px] font-bold text-ink font-display">내 기록</div>
          <button className="relative w-8 h-8 flex items-center justify-center text-ink-sub">
            <span className="text-[18px]">🔔</span>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-coral" />
          </button>
        </div>

        {/* ─── 검색·필터 (AC-008-08) ───────────────────────────────── */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-end">
          <button className="w-9 h-9 flex items-center justify-center text-ink-sub">🔍</button>
          <button className="w-9 h-9 flex items-center justify-center text-ink-sub relative">⚙️</button>
        </div>

        {/* ─── 그룹 1: 2025년 11월 (AC-008-02 월 단위) ─────────────── */}
        <div className="sticky top-[40px] z-10 bg-cream/95 backdrop-blur px-5 py-2 border-b border-beige/60">
          <div className="text-[12px] font-bold text-coral tracking-wide">📅 2025년 11월</div>
        </div>
        <div className="px-5 pt-2 pb-1 space-y-2">
          {nov.map((c) => (
            <DiaryCard key={c.date} {...c} />
          ))}
        </div>

        {/* ─── 그룹 2: 2025년 10월 ──────────────────────────────────── */}
        <div className="sticky top-[40px] z-10 bg-cream/95 backdrop-blur px-5 py-2 mt-3 border-b border-beige/60">
          <div className="text-[12px] font-bold text-coral tracking-wide">📅 2025년 10월</div>
        </div>
        <div className="px-5 pt-2 pb-32 space-y-2">
          {oct.map((c) => (
            <DiaryCard key={c.date} {...c} />
          ))}
        </div>

        {/* ─── 하단 네비 (AC-008-10 = PRD-007 AC-007-10) ────────────── */}
        <Tabbar active="diary" />
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-37 · 일기 탭 — 목록 (다자녀 통합 + 아이 필터 칩)
//   준수: PRD-008 (AC-008-01·02·03·08·10). 콩이(임신)와 하준(양육) 기록이
//        한 화면에 시간 순으로 섞여서 통합 표시. 헤더에 아이 전환 없음.
//        필터 시트는 닫혀 있고, 아이 필터 적용 가능 상태.
// ─────────────────────────────────────────────────────────────────────────────
export function M37_DiaryListMulti({ onBack }: { onBack: () => void }) {
  // 11월: 콩이 임신 28주, 하준 생후 6개월이 섞임
  const nov = [
    {
      date: "11/22 (금)",
      childChip: { emoji: "🌱", name: "콩이", ctx: "임신 28주차" },
      privacy: "🔒 비공개",
      privacyColor: "text-ink-muted",
      q: "엄마, 제 첫 태동을 어떻게 알아채셨어요?",
      a: "회의 중에 갑자기 뱃속이 꿈틀거려서 깜짝 놀랐어. 처음엔 가스인 줄",
      media: ["🖼️ ×2", "🎙️"],
    },
    {
      date: "11/20 (수)",
      childChip: { emoji: "👶", name: "하준", ctx: "생후 6개월" },
      privacy: "🌐 공개",
      privacyColor: "text-sage",
      q: "엄마, 제가 오늘 새로 한 표정이 있었나요?",
      a: "혀를 내밀고 메롱하는 표정을 처음 지었어. 너무 귀여워서 한참을",
      media: ["🖼️ ×4"],
    },
    {
      date: "11/18 (월)",
      childChip: { emoji: "👶", name: "하준", ctx: "생후 6개월" },
      privacy: "🔒 비공개",
      privacyColor: "text-ink-muted",
      q: "엄마, 오늘 저와 처음으로 한 일이 있나요?",
      a: "처음으로 너랑 같이 공원에 나갔어. 햇볕이 너무 좋아서",
      media: ["🖼️ ×2", "🎬 ×1"],
    },
    {
      date: "11/14 (목)",
      childChip: { emoji: "🌱", name: "콩이", ctx: "임신 27주차" },
      privacy: "🌐 공개",
      privacyColor: "text-sage",
      q: "엄마, 저는 오늘 무엇을 듣고 자랐을까요?",
      a: "오늘은 회사 동료들이 너의 태명을 부르면서 인사해줬어",
      media: [],
    },
    {
      date: "11/11 (월)",
      childChip: { emoji: "👶", name: "하준", ctx: "생후 5개월" },
      privacy: "🌐 공개",
      privacyColor: "text-sage",
      q: "엄마, 제가 처음 뒤집기를 한 게 언제예요?",
      a: "오늘 아침에 갑자기 뒤집어서 깜짝 놀랐어. 영상으로 남겨두려고",
      media: ["🖼️ ×1", "🎬 ×2"],
    },
  ]
  // 10월: 콩이만
  const oct = [
    {
      date: "10/28 (화)",
      childChip: { emoji: "🌱", name: "콩이", ctx: "임신 24주차" },
      privacy: "🔒 비공개",
      privacyColor: "text-ink-muted",
      q: "엄마, 오늘 저를 위해 어떤 결심을 했어요?",
      a: "너에게 부끄럽지 않은 엄마가 되고 싶어서 술을 끊었어",
      media: [],
    },
  ]

  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />

      <PhoneFrame label="M-37 · Diary Browsing · Stage 6½-2 · 다자녀 통합 (콩이+하준)" screenClassName="bg-cream">
        {/* ─── 일기 탭 전용 헤더 — 다자녀도 헤더 동일 ─────────────── */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
          <div className="w-8 h-8"></div>
          <div className="text-[17px] font-bold text-ink font-display">내 기록</div>
          <button className="relative w-8 h-8 flex items-center justify-center text-ink-sub">
            <span className="text-[18px]">🔔</span>
          </button>
        </div>

        {/* ─── 검색·필터 (AC-008-08) — 필터 1개 적용된 상태 ────────── */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-end">
          <button className="w-9 h-9 flex items-center justify-center text-ink-sub">🔍</button>
          <button className="w-9 h-9 flex items-center justify-center text-ink-sub relative">
            ⚙️
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-coral text-white text-[9px] font-bold flex items-center justify-center font-mono">
              1
            </span>
          </button>
        </div>

        {/* ─── 활성 필터 안내 칩 — 영상 포함 ────────────────────────── */}
        <div className="px-5 pb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-peach/40 text-[11px] text-ink">
            <span>🎬 영상 포함</span>
            <button className="text-ink-sub">×</button>
          </div>
        </div>

        {/* ─── 그룹 1: 2025년 11월 — 콩이·하준 섞임 ─────────────────── */}
        <div className="sticky top-[40px] z-10 bg-cream/95 backdrop-blur px-5 py-2 border-b border-beige/60">
          <div className="text-[12px] font-bold text-coral tracking-wide">📅 2025년 11월</div>
        </div>
        <div className="px-5 pt-2 pb-1 space-y-2">
          {nov.map((c) => (
            <DiaryCard key={c.date} {...c} />
          ))}
        </div>

        {/* ─── 그룹 2: 2025년 10월 ──────────────────────────────────── */}
        <div className="sticky top-[40px] z-10 bg-cream/95 backdrop-blur px-5 py-2 mt-3 border-b border-beige/60">
          <div className="text-[12px] font-bold text-coral tracking-wide">📅 2025년 10월</div>
        </div>
        <div className="px-5 pt-2 pb-32 space-y-2">
          {oct.map((c) => (
            <DiaryCard key={c.date} {...c} />
          ))}
        </div>

        {/* ─── 하단 네비 ──────────────────────────────────────────── */}
        <Tabbar active="diary" />
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-38 · 일기 탭 — 기록 상세 + ⋯ 액션 시트
//   준수: PRD-008 (AC-008-04·05·06·07). 상단 메타에 아이 컨텍스트 칩 표시.
// ─────────────────────────────────────────────────────────────────────────────
export function M38_DiaryDetail({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />

      <PhoneFrame label="M-38 · Diary Browsing · Stage 6½-3·4 · 상세 + ⋯" screenClassName="bg-cream">
        {/* ─── TopBar (back + ⋯) ──────────────────────────────────── */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
          <button className="w-8 h-8 flex items-center justify-center text-ink-sub text-[20px]">←</button>
          <div className="text-[13px] font-medium text-ink-sub">기록 상세</div>
          <button className="w-8 h-8 flex items-center justify-center text-ink text-[20px] font-bold">⋯</button>
        </div>

        {/* ─── 상단 메타 — 작성일 · 아이 컨텍스트 칩 · 공개 배지 ─── */}
        <div className="px-5 pt-4 pb-3 border-b border-beige/60">
          <div className="text-[16px] font-bold text-ink">2025년 11월 22일 (금)</div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-peach/30 text-[11px] text-ink font-medium">
              🌱 콩이 · 임신 28주차
            </span>
            <span className="text-[11px] font-medium text-sage">🌐 공개</span>
          </div>
        </div>

        {/* ─── 본문: 질문 (인용 스타일) + 답변 + 미디어 ────────────── */}
        <div className="px-5 pt-4 space-y-4">
          {/* 음성 원본 진입점 (PRD-005 AC-005-05) */}
          <div className="flex items-center gap-2 text-[12px] text-coral">
            <span>🎙️</span>
            <button className="underline">음성 원본 있음 · 재생</button>
          </div>

          {/* 질문 — 인용 스타일 */}
          <div className="border-l-2 border-coral/60 pl-3">
            <div className="text-[11px] text-ink-sub mb-1">Q. 콩이가 엄마에게</div>
            <div className="font-serif text-[14px] leading-[1.6] text-ink">
              엄마, 제 첫 태동을 어떻게 알아채셨어요?
            </div>
          </div>

          {/* 답변 본문 */}
          <div className="font-serif text-[15px] leading-[1.75] text-ink whitespace-pre-line">
            {`회의 중에 갑자기 뱃속이 꿈틀거려서 깜짝 놀랐어.
처음엔 가스인 줄 알았는데, 잠깐 멈췄다가 또 한 번 꿈틀.
그제서야 "아, 이게 태동이구나" 싶었어.

화장실 가는 척 자리에서 일어나서 잠깐 너랑 둘이 있는 시간을 가졌어.
조용히 배를 만지면서 "또 해볼래?" 하니까 정말 한 번 더 응답해줬지.

회의 끝나고 아빠한테 바로 영상통화 걸어서 자랑했어.
아빠는 "와 정말?" 하면서 눈물이 그렁그렁했어.`}
          </div>

          {/* 사진 첨부 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="aspect-square rounded-db-sm bg-gradient-to-br from-peach to-coral/30 flex items-center justify-center text-[28px]">
              🤰
            </div>
            <div className="aspect-square rounded-db-sm bg-gradient-to-br from-sage/30 to-cream flex items-center justify-center text-[28px]">
              🍼
            </div>
          </div>

          {/* 음성 메모 재생 컨트롤 */}
          <div className="bg-ivory rounded-db-md p-3.5 shadow-db-sm">
            <div className="flex items-center gap-3">
              <button className="w-10 h-10 rounded-full bg-coral text-white flex items-center justify-center text-[18px]">
                ▶
              </button>
              <div className="flex-1">
                <div className="h-1 bg-beige rounded-full overflow-hidden">
                  <div className="h-full bg-coral rounded-full" style={{ width: "0%" }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-ink-sub font-mono">
                  <span>0:00</span>
                  <span>0:48</span>
                </div>
              </div>
            </div>
            <div className="text-[10px] text-ink-muted mt-1.5">🎙️ 음성 메모 · 48초</div>
          </div>
        </div>

        {/* ─── 액션 시트 (⋯ 탭 시 슬라이드 업) — AC-008-04~07 ──────── */}
        <div className="mt-6 mx-3 mb-32 bg-ivory rounded-db-lg shadow-db-md overflow-hidden border border-beige/60">
          <div className="px-4 py-3 text-center text-[11px] text-ink-muted border-b border-beige/60">
            기록 관리
          </div>
          <button className="w-full px-4 py-3.5 flex items-center gap-3 text-left text-[14px] text-ink border-b border-beige/40">
            <span className="text-[18px]">✏️</span>
            <span>편집</span>
          </button>
          <button className="w-full px-4 py-3.5 flex items-center gap-3 text-left text-[14px] text-ink border-b border-beige/40">
            <span className="text-[18px]">🔒</span>
            <span>비공개로 전환</span>
          </button>
          <button className="w-full px-4 py-3.5 flex items-center gap-3 text-left text-[14px] text-coral border-b border-beige/40">
            <span className="text-[18px]">🗑️</span>
            <span>삭제</span>
          </button>
          <button className="w-full px-4 py-3.5 text-center text-[13px] text-ink-sub font-medium">
            취소
          </button>
        </div>

        {/* 상세 화면에서는 Tabbar 미노출 */}
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-39 · 일기 탭 — 빈 상태 (기록 0건)
//   준수: PRD-008 (AC-008-09 기록 0건 + AC-008-10 헤더).
//        카피에 특정 아이 이름 안 들어감 — "아직 첫 기록이 없어요"
// ─────────────────────────────────────────────────────────────────────────────
export function M39_DiaryEmpty({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />

      <PhoneFrame label="M-39 · Diary Browsing · Stage 6½-1 · 빈 상태" screenClassName="bg-cream">
        {/* ─── 일기 탭 전용 헤더 ─────────────────────────────────── */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
          <div className="w-8 h-8"></div>
          <div className="text-[17px] font-bold text-ink font-display">내 기록</div>
          <button className="relative w-8 h-8 flex items-center justify-center text-ink-sub">
            <span className="text-[18px]">🔔</span>
          </button>
        </div>

        {/* ─── 검색·필터 (비활성 톤) ─────────────────────────────── */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-end">
          <button className="w-9 h-9 flex items-center justify-center text-ink-muted/40 cursor-default">🔍</button>
          <button className="w-9 h-9 flex items-center justify-center text-ink-muted/40 cursor-default">⚙️</button>
        </div>

        {/* ─── 빈 상태 일러스트 + 카피 + CTA (AC-008-09) ───────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 pt-20 pb-32">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-peach/40 to-cream flex items-center justify-center text-[44px] shadow-db-sm mb-6">
            📓
          </div>
          <div className="font-serif text-[18px] font-bold text-ink text-center leading-[1.5] mb-2">
            아직 첫 기록이 없어요
          </div>
          <div className="text-[13px] text-ink-sub text-center leading-[1.6] mb-8">
            홈에서 오늘의 질문에 답해보세요.<br />한 마디면 충분해요.
          </div>
          <button className="px-8 py-3 rounded-db-md bg-coral text-white text-[14px] font-bold shadow-db-sm">
            홈으로 가기
          </button>
        </div>

        {/* ─── 하단 네비 ──────────────────────────────────────────── */}
        <Tabbar active="diary" />
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 내부 컴포넌트: 일기 카드 (AC-008-03)
//   카드 우상단에 아이 컨텍스트 칩(이모지+이름+작성 시점 컨텍스트)을 표시
// ─────────────────────────────────────────────────────────────────────────────
interface ChildChip {
  emoji: string
  name: string
  ctx: string
}
interface DiaryCardProps {
  date: string
  childChip: ChildChip
  privacy: string
  privacyColor: string
  q: string
  a: string
  media: string[]
}
function DiaryCard({ date, childChip, privacy, privacyColor, q, a, media }: DiaryCardProps) {
  return (
    <div className="bg-ivory rounded-db-md p-3.5 shadow-db-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium text-ink-sub font-mono pt-0.5">{date}</span>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-peach/30 text-[10px] text-ink font-medium">
            {childChip.emoji} {childChip.name} · {childChip.ctx}
          </span>
          <span className={"text-[11px] font-medium " + privacyColor}>{privacy}</span>
        </div>
      </div>
      <div className="text-[12px] text-ink-muted mt-2 leading-[1.4] truncate">
        <span className="font-semibold">Q.</span> {q}
      </div>
      <div className="text-[13px] text-ink mt-1 leading-[1.55]">
        <span className="font-semibold">A.</span> {a}
        <span className="text-ink-muted">...</span>
      </div>
      {media.length > 0 && (
        <div className="mt-2 pt-2 border-t border-beige/40 flex items-center gap-3">
          {media.map((m, i) => (
            <span key={i} className="text-[11px] text-ink-sub">
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
