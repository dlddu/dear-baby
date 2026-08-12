import { PhoneFrame } from "@/components/PhoneFrame"
import { Tabbar, BackToGallery } from "@/components/Common"

// ─────────────────────────────────────────────────────────────────────────────
// M-43 · 커뮤니티 탭 — 메인 (공개 기록 피드)
//   준수: PRD-009
//     · AC-009-02 메인 화면 구조 ①헤더 ②나와 비슷한 엄마들의 기록 ③오늘의 질문 카드
//                 ④콘텐츠 타입 필터 ⑤공개 기록 피드 + 피드 카드 구성 요소
//     · AC-009-03 유사 시기 자동 추천 (상태값 표시만, 수동 필터 미제공 — 1차)
//     · AC-009-04 오늘의 질문 카드 (라벨 · 질문 · 안내 문구 · CTA)
//     · AC-009-06 콘텐츠 타입 필터 (전체/질문답변/자유일기, 기본값 전체)
//     · AC-009-10 커뮤니티 표시명 마스킹 (앞 3자 + *** + 끝 1자) · 태명/사진 비노출
//     · AC-009-08 공감 표기 (하트 + 카운트, "좋아요" 아님)
//   미포함: 글쓰기 버튼 없음 (AC-009-01) · 사진 없음 (AC-009-10) · 알림 아이콘은
//           탭 공통 헤더 요소이며 커뮤니티 알림(AC-009-12)은 1차 제외
//   노출 순서/노출 풀은 본 화면의 명세 범위 밖 (ENG-007~010 미확정)
// ─────────────────────────────────────────────────────────────────────────────
export function M43_CommunityMain({ onBack }: { onBack: () => void }) {
  // 콘텐츠 타입 필터 — 기본 선택값 `전체` (AC-009-06)
  const filters = ["전체", "질문답변", "자유일기"]
  const activeFilter = "전체"

  // 공개 기록 피드 (AC-009-02) — 표시명은 모두 마스킹 결과 (AC-009-10)
  const feed = [
    {
      name: "seo***1",
      stage: "생후 5개월",
      kind: "question" as const,
      title: "엄마, 제가 오늘 처음으로 보여준 표정이 뭐였어요?",
      body: "옹알이를 하다가 갑자기 씨익 웃었는데, 그 순간 시간이 멈춘 것 같았어.",
      likes: 365,
      comments: 12,
    },
    {
      name: "pak***7",
      stage: "임신 20주차",
      kind: "question" as const,
      title: "엄마, 오늘은 제가 어떤 노래를 듣고 싶어 했을까요?",
      body: "내가 좋아하는 옛날 발라드를 한 곡 들려줬어.\n배가 살짝 움직이는 것 같았는데…",
      likes: 88,
      comments: 3,
    },
    {
      name: "cho***3",
      stage: "임신 3주차",
      kind: "diary" as const,
      title: "오늘 병원에 다녀온 날",
      body: "작은 화면 속 점 하나가 이렇게 크게 느껴질 줄 몰랐어.",
      likes: 50,
      comments: 5,
    },
  ]

  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />

      <PhoneFrame
        label="M-43 · Community · PRD-009 AC-009-02·03·04·06"
        screenClassName="bg-cream"
      >
        {/* ─── 상단 헤더 (AC-009-02 ①) ─────────────────────────────── */}
        {/* 탭 루트이므로 뒤로가기 없음 — 일기 탭 헤더(AC-008-10)와 동일 규칙.
            원본 기획 이미지에는 ◀ 가 있었으나 탭 루트 규칙을 따라 제거했다. */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
          <div className="w-8 h-8" />
          <div className="text-[17px] font-bold text-ink font-display">커뮤니티</div>
          <button className="relative w-8 h-8 flex items-center justify-center text-ink-sub">
            <span className="text-[18px]">🔔</span>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-coral" />
          </button>
        </div>

        {/* ─── 나와 비슷한 엄마들의 기록 (AC-009-03) ─────────────────── */}
        {/* 1차 런치는 수동 필터 미제공 — 활성 아이 기준 상태값 표시만 한다 */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
          <div className="text-[17px] font-bold text-ink leading-tight">
            나와 비슷한 엄마들의 기록
          </div>
          <div className="flex items-center gap-1.5 bg-beige rounded-full px-3.5 py-2 flex-shrink-0">
            <span className="text-[13px] font-semibold text-ink">임신 20주차</span>
            <span className="text-[10px] text-ink-sub">▼</span>
          </div>
        </div>

        {/* ─── 오늘의 질문 카드 (AC-009-04) ──────────────────────────── */}
        <div className="px-5 pb-4">
          <div className="relative bg-ivory rounded-db-lg shadow-db-sm px-5 pt-5 pb-5">
            {/* 라벨 */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-full bg-coral/10 flex items-center justify-center text-[13px] text-coral">
                ?
              </span>
              <span className="text-[14px] font-semibold text-ink">오늘의 질문</span>
            </div>

            {/* 질문 텍스트 — 홈과 동일한 오늘의 질문 (ENG-002 고정 풀) */}
            <div className="font-serif text-[19px] font-bold leading-[1.5] text-ink pr-[92px]">
              엄마, 오늘은 제가 어떤 노래를
              <br />
              듣고 싶어 했을까요?
            </div>

            {/* 일러스트 — 태명·사진 비노출 원칙에 따라 일반 캐릭터만 사용 */}
            <div className="absolute right-4 top-[58px] w-[88px] h-[88px] pointer-events-none">
              <div className="absolute inset-0 rounded-full bg-peach/35" />
              <div className="absolute inset-0 flex items-center justify-center text-[44px]">
                👶
              </div>
              <div className="absolute -top-1 right-1 text-[15px]">💗</div>
              <div className="absolute top-7 -right-1 text-[12px]">💗</div>
            </div>

            {/* 안내 문구 */}
            <div className="flex items-start gap-2 mt-6 mb-4">
              <span className="text-[14px] text-coral leading-[1.5] flex-shrink-0">🔒</span>
              <div className="text-[13px] leading-[1.65] text-ink-sub">
                내 답변을 공개하면 같은 질문에
                <br />
                답한 기록을 볼 수 있어요.
              </div>
            </div>

            {/* CTA — 답변 상태에 따라 3분기 (미답변 / 비공개 / 공개) */}
            <button className="w-full h-12 rounded-db-sm bg-coral text-white font-semibold text-[15px] shadow-db-md active:scale-[0.99] transition-transform">
              다른 엄마들의 답변 보기
            </button>
          </div>
        </div>

        {/* ─── 콘텐츠 타입 필터 (AC-009-06) ──────────────────────────── */}
        <div className="px-5 pb-3">
          <div className="flex bg-cream border border-beige rounded-db-md p-1">
            {filters.map((f) => (
              <div
                key={f}
                className={
                  "flex-1 text-center py-2.5 rounded-db-sm text-[14px] font-semibold transition-colors " +
                  (f === activeFilter ? "bg-coral text-white shadow-db-sm" : "text-ink-sub")
                }
              >
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* ─── 공개 기록 피드 (AC-009-02) ────────────────────────────── */}
        <div className="px-5 pb-28 space-y-3">
          {feed.map((c) => (
            <FeedCard key={c.name} {...c} />
          ))}
        </div>

        {/* ─── 하단 네비 (PRD-007 AC-007-10) ────────────────────────── */}
        <Tabbar active="community" />
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 피드 카드 (AC-009-02) — 표시명 · 아이 현황 · 타입 · 질문/제목 · 미리보기 ·
// 공감 수 · 댓글 수. 사진은 1차 런치에서 노출하지 않는다 (AC-009-10).
// ─────────────────────────────────────────────────────────────────────────────
function FeedCard({
  name,
  stage,
  kind,
  title,
  body,
  likes,
  comments,
}: {
  name: string
  stage: string
  kind: "question" | "diary"
  title: string
  body: string
  likes: number
  comments: number
}) {
  return (
    <div className="bg-ivory rounded-db-md shadow-db-sm px-4 py-4">
      {/* 메타 행 — 마스킹 표시명 + 아이 현황 + 공감 수 */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[14px] font-bold text-ink">{name}</span>
        <span className="text-[12px] text-ink-muted">{stage}</span>
        <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[15px]">❤️</span>
          <span className="text-[14px] font-semibold text-coral tabular-nums">{likes}</span>
        </span>
      </div>

      {/* 질문 텍스트(질문답변) 또는 제목(자유일기) */}
      <div className="text-[15px] font-bold text-ink leading-[1.45] mb-1.5">
        {kind === "diary" && (
          <span className="inline-flex items-center align-middle mr-2 px-2 py-0.5 rounded-db-xs bg-peach/35 text-[11px] font-semibold text-ink">
            자유일기
          </span>
        )}
        {title}
      </div>

      {/* 본문 미리보기 — 2~3줄 */}
      <div className="text-[13px] text-ink-sub leading-[1.7] whitespace-pre-line mb-3">
        {body}
      </div>

      {/* 댓글 수 */}
      <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
        <span className="text-[13px]">💬</span>
        <span>댓글 {comments}</span>
      </div>
    </div>
  )
}
