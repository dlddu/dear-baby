import { PhoneFrame } from "@/components/PhoneFrame"
import {
  Badge,
  Tabbar,
  PrimaryButton,
  BottomAction,
  BackToGallery,
} from "@/components/Common"

// ─────────────────────────────────────────────────────────────────────────────
// M-35 · 일기 탭 — 일기 목록 (채워진 상태, 임신 모드 · 단일 아이)
//   준수: PRD-008
//   - AC-008-01: 임신 주차 단위 그룹 + 역시간순 정렬
//   - AC-008-02: 카드 1행(날짜·미디어 아이콘) + 2행(본문 미리보기 / 미디어 전용 대체)
//   - AC-008-03: 활성 아이(콩이) 헤더 표시 — 단일 아이라 전환 UI 없음
//   - AC-008-04: 카드 탭 → 상세 진입 (시각 표현은 hover/active 상태)
// ─────────────────────────────────────────────────────────────────────────────

type DiaryCard = {
  date: string // "5/12 (월)" 형태
  icons: string[] // "🎤" | "📷" | "🎬"
  preview: string // 본문 미리보기 또는 미디어 대체 텍스트
  mediaOnly?: boolean // true면 preview를 미디어 대체 표시로 (이탤릭/회색)
}

type WeekGroup = {
  week: string // "28주차"
  cards: DiaryCard[]
}

const weekGroups: WeekGroup[] = [
  {
    week: "28주차",
    cards: [
      {
        date: "5/12 (월)",
        icons: ["🎤", "📷"],
        preview: "오늘 처음으로 발차기를 진하게 느꼈다. 회의 중에 살짝 미소가 새어나왔는데 들킨 것 같다…",
      },
      {
        date: "5/10 (토)",
        icons: ["🎤"],
        preview: "병원에 다녀왔다. 의사 선생님이 콩이가 잘 자라고 있다고 하셨는데, 한 번 더 듣고 싶어서…",
      },
      {
        date: "5/09 (금)",
        icons: ["📷", "📷"],
        preview: "사진 2장",
        mediaOnly: true,
      },
    ],
  },
  {
    week: "27주차",
    cards: [
      {
        date: "5/06 (화)",
        icons: ["🎤"],
        preview: "잠이 안 와서 자정 넘게 누워 있다가 콩이에게 말을 걸었다. 이제 곧 만난다는 게 실감이…",
      },
      {
        date: "5/04 (일)",
        icons: ["🎤", "🎬"],
        preview: "엄마가 처음으로 배에 손을 올려보셨다. 발로 한 번 쿵 차줬는데 다들 웃었다…",
      },
    ],
  },
  {
    week: "26주차",
    cards: [
      {
        date: "4/28 (월)",
        icons: ["🎤"],
        preview: "회사에서 첫 출산 휴가 면담을 했다. 이상하게 마음이 가벼웠다. 이제 우리 둘만의…",
      },
    ],
  },
]

export function M35_DiaryList({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-35 · Diary Tab · 일기 목록 (채워진 상태)" screenClassName="bg-cream">
        {/* ─── Header (AC-008-03) — 단일 아이는 화살표 없음 ───── */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
          <div className="w-8" />
          <div className="text-[15px] font-bold text-ink">일기</div>
          <button className="w-8 h-8 flex items-center justify-center text-ink-sub text-[18px]">
            📅
          </button>
        </div>

        {/* ─── 활성 아이 컨텍스트 표시 (AC-008-03) ─────────────── */}
        <div className="px-5 pt-3 pb-2 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-peach to-coral/40 flex items-center justify-center text-[14px]">
            🌱
          </div>
          <div className="text-[13px] text-ink-sub">
            <span className="font-semibold text-ink">콩이</span>의 일기
          </div>
        </div>

        {/* ─── 일기 목록 그룹 (AC-008-01) ──────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4 space-y-5">
          {weekGroups.map((g) => (
            <div key={g.week}>
              {/* 그룹 헤더 — sticky 후보 위치 */}
              <div className="flex items-center gap-2 mb-2.5 pt-1">
                <Badge variant="week">{g.week}</Badge>
                <div className="h-px flex-1 bg-beige/60" />
              </div>

              {/* 카드 리스트 (AC-008-02 / AC-008-04) */}
              <div className="space-y-2">
                {g.cards.map((c, i) => (
                  <button
                    key={i}
                    className="w-full text-left bg-ivory rounded-db-md shadow-db-sm p-3.5 active:scale-[0.99] transition-transform"
                  >
                    {/* 1행 — 날짜 + 미디어 아이콘 */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="text-[12px] font-semibold text-ink-sub">{c.date}</div>
                      <div className="flex items-center gap-1 text-[13px]">
                        {c.icons.map((ic, j) => (
                          <span key={j}>{ic}</span>
                        ))}
                      </div>
                    </div>
                    {/* 2행 — 본문 미리보기 (또는 미디어 대체) */}
                    <div
                      className={
                        "text-[13.5px] leading-[1.55] line-clamp-2 " +
                        (c.mediaOnly ? "italic text-ink-muted" : "text-ink")
                      }
                    >
                      {c.preview}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Tabbar active="diary" />
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-36 · 일기 탭 — 빈 상태 (활성 아이의 일기가 0건)
//   준수: PRD-008 AC-008-05
//   - 일러스트 + 안내 카피 + 홈으로 가기 CTA
//   - 빈 상태에서도 하단 네비게이션은 그대로 표시
// ─────────────────────────────────────────────────────────────────────────────
export function M36_DiaryListEmpty({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-36 · Diary Tab · 빈 상태 (첫 사용자)" screenClassName="bg-cream">
        {/* ─── Header ──────────────────────────────────────────── */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
          <div className="w-8" />
          <div className="text-[15px] font-bold text-ink">일기</div>
          <div className="w-8" />
        </div>

        {/* ─── 활성 아이 컨텍스트 ─────────────────────────────── */}
        <div className="px-5 pt-3 pb-2 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-peach to-coral/40 flex items-center justify-center text-[14px]">
            🌱
          </div>
          <div className="text-[13px] text-ink-sub">
            <span className="font-semibold text-ink">콩이</span>의 일기
          </div>
        </div>

        {/* ─── 빈 상태 본문 (AC-008-05) ───────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-12">
          {/* 일러스트 — 빈 책 페이지 느낌 */}
          <div className="w-24 h-24 rounded-full bg-peach/30 flex items-center justify-center text-[44px] mb-5 shadow-db-sm">
            📖
          </div>
          <div className="font-serif text-[19px] font-bold text-ink text-center leading-[1.5] mb-2">
            아직 첫 일기를
            <br />
            쓰지 않으셨어요
          </div>
          <div className="text-[13.5px] text-ink-sub text-center leading-[1.65]">
            홈에서 한 마디만 남겨도 괜찮아요.
            <br />
            오늘의 마음이 첫 페이지가 될 거예요.
          </div>
        </div>

        {/* ─── 홈으로 가기 CTA ────────────────────────────────── */}
        <BottomAction>
          <PrimaryButton>홈으로 가기</PrimaryButton>
        </BottomAction>

        <Tabbar active="diary" />
      </PhoneFrame>
    </div>
  )
}
