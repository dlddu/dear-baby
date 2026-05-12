import { PhoneFrame } from "@/components/PhoneFrame"
import {
  TopBar,
  PrimaryButton,
  SecondaryButton,
  Badge,
  FrameCard,
  Chip,
  Row,
  BottomAction,
  Tabbar,
  CalloutWarm,
  BackToGallery,
} from "@/components/Common"

// ─────────────────────────────────────────────────────────────────────────────
// M-23 · 출산 확인 모달
// ─────────────────────────────────────────────────────────────────────────────
export function M23_BirthConfirmModal({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-23 · Birth Conversion · Stage 7-2" screenClassName="bg-cream">
        {/* dimmed home behind */}
        <div className="opacity-30 pointer-events-none">
          <div className="px-5 pt-5 pb-2">
            <div className="text-[13px] text-ink-sub">9월 16일 화요일 · 오전 9:41</div>
            <div className="font-serif text-[22px] font-bold leading-[1.45] text-ink mt-1">
              오늘은 어떤 마음을<br />콩이에게 들려줄까요?
            </div>
          </div>
          <div className="px-5 pt-2">
            <Badge>임신 40주 1일</Badge>
            <div className="bg-ivory rounded-db-md p-[18px] shadow-db-sm mt-3">
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-db-md bg-gradient-to-br from-peach to-coral/40" />
                <div className="flex-1">
                  <div className="text-[17px] font-bold text-ink">콩이</div>
                  <div className="text-[13px] text-ink-sub">예정일 · 2026.09.15 (어제)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* dim layer */}
        <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm z-20" />

        {/* modal */}
        <div className="absolute inset-0 z-30 flex items-end justify-center pb-6 px-5">
          <div className="w-full bg-ivory rounded-db-lg shadow-db-lg overflow-hidden">
            <div className="px-6 pt-6 pb-2 text-center">
              <div className="text-[44px] mb-2">🌷</div>
              <div className="font-serif text-[20px] font-bold leading-[1.5] text-ink mb-2">
                혹시 콩이를<br />만나셨나요?
              </div>
              <div className="text-[13px] leading-[1.6] text-ink-sub">
                예정일이 지났어요. 만나셨다면 이제부터<br />
                양육 일기로 함께해드릴게요.
              </div>
            </div>
            <div className="px-5 pt-4 pb-5 space-y-2">
              <PrimaryButton>네, 만났어요 💗</PrimaryButton>
              <SecondaryButton>아직이에요</SecondaryButton>
            </div>
            <div className="px-5 py-3 bg-cream">
              <div className="text-[11px] text-ink-sub leading-[1.6] text-center">
                답하지 않으셔도 괜찮아요. 14일 뒤<br />
                다시 안내드릴게요.
              </div>
            </div>
          </div>
        </div>
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-25 · 설정 + D+14 배너
// ─────────────────────────────────────────────────────────────────────────────
export function M25_SettingsBanner({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-25 · Birth Conversion · Stage 7-2 alt (D+14)" screenClassName="bg-cream">
        <TopBar title="설정" />

        {/* gentle banner — 사산·유산 배려 톤 */}
        <div className="px-5 pt-2">
          <CalloutWarm icon="🌿">
            <div>
              <div className="font-bold text-ink mb-0.5">예정일이 지났어요</div>
              <div className="text-[13px] text-ink-sub">
                콩이의 이야기를 계속 이어가려면<br />
                양육 모드로 전환해주세요. 언제든 괜찮아요.
              </div>
              <button className="mt-2 px-3 py-1.5 rounded-full bg-coral text-white text-[12px] font-semibold">
                모드 전환하기
              </button>
            </div>
          </CalloutWarm>
        </div>

        {/* profile */}
        <div className="px-5 pt-3">
          <FrameCard className="flex items-center gap-3 p-3.5">
            <div className="w-14 h-14 rounded-full bg-peach flex items-center justify-center text-[22px]">
              🤰
            </div>
            <div className="flex-1">
              <div className="text-[16px] font-bold text-ink">하늘맘님</div>
              <div className="text-[12px] text-ink-sub">현재: 임신 모드 (40주 1일)</div>
            </div>
            <div className="text-ink-muted text-[18px]">›</div>
          </FrameCard>
        </div>

        {/* sections */}
        <div className="px-5 pt-5">
          <div className="text-[11px] text-ink-muted uppercase tracking-wider pl-1 mb-2">
            기록
          </div>
          <FrameCard className="overflow-hidden">
            <Row icon="🤱" iconBg="bg-coral text-white" title="아이 추가하기" subtitle="새로운 임신·양육 시작" border={false} />
            <Row icon="📒" iconBg="bg-sage text-white" title="기록 백업" subtitle="자동 백업 켜짐" />
            <Row icon="🔔" title="알림 설정" subtitle="매일 오후 9시" />
          </FrameCard>
        </div>

        <div className="px-5 pt-5 pb-4">
          <div className="text-[11px] text-ink-muted uppercase tracking-wider pl-1 mb-2">
            계정
          </div>
          <FrameCard className="overflow-hidden">
            <Row icon="🔒" title="개인정보 보호" border={false} />
            <Row icon="💬" title="고객 지원" />
          </FrameCard>
        </div>

        <Tabbar active="settings" />
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-26 · 양육자 모드 첫 홈 (D+1)
//   PRD-007 구조를 따르되, 출산 전환 직후의 환영 리본을 카드 상단에 유지
// ─────────────────────────────────────────────────────────────────────────────
export function M26_ParentModeHome({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-26 · Birth Conversion · Stage 7-4" screenClassName="bg-cream">
        {/* ─── Header (AC-007-01, 02, 03) — 단일 아이 (출산 직후) */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-beige/60">
          <button className="w-8 h-8 flex items-center justify-center text-ink-muted/40 cursor-default" aria-disabled>◀</button>
          <div className="text-[15px] font-bold text-ink">콩이</div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 flex items-center justify-center text-ink-muted/40 cursor-default" aria-disabled>▶</button>
            <button className="relative w-8 h-8 flex items-center justify-center text-ink-sub">
              <span className="text-[18px]">🔔</span>
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-coral" />
            </button>
          </div>
        </div>

        {/* ─── 환영 리본 (M-26 고유 — 출산 전환 직후 only) ────────── */}
        <div className="px-5 pt-4">
          <div
            className="rounded-db-md p-4"
            style={{ background: "linear-gradient(135deg, #FDDDD5 0%, #F0E6D8 100%)" }}
          >
            <div className="text-[11px] font-semibold text-coral tracking-[0.1em] mb-1">WELCOME</div>
            <div className="font-serif text-[17px] font-bold text-ink leading-[1.45] mb-1.5">
              콩이의 양육 일기가<br />시작됐어요 💗
            </div>
            <div className="text-[12px] text-ink-sub leading-[1.55]">
              지금까지 남긴 임신 기록은 그대로 보관되어 있어요.
            </div>
          </div>
        </div>

        {/* ─── 오늘의 질문 카드 (AC-007-04, 05, 06, 07) ────────────── */}
        <div className="px-5 pt-3">
          <div className="bg-ivory rounded-db-md shadow-db-sm p-4">
            <div className="flex gap-3 items-start">
              <div className="flex flex-col items-center w-[68px] flex-shrink-0">
                <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-peach to-[#FDDDD5] flex items-center justify-center text-[28px] shadow-db-sm">
                  👶
                </div>
                <div className="text-[12px] font-semibold text-ink mt-1.5">콩이</div>
                {/* 양육 모드: 12개월 이하 → mm개월 (nn일째) */}
                <div className="text-[11px] text-coral font-medium">0개월 (1일째)</div>
              </div>

              <div className="flex-1 relative">
                <div className="absolute left-[-6px] top-4 w-3 h-3 bg-cream rotate-45" />
                <div className="bg-cream rounded-db-md p-3.5">
                  <div className="font-serif text-[15px] leading-[1.55] text-ink">
                    엄마, 오늘 저를<br />처음 안았을 때 어떤 기분이었어요?
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

            {/* 책 진행도 (AC-07) — 양육 시작 직후라 카운트가 낮음 */}
            <div className="mt-3.5 pt-3 border-t border-beige/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12px] text-ink-sub">
                  <span>아이에게 전해줄 책이 만들어지고 있어요</span>
                  <button className="w-4 h-4 rounded-full bg-beige flex items-center justify-center text-[10px] text-ink-sub font-bold">?</button>
                </div>
                <div className="text-[12px] font-bold text-coral font-mono">1/50</div>
              </div>
              <div className="mt-1.5 h-1 bg-beige rounded-full overflow-hidden">
                <div className="h-full bg-coral rounded-full" style={{ width: "2%" }} />
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
              { id: "han***4", ctx: "생후 1일", q: "엄마, 오늘 저를 처음 안았을 때 어떤 기분이었어요?", a: "온 세상이 멈춘 것 같았어. 너무 작고 따뜻해서, 한참을 그냥 들여다", hearts: 412 },
              { id: "lee***8", ctx: "생후 8개월", q: "엄마, 오늘 저랑 어떤 책을 읽으셨어요?", a: "곰돌이 푸 인형책을 펼쳤더니 눈을 떼지 못하더라. 페이지를 넘길", hearts: 87 },
              { id: "park***2", ctx: "5살", q: "엄마, 제가 오늘 어떤 꿈을 꿨다고 했어요?", a: "공룡이 학교에 같이 가서 점심을 같이 먹는 꿈을 꿨대. 점심 메뉴는", hearts: 156 },
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
