export type ScreenId =
  | "gallery"
  | "home"
  | "birth"
  | "M01" | "M02" | "M03" | "M04" | "M05" | "M06" | "M07" | "M08"
  | "M09" | "M10" | "M11" | "M12" | "M13" | "M14" | "M15" | "M16"
  | "M35"
  | "M18" | "M19" | "M20" | "M21" | "M22"
  | "M23" | "M25" | "M26"
  | "M27" | "M28" | "M29" | "M30"
  | "M31" | "M32" | "M33" | "M34"
  | "M36" | "M37" | "M38" | "M39"
  | "M40" | "M41" | "M42"
  | "M43"

interface MockupCard {
  id: string
  name: string
  meta: string
  navigate: ScreenId
  tags?: { kind: "value" | "peak" | "case-a" | "case-b" | "case-c"; label: string }[]
}

const groups: { num: string; title: string; cards: MockupCard[] }[] = [
  {
    num: "JOURNEY 01",
    title: "Onboarding (가입 · 케이스 분기 · 정보 입력)",
    cards: [
      { id: "M-01", name: "가입 · OAuth", meta: "Apple / Google 진입점", navigate: "M01", tags: [{ kind: "value", label: "V-001" }] },
      { id: "M-02", name: "Q1 — 임신 중인가요?", meta: "케이스 분기 1차", navigate: "M02" },
      { id: "M-03", name: "Q2 — 양육 아이가 있나요?", meta: "케이스 분기 2차", navigate: "M03" },
      { id: "M-04", name: "A1 — 임신 아이 수", meta: "단태아 · 쌍둥이", navigate: "M04", tags: [{ kind: "case-a", label: "Case A" }] },
      { id: "M-05", name: "A2 — 태아 정보", meta: "예정일 · 태명 · 성별", navigate: "M05", tags: [{ kind: "case-a", label: "Case A" }] },
      { id: "M-06", name: "A3 — 기록 목적", meta: "맞춤 가이드 분기", navigate: "M06", tags: [{ kind: "case-a", label: "Case A" }] },
      { id: "M-07", name: "B0 — 안내 ①", meta: "기존 아이부터 안내", navigate: "M07", tags: [{ kind: "case-b", label: "Case B" }] },
      { id: "M-08", name: "B1 — 양육 아이 수", meta: "현재 양육 아이 인원", navigate: "M08", tags: [{ kind: "case-b", label: "Case B" }] },
      { id: "M-09", name: "B2 — 양육 아이 정보", meta: "생년월일 · 이름", navigate: "M09", tags: [{ kind: "case-b", label: "Case B" }] },
      { id: "M-35", name: "B2-Purpose — 양육 기록 목적 (아이별 1:1)", meta: "양육 칩 8종 · 아이별 반복", navigate: "M35", tags: [{ kind: "case-b", label: "Case B" }] },
      { id: "M-10", name: "B3 — 안내 ②", meta: "임신 아이 정보 시작", navigate: "M10", tags: [{ kind: "case-b", label: "Case B" }] },
      { id: "M-11", name: "B4 — 임신 아이 수", meta: "단태아 · 쌍둥이", navigate: "M11", tags: [{ kind: "case-b", label: "Case B" }] },
      { id: "M-12", name: "B5 — 태아 정보", meta: "예정일 · 태명 · 성별", navigate: "M12", tags: [{ kind: "case-b", label: "Case B" }] },
      { id: "M-13", name: "B6 — 기록 목적 (아이별)", meta: "아이 단위 가이드", navigate: "M13", tags: [{ kind: "case-b", label: "Case B" }] },
      { id: "M-14", name: "C1 — 양육 아이 수", meta: "양육 only 모드", navigate: "M14", tags: [{ kind: "case-c", label: "Case C" }] },
      { id: "M-15", name: "C2 — 아이 정보", meta: "생년월일 · 이름", navigate: "M15", tags: [{ kind: "case-c", label: "Case C" }] },
      { id: "M-16", name: "C3 — 기록 목적", meta: "맞춤 가이드", navigate: "M16", tags: [{ kind: "case-c", label: "Case C" }] },
    ],
  },
  {
    num: "JOURNEY 02",
    title: "Daily Recording (홈 · 음성 · 텍스트 · 미디어)",
    cards: [
      { id: "M-17", name: "홈 — 임신 모드 (단일)", meta: "콩이 캐릭터 · 17주 3일", navigate: "home", tags: [{ kind: "value", label: "V-002" }] },
      { id: "M-18", name: "홈 — 다자녀 (Case B)", meta: "서연 · 하준 전환 탭", navigate: "M18", tags: [{ kind: "value", label: "V-002" }] },
      { id: "M-19", name: "음성 녹음", meta: "waveform · 00:48", navigate: "M19", tags: [{ kind: "value", label: "V-003" }] },
      { id: "M-20", name: "AI STT 결과 편집", meta: "자동 변환 + 손편집", navigate: "M20", tags: [{ kind: "value", label: "V-003" }] },
      { id: "M-21", name: "사진·영상·음성 첨부", meta: "3×3 카메라롤", navigate: "M21" },
      { id: "M-22", name: "기록 저장 완료", meta: '"한 페이지가 더해졌어요"', navigate: "M22" },
    ],
  },
  {
    num: "JOURNEY 03",
    title: "Birth Conversion (출산 · 모드 전환)",
    cards: [
      { id: "M-23", name: "출산 확인 모달", meta: "D+1 첫 진입 시", navigate: "M23" },
      { id: "M-24", name: "출생일 입력", meta: '"드디어 만났어요"', navigate: "birth", tags: [{ kind: "peak", label: "★ 봉우리" }, { kind: "value", label: "V-005" }] },
      { id: "M-25", name: "설정 + D+14 배너", meta: "사산·유산 배려 톤", navigate: "M25" },
      { id: "M-26", name: "양육자 모드 첫 홈", meta: "D+1 환영 카피", navigate: "M26", tags: [{ kind: "value", label: "V-005" }] },
    ],
  },
  {
    num: "JOURNEY 04",
    title: "AI Narrative (서사 생성 · 미리보기 · 편집)",
    cards: [
      { id: "M-27", name: "AI 서사 요청", meta: '"원본은 그대로 보존됩니다"', navigate: "M27", tags: [{ kind: "value", label: "V-004" }] },
      { id: "M-28", name: "AI 처리 로딩", meta: "62% · 단계 시각화", navigate: "M28" },
      { id: "M-29", name: "서사 미리보기", meta: '"한 권의 이야기가 완성됐어요"', navigate: "M29", tags: [{ kind: "peak", label: "★ 봉우리" }, { kind: "value", label: "V-004" }] },
      { id: "M-30", name: "서사 편집", meta: "챕터 순서 · 미디어", navigate: "M30", tags: [{ kind: "value", label: "V-004" }] },
    ],
  },
  {
    num: "JOURNEY 05",
    title: "Book Production (레이아웃 · 결제 · 배송)",
    cards: [
      { id: "M-31", name: "표지·레이아웃 선택", meta: "4종 큐레이션 + 사양", navigate: "M31", tags: [{ kind: "value", label: "V-006" }] },
      { id: "M-32", name: "전체 미리보기 (펼침면)", meta: "영상=대표프레임+QR · 음성=QR", navigate: "M32", tags: [{ kind: "value", label: "V-006" }] },
      { id: "M-33", name: "결제", meta: "사양 · 배송 · 결제수단", navigate: "M33", tags: [{ kind: "value", label: "V-007" }] },
      { id: "M-34", name: "제작·배송 추적", meta: "5단계 타임라인", navigate: "M34", tags: [{ kind: "value", label: "V-007" }] },
    ],
  },
  {
    num: "JOURNEY 06",
    title: "Diary Browsing (일기 탭 · 조회 · 사후 관리)",
    cards: [
      { id: "M-36", name: "일기 탭 — 목록 (단일 아이 통합)", meta: "월 그룹 · 카드 아이 컨텍스트 칩", navigate: "M36", tags: [{ kind: "value", label: "V-001" }] },
      { id: "M-37", name: "일기 탭 — 다자녀 통합 (콩이+하준)", meta: "월 그룹에 두 아이 섞임 + 필터", navigate: "M37", tags: [{ kind: "case-b", label: "Case B" }, { kind: "value", label: "V-002" }, { kind: "value", label: "V-003" }] },
      { id: "M-38", name: "기록 상세 + ⋯ 액션 시트", meta: "아이 컨텍스트 칩 · 편집 · 삭제", navigate: "M38", tags: [{ kind: "value", label: "V-007" }] },
      { id: "M-39", name: "빈 상태 (기록 0건)", meta: "📓 안내 + 홈으로 가기 CTA", navigate: "M39" },
      { id: "M-40", name: "기록 편집 (사후)", meta: "본문 · 미디어 · 공개여부 · 잠금 표시", navigate: "M40", tags: [{ kind: "value", label: "V-002" }] },
      { id: "M-41", name: "삭제 확인 모달", meta: "아이 이름 치환 · 코랄 위험 강조", navigate: "M41", tags: [{ kind: "value", label: "V-002" }] },
      { id: "M-42", name: "필터 시트 (다자녀)", meta: "아이 · 기간 · 미디어 · 공개여부 · 적용", navigate: "M42", tags: [{ kind: "case-b", label: "Case B" }, { kind: "value", label: "V-002" }] },
    ],
  },
  {
    num: "PRD-009",
    title: "Community (커뮤니티 탭 · 여정 문서 미작성)",
    cards: [
      { id: "M-43", name: "커뮤니티 — 메인 피드", meta: "유사 시기 · 오늘의 질문 · 타입 필터 · 공개 기록", navigate: "M43", tags: [{ kind: "value", label: "V-008" }, { kind: "value", label: "V-002" }, { kind: "value", label: "V-005" }] },
    ],
  },
]

const tagStyles = {
  value: "bg-sage text-white",
  peak: "bg-coral text-white",
  "case-a": "bg-[#E89BAB]/40 text-ink",
  "case-b": "bg-[#E8B878]/40 text-ink",
  "case-c": "bg-[#7EB3E8]/40 text-ink",
}

interface Props {
  onNavigate: (s: ScreenId) => void
}

export function GalleryScreen({ onNavigate }: Props) {
  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12">
      {/* hero */}
      <div className="mb-3">
        <div className="font-display text-[40px] font-bold text-ink leading-tight">
          DearBaby — Mockups
        </div>
      </div>
      <div className="text-[15px] text-ink-sub mb-2">
        43개 mockup · 6개 사용자 여정 + 커뮤니티(PRD-009) · 디자인 시스템 토큰 1:1 적용
      </div>
      <div className="font-hand text-[22px] text-coral mb-10">
        "기록을 책으로 — 사라지지 않는 마음"
      </div>

      {groups.map((g) => (
        <section key={g.num} className="mt-10">
          <div className="flex items-baseline gap-3 mb-4 pb-2 border-b border-ink/12">
            <span className="font-display text-[14px] text-coral tracking-[0.1em]">{g.num}</span>
            <h2 className="text-[20px] font-bold text-ink">{g.title}</h2>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {g.cards.map((c) => (
              <button
                key={c.id}
                onClick={() => onNavigate(c.navigate)}
                className="text-left bg-ivory rounded-db-md p-4 shadow-db-sm border border-transparent transition-all hover:border-coral hover:shadow-db-md hover:-translate-y-0.5 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-display text-[11px] text-coral tracking-[0.08em]">
                    {c.id}
                  </span>
                  <span className="text-[18px] text-ink-muted">→</span>
                </div>
                <div className="text-[15px] font-semibold text-ink leading-[1.4] mb-1">
                  {c.name}
                </div>
                <div className="text-[12px] text-ink-sub leading-[1.5] mb-2">{c.meta}</div>
                {c.tags && c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.tags.map((t, i) => (
                      <span
                        key={i}
                        className={"text-[10px] font-semibold px-2 py-0.5 rounded-full " + tagStyles[t.kind]}
                      >
                        {t.label}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* footer note */}
      <section className="mt-16">
        <div className="bg-ivory rounded-db-md p-6 shadow-db-sm text-[14px] leading-[1.7] text-ink">
          <strong>스코프</strong> · 43개 페이지 · 모바일 393 × 852 (iPhone 15 base)<br />
          <strong>참조 문서</strong> · <code>docs/user-journeys/*</code> · <code>docs/design-system/*</code> · <code>docs/values/product-values.md</code><br />
          <strong>★ 감정 봉우리 페이지</strong> · M-24 (출생일 입력) · M-29 (서사 미리보기)<br />
          <strong>케이스 분기</strong> · A 임신 only · B 임신+양육 · C 양육 only<br />
          <strong>디자인 토큰</strong> · Coral #D4836B · Peach #F5C6A8 · Cream #FAF6F1 · Sage #A8C5A0
        </div>
      </section>
    </div>
  )
}
