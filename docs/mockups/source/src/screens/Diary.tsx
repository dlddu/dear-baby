import { PhoneFrame } from "@/components/PhoneFrame"
import { Tabbar, BackToGallery } from "@/components/Common"

// ─────────────────────────────────────────────────────────────────────────────
// M-36 · 일기 탭 — 목록 (단일 아이, 통합 표시)
//   준수: PRD-008 (AC-008-01·02·03·10). 단일 아이도 아이 컨텍스트 칩 표시.
//   헤더는 일기 탭 전용 — 좌우 화살표·아이 이름 없음, "일기" + 🔔 만.
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
        {/* ─── 일기 탭 전용 헤더 (AC-008-10) — "일기" + 🔔 ─────── */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
          <div className="w-8 h-8"></div>
          <div className="text-[17px] font-bold text-ink font-display">일기</div>
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
          <div className="text-[17px] font-bold text-ink font-display">일기</div>
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
          <div className="text-[17px] font-bold text-ink font-display">일기</div>
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
// M-40 · 일기 탭 — 기록 편집 (사후 편집)
//   준수: PRD-008 (AC-008-05). 본문·미디어·공개여부만 편집 가능.
//        변경 불가 항목(작성일·질문·아이 컨텍스트·음성 원본)은 회색 톤으로
//        잠금 표시(🔒). M-38 상세에서 ⋯ → 편집 으로 진입.
// ─────────────────────────────────────────────────────────────────────────────
export function M40_DiaryEdit({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />

      <PhoneFrame label="M-40 · Diary Browsing · Stage 6½-5 · 편집" screenClassName="bg-cream">
        {/* ─── TopBar (취소 + 제목 + 저장) ────────────────────────────── */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
          <button className="text-[14px] text-ink-sub">취소</button>
          <div className="text-[15px] font-bold text-ink">기록 편집</div>
          <button className="text-[14px] font-bold text-coral">저장</button>
        </div>

        {/* ─── 변경 불가 메타 영역 (시간 축 보존) ───────────────────── */}
        <div className="px-5 pt-4 pb-3 border-b border-beige/60 bg-beige/20">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[16px] font-bold text-ink-sub">2025년 11월 22일 (금)</div>
            <span className="text-[10px] text-ink-muted">🔒 변경 불가</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-peach/20 text-[11px] text-ink-sub font-medium">
              🌱 콩이 · 임신 28주차
            </span>
          </div>
          <div className="text-[10px] text-ink-muted mt-1.5 leading-[1.4]">
            작성일 · 질문 · 아이 컨텍스트 · 음성 원본은 시간 축 보존을 위해 편집할 수 없어요
          </div>
        </div>

        {/* ─── 변경 불가: 질문 (회색 톤 인용) ──────────────────────── */}
        <div className="px-5 pt-4">
          <div className="border-l-2 border-beige pl-3 mb-1">
            <div className="text-[11px] text-ink-muted mb-1 flex items-center gap-1">
              <span>Q. 콩이가 엄마에게</span>
              <span className="text-[10px]">🔒</span>
            </div>
            <div className="font-serif text-[14px] leading-[1.6] text-ink-sub">
              엄마, 제 첫 태동을 어떻게 알아채셨어요?
            </div>
          </div>
        </div>

        {/* ─── 변경 불가: 음성 원본 (PRD-005 AC-005-05 무결성) ────── */}
        <div className="px-5 pt-3">
          <div className="bg-beige/30 rounded-db-md p-2.5 flex items-center gap-2">
            <span className="text-[14px]">🎙️</span>
            <span className="text-[11px] text-ink-sub flex-1">음성 원본 · 48초</span>
            <span className="text-[10px] text-ink-muted">🔒 변경 불가</span>
          </div>
        </div>

        {/* ─── 편집 가능: 본문 textarea (PRD-001 AC-001-03 UX) ────── */}
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[11px] font-semibold text-ink-sub">A. 답변 본문</div>
            <span className="text-[10px] text-ink-muted font-mono">218 자</span>
          </div>
          <div className="bg-ivory rounded-db-md p-3.5 shadow-db-sm border border-coral/40">
            <div className="font-serif text-[14px] leading-[1.7] text-ink whitespace-pre-line">
              {`회의 중에 갑자기 뱃속이 꿈틀거려서 깜짝 놀랐어.
처음엔 가스인 줄 알았는데, 잠깐 멈췄다가 또 한 번 꿈틀.
그제서야 "아, 이게 태동이구나" 싶었어.

화장실 가는 척 자리에서 일어나서 잠깐 너랑 둘이 있는 시간을 가졌어.
조용히 배를 만지면서 "또 해볼래?" 하니까 정말 한 번 더 응답해줬지.|`}
              <span className="inline-block w-[1px] h-[14px] bg-coral align-middle animate-pulse" />
            </div>
          </div>
        </div>

        {/* ─── 편집 가능: 미디어 (추가·제거·순서 변경) — PRD-005 ─── */}
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[11px] font-semibold text-ink-sub">첨부 미디어 · 2장</div>
            <button className="text-[11px] text-coral font-semibold">+ 추가</button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {/* 사진 1 — 제거 가능 */}
            <div className="relative aspect-square rounded-db-sm bg-gradient-to-br from-peach to-coral/30 flex items-center justify-center text-[22px]">
              🤰
              <button className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-coral text-white text-[11px] flex items-center justify-center shadow-db-sm">
                ×
              </button>
              <span className="absolute bottom-1 left-1 text-[9px] text-ink-muted font-mono bg-ivory/80 px-1 rounded">1</span>
            </div>
            {/* 사진 2 — 제거 가능 */}
            <div className="relative aspect-square rounded-db-sm bg-gradient-to-br from-sage/30 to-cream flex items-center justify-center text-[22px]">
              🍼
              <button className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-coral text-white text-[11px] flex items-center justify-center shadow-db-sm">
                ×
              </button>
              <span className="absolute bottom-1 left-1 text-[9px] text-ink-muted font-mono bg-ivory/80 px-1 rounded">2</span>
            </div>
            {/* + 추가 슬롯 */}
            <button className="aspect-square rounded-db-sm border-2 border-dashed border-beige flex items-center justify-center text-ink-muted text-[24px]">
              +
            </button>
          </div>
          <div className="text-[10px] text-ink-muted mt-1.5 leading-[1.4]">
            길게 눌러서 순서 변경 · 우상단 ×로 제거
          </div>
        </div>

        {/* ─── 편집 가능: 공개 / 비공개 토글 (AC-008-07) ──────────── */}
        <div className="px-5 pt-4 pb-32">
          <div className="bg-ivory rounded-db-md p-3.5 shadow-db-sm flex items-center justify-between">
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-ink">공개 설정</div>
              <div className="text-[11px] text-ink-sub mt-0.5">
                공개 시 커뮤니티 피드에 노출됩니다
              </div>
            </div>
            {/* 토글 — 현재 비공개 상태 */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-ink-sub">🔒 비공개</span>
              <button className="w-10 h-6 rounded-full bg-beige flex items-center px-0.5">
                <div className="w-5 h-5 rounded-full bg-ivory shadow-db-sm" />
              </button>
            </div>
          </div>
        </div>

        {/* 편집 화면에서는 Tabbar 미노출 */}
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-41 · 일기 탭 — 삭제 확인 모달
//   준수: PRD-008 (AC-008-06). 상세 화면 위에 dim 오버레이 + 슬라이드 업
//        시트. 본문 카피에 대상 아이 이름이 치환되어 들어감.
//        취소는 회색·기본 포커스 / 삭제는 코랄·위험 강조.
// ─────────────────────────────────────────────────────────────────────────────
export function M41_DiaryDeleteConfirm({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />

      <PhoneFrame label="M-41 · Diary Browsing · Stage 6½-6 · 삭제 확인" screenClassName="bg-cream">
        {/* ─── 뒤에 깔린 상세 화면 (dim 처리) ────────────────────── */}
        <div className="relative">
          <div className="opacity-40 pointer-events-none">
            {/* 상세 TopBar */}
            <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
              <button className="w-8 h-8 flex items-center justify-center text-ink-sub text-[20px]">←</button>
              <div className="text-[13px] font-medium text-ink-sub">기록 상세</div>
              <button className="w-8 h-8 flex items-center justify-center text-ink text-[20px] font-bold">⋯</button>
            </div>
            {/* 메타 */}
            <div className="px-5 pt-4 pb-3 border-b border-beige/60">
              <div className="text-[16px] font-bold text-ink">2025년 11월 22일 (금)</div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-peach/30 text-[11px] text-ink font-medium">
                  🌱 콩이 · 임신 28주차
                </span>
                <span className="text-[11px] font-medium text-ink-muted">🔒 비공개</span>
              </div>
            </div>
            {/* 본문 일부 */}
            <div className="px-5 pt-4 space-y-3">
              <div className="border-l-2 border-coral/60 pl-3">
                <div className="text-[11px] text-ink-sub mb-1">Q. 콩이가 엄마에게</div>
                <div className="font-serif text-[14px] leading-[1.6] text-ink">
                  엄마, 제 첫 태동을 어떻게 알아채셨어요?
                </div>
              </div>
              <div className="font-serif text-[14px] leading-[1.7] text-ink">
                회의 중에 갑자기 뱃속이 꿈틀거려서 깜짝 놀랐어. 처음엔 가스인 줄 알았는데
              </div>
            </div>
          </div>

          {/* ─── Dim 오버레이 + 모달 ─────────────────────────────── */}
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[1px] flex items-end">
            <div className="w-full bg-ivory rounded-t-[20px] shadow-db-md overflow-hidden animate-in slide-in-from-bottom">
              {/* drag handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-9 h-1 rounded-full bg-beige" />
              </div>

              {/* 경고 아이콘 + 제목 */}
              <div className="px-6 pt-3 pb-2 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-coral/15 flex items-center justify-center text-[24px] mb-3">
                  🗑️
                </div>
                <div className="font-serif text-[16px] font-bold text-ink text-center leading-[1.4]">
                  이 기록을 정말 삭제할까요?
                </div>
              </div>

              {/* 본문 카피 (아이 이름 치환) */}
              <div className="px-6 pt-2 pb-5">
                <div className="text-[13px] text-ink-sub leading-[1.65] text-center">
                  삭제하면 기록 본문과 첨부 미디어가 모두 사라지고,{" "}
                  <span className="font-semibold text-ink">콩이</span>의 책에도 포함되지 않게 됩니다.
                  <br />
                  <span className="text-coral font-medium">이 동작은 되돌릴 수 없습니다.</span>
                </div>
              </div>

              {/* 버튼 — 취소(회색·기본 포커스) / 삭제(코랄·위험) */}
              <div className="px-4 pb-5 flex gap-2">
                <button className="flex-1 py-3 rounded-db-md bg-beige/60 text-[14px] font-bold text-ink ring-2 ring-ink/20">
                  취소
                </button>
                <button className="flex-1 py-3 rounded-db-md bg-coral text-[14px] font-bold text-white shadow-db-sm">
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 모달 표시 중에는 Tabbar 미노출 (상세 화면이므로) */}
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-42 · 일기 탭 — 필터 시트
//   준수: PRD-008 (AC-008-08). 다자녀 사용자 기준 — 아이 필터 노출.
//        칩 다중 선택 + 기간 + 미디어 + 공개여부 + 초기화·적용 버튼.
//        세션 단위 유지 — 일기 탭 이탈 시 초기화됨.
// ─────────────────────────────────────────────────────────────────────────────
export function M42_DiaryFilterSheet({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />

      <PhoneFrame label="M-42 · Diary Browsing · Stage 6½-7 · 필터 시트" screenClassName="bg-cream">
        {/* ─── 뒤에 깔린 일기 탭 목록 (dim) ──────────────────────── */}
        <div className="relative">
          <div className="opacity-40 pointer-events-none">
            <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
              <div className="w-8 h-8"></div>
              <div className="text-[17px] font-bold text-ink font-display">일기</div>
              <button className="relative w-8 h-8 flex items-center justify-center text-ink-sub">
                <span className="text-[18px]">🔔</span>
              </button>
            </div>
            <div className="px-5 pt-3 pb-2 flex items-center justify-end">
              <button className="w-9 h-9 flex items-center justify-center text-ink-sub">🔍</button>
              <button className="w-9 h-9 flex items-center justify-center text-ink-sub">⚙️</button>
            </div>
            <div className="sticky top-[40px] z-10 bg-cream/95 px-5 py-2 border-b border-beige/60">
              <div className="text-[12px] font-bold text-coral tracking-wide">📅 2025년 11월</div>
            </div>
            <div className="px-5 pt-2 space-y-2">
              <div className="bg-ivory rounded-db-md p-3.5 shadow-db-sm h-20" />
              <div className="bg-ivory rounded-db-md p-3.5 shadow-db-sm h-20" />
            </div>
          </div>

          {/* ─── Dim 오버레이 + 필터 시트 ─────────────────────────── */}
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[1px] flex items-end">
            <div className="w-full bg-ivory rounded-t-[20px] shadow-db-md overflow-hidden max-h-[88%] flex flex-col">
              {/* drag handle */}
              <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
                <div className="w-9 h-1 rounded-full bg-beige" />
              </div>

              {/* 헤더 */}
              <div className="px-5 py-3 flex items-center justify-between border-b border-beige/60 flex-shrink-0">
                <div className="text-[15px] font-bold text-ink">필터</div>
                <span className="text-[11px] font-medium text-coral">2개 적용</span>
              </div>

              {/* 스크롤 영역 — 필터 항목 */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* 아이 필터 (다자녀만 노출) */}
                <div>
                  <div className="text-[12px] font-bold text-ink-sub mb-2">아이</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-coral text-white text-[12px] font-medium ring-2 ring-coral/20">
                      🌱 콩이 ✓
                    </button>
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-cream text-ink text-[12px] font-medium border border-beige">
                      👶 하준
                    </button>
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-cream text-ink text-[12px] font-medium border border-beige">
                      🧒 서연
                    </button>
                  </div>
                </div>

                {/* 기간 필터 */}
                <div>
                  <div className="text-[12px] font-bold text-ink-sub mb-2">기간</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button className="px-3 py-1.5 rounded-full bg-coral text-white text-[12px] font-medium">
                      전체
                    </button>
                    <button className="px-3 py-1.5 rounded-full bg-cream text-ink text-[12px] font-medium border border-beige">
                      최근 1개월
                    </button>
                    <button className="px-3 py-1.5 rounded-full bg-cream text-ink text-[12px] font-medium border border-beige">
                      최근 3개월
                    </button>
                    <button className="px-3 py-1.5 rounded-full bg-cream text-ink-sub text-[12px] font-medium border border-beige">
                      사용자 지정
                    </button>
                  </div>
                </div>

                {/* 미디어 필터 */}
                <div>
                  <div className="text-[12px] font-bold text-ink-sub mb-2">미디어</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-cream text-ink text-[12px] font-medium border border-beige">
                      🖼️ 사진 포함
                    </button>
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-coral text-white text-[12px] font-medium ring-2 ring-coral/20">
                      🎬 영상 포함 ✓
                    </button>
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-cream text-ink text-[12px] font-medium border border-beige">
                      🎙️ 음성 메모 포함
                    </button>
                  </div>
                </div>

                {/* 공개 여부 필터 */}
                <div>
                  <div className="text-[12px] font-bold text-ink-sub mb-2">공개 여부</div>
                  <div className="flex gap-1.5">
                    <button className="flex-1 px-3 py-1.5 rounded-db-sm bg-coral text-white text-[12px] font-medium">
                      전체
                    </button>
                    <button className="flex-1 px-3 py-1.5 rounded-db-sm bg-cream text-ink text-[12px] font-medium border border-beige">
                      🌐 공개만
                    </button>
                    <button className="flex-1 px-3 py-1.5 rounded-db-sm bg-cream text-ink text-[12px] font-medium border border-beige">
                      🔒 비공개만
                    </button>
                  </div>
                </div>

                {/* 안내 카피 */}
                <div className="text-[10px] text-ink-muted leading-[1.5] pt-1">
                  필터는 일기 탭을 이탈하면 초기화돼요 (세션 단위 유지)
                </div>
              </div>

              {/* 하단 액션 — 초기화 / 적용 */}
              <div className="px-4 py-3 border-t border-beige/60 flex gap-2 flex-shrink-0 bg-ivory">
                <button className="flex-1 py-3 rounded-db-md bg-cream text-[14px] font-bold text-ink-sub border border-beige">
                  초기화
                </button>
                <button className="flex-[2] py-3 rounded-db-md bg-coral text-[14px] font-bold text-white shadow-db-sm">
                  적용 (2개)
                </button>
              </div>
            </div>
          </div>
        </div>
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
