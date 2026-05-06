import { ReactNode } from "react"
import { PhoneFrame } from "@/components/PhoneFrame"
import {
  TopBar,
  BottomAction,
  PrimaryButton,
  SecondaryButton,
  Badge,
  FrameCard,
  Chip,
  Pill,
  FieldLabel,
  QuestionHeader,
  ProgressDots,
  Row,
  Input,
  BackToGallery,
} from "@/components/Common"

// Layout helper for onboarding screens
function OnboardingLayout({
  label,
  children,
  cta,
  ctaSecondary,
  progress,
  screenClassName = "bg-cream",
  onBack,
  topBarTitle,
}: {
  label: string
  children: ReactNode
  cta?: ReactNode
  ctaSecondary?: ReactNode
  progress?: { total: number; current: number }
  screenClassName?: string
  onBack: () => void
  topBarTitle?: string
}) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label={label} screenClassName={screenClassName}>
        <TopBar title={topBarTitle} />
        {progress && <ProgressDots total={progress.total} current={progress.current} />}
        <div className="pb-32">{children}</div>
        {(cta || ctaSecondary) && (
          <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-cream via-cream/95 to-transparent">
            <BottomAction>
              {ctaSecondary && <div className="mb-2">{ctaSecondary}</div>}
              {cta}
            </BottomAction>
          </div>
        )}
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-01 · 가입 (OAuth)
// ─────────────────────────────────────────────────────────────────────────────
export function M01_Signup({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame
        label="M-01 · Onboarding · Stage 1-1"
        screenClassName="bg-gradient-to-b from-cream to-peach/40"
      >
        <div className="flex flex-col items-center justify-center pt-20 pb-10 px-8 text-center">
          <div className="font-display text-[44px] font-bold text-ink leading-none mb-2">
            Dear<br />Baby
          </div>
          <div className="font-hand text-[24px] text-coral mb-1">기록을 책으로</div>
          <div className="text-[14px] text-ink-sub leading-[1.6] mt-3 max-w-[280px]">
            매일의 작은 마음이<br />사라지지 않도록
          </div>
        </div>

        <div className="px-6 mt-12 space-y-3">
          <button className="w-full h-14 rounded-full bg-ink text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.99]">
            <span className="text-[18px]"></span> Apple로 시작하기
          </button>
          <button className="w-full h-14 rounded-full bg-white text-ink font-semibold text-[15px] flex items-center justify-center gap-2 shadow-db-sm border border-beige active:scale-[0.99]">
            <span className="text-[16px]">G</span> Google로 시작하기
          </button>
        </div>

        <div className="px-8 pt-6 pb-6 text-center">
          <div className="text-[11px] text-ink-muted leading-[1.6]">
            계속하시면 <span className="text-coral underline">이용약관</span>과<br />
            <span className="text-coral underline">개인정보 처리방침</span>에 동의합니다
          </div>
        </div>
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-02 · Q1 임신 중인가요?
// ─────────────────────────────────────────────────────────────────────────────
export function M02_Q1_Pregnancy({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-02 · Onboarding · Stage 2-1"
      progress={{ total: 5, current: 0 }}
      cta={<PrimaryButton>다음</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader
        eyebrow="QUESTION 1"
        title={<>지금 임신 중이신가요?</>}
        helper="기록을 어떻게 시작할지 정해드릴게요"
      />
      <div className="px-6 pt-2 space-y-3">
        <button className="w-full p-5 rounded-db-md bg-coral/10 border-2 border-coral text-left active:scale-[0.99]">
          <div className="text-[16px] font-bold text-ink mb-0.5">네, 임신 중이에요 🤰</div>
          <div className="text-[13px] text-ink-sub">태아의 기록을 시작합니다</div>
        </button>
        <button className="w-full p-5 rounded-db-md bg-ivory border-2 border-transparent text-left active:scale-[0.99] hover:border-coral/30 transition-colors">
          <div className="text-[16px] font-semibold text-ink mb-0.5">아니요, 임신 중은 아니에요</div>
          <div className="text-[13px] text-ink-sub">양육 기록만 시작합니다</div>
        </button>
      </div>
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-03 · Q2 양육 아이 있나요?
// ─────────────────────────────────────────────────────────────────────────────
export function M03_Q2_Children({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-03 · Onboarding · Stage 2-2"
      progress={{ total: 5, current: 1 }}
      cta={<PrimaryButton>다음</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader
        eyebrow="QUESTION 2"
        title={<>이미 키우고 계신<br />아이가 있나요?</>}
        helper="아이별로 따로 기록을 정리해드릴게요"
      />
      <div className="px-6 pt-2 space-y-3">
        <button className="w-full p-5 rounded-db-md bg-ivory border-2 border-transparent text-left active:scale-[0.99]">
          <div className="text-[16px] font-semibold text-ink mb-0.5">네, 있어요 👶</div>
          <div className="text-[13px] text-ink-sub">기존 아이 정보부터 입력합니다</div>
        </button>
        <button className="w-full p-5 rounded-db-md bg-coral/10 border-2 border-coral text-left active:scale-[0.99]">
          <div className="text-[16px] font-bold text-ink mb-0.5">아니요, 첫 아이예요 ✨</div>
          <div className="text-[13px] text-ink-sub">곧 만날 아이의 기록을 시작합니다</div>
        </button>
      </div>
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable: Number selector grid (1, 2, 3+)
// ─────────────────────────────────────────────────────────────────────────────
function NumberPicker({ selected = 1 }: { selected?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          className={
            "aspect-square rounded-db-md flex flex-col items-center justify-center transition-all " +
            (n === selected
              ? "bg-coral text-white shadow-db-md"
              : "bg-ivory text-ink shadow-db-sm")
          }
        >
          <div className="font-display text-[36px] font-bold leading-none">
            {n === 3 ? "3+" : n}
          </div>
          <div className="text-[11px] mt-1 opacity-80">
            {n === 1 ? "단태아" : n === 2 ? "쌍둥이" : "세쌍둥이+"}
          </div>
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-04 · A1 임신 아이 수
// ─────────────────────────────────────────────────────────────────────────────
export function M04_A1_Count({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-04 · Case A · Stage 3-A1"
      progress={{ total: 5, current: 2 }}
      cta={<PrimaryButton>다음</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader
        title="몇 명을 품고 계신가요?"
        helper="아이 수에 맞춰 기록을 따로 정리해드려요"
      />
      <div className="px-6 pt-2">
        <NumberPicker selected={1} />
      </div>
      <div className="px-6 pt-5">
        <div className="flex items-center gap-2 px-4 py-3 rounded-db-sm bg-cream">
          <span className="text-[16px]">💡</span>
          <span className="text-[12px] text-ink-sub leading-[1.5]">
            나중에 설정에서 변경하실 수 있어요
          </span>
        </div>
      </div>
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable: Fetus info form
// ─────────────────────────────────────────────────────────────────────────────
function FetusInfoForm({ heading }: { heading?: string }) {
  return (
    <>
      {heading && (
        <div className="px-6 pt-1 pb-2 text-[12px] font-semibold text-coral tracking-[0.1em] uppercase">
          {heading}
        </div>
      )}
      <div className="px-6 pt-1 space-y-4">
        <div>
          <FieldLabel>예정일</FieldLabel>
          <FrameCard className="flex items-center px-4 py-3.5">
            <span className="text-[20px] mr-3">📅</span>
            <span className="flex-1 text-[15px] text-ink font-semibold">2026년 9월 15일</span>
            <span className="text-ink-muted text-[18px]">›</span>
          </FrameCard>
        </div>
        <div>
          <FieldLabel>
            태명 <span className="text-ink-muted font-normal">(선택)</span>
          </FieldLabel>
          <Input placeholder="콩이" />
        </div>
        <div>
          <FieldLabel>
            성별 <span className="text-ink-muted font-normal">(선택)</span>
          </FieldLabel>
          <div className="flex gap-2.5">
            <Pill>여자아이</Pill>
            <Pill selected>남자아이</Pill>
            <Pill>아직 몰라요</Pill>
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-05 · A2 태아 정보
// ─────────────────────────────────────────────────────────────────────────────
export function M05_A2_FetusInfo({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-05 · Case A · Stage 3-A2"
      progress={{ total: 5, current: 3 }}
      cta={<PrimaryButton>다음</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader
        title={<>아이의 정보를<br />알려주세요</>}
        helper="기록 가이드를 맞춰 보여드릴게요"
      />
      <FetusInfoForm />
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable: Purpose chips
// ─────────────────────────────────────────────────────────────────────────────
function PurposeChips({ heading }: { heading?: string }) {
  return (
    <>
      {heading && (
        <div className="px-6 pt-1 pb-2 text-[12px] font-semibold text-coral tracking-[0.1em] uppercase">
          {heading}
        </div>
      )}
      <div className="px-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Chip selected>매일의 마음</Chip>
          <Chip selected>몸의 변화</Chip>
          <Chip>아이에게 편지</Chip>
          <Chip>꿈·예감</Chip>
          <Chip>가족 이야기</Chip>
          <Chip>병원 기록</Chip>
          <Chip>준비물 정리</Chip>
          <Chip>나만의 작명</Chip>
        </div>
        <div className="text-[12px] text-ink-sub pl-1">중복 선택 가능 · 기본값 추천됨</div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-06 · A3 기록 목적
// ─────────────────────────────────────────────────────────────────────────────
export function M06_A3_Purpose({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-06 · Case A · Stage 3-A3"
      progress={{ total: 5, current: 4 }}
      cta={<PrimaryButton>시작하기 ✨</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader
        title={<>어떤 이야기를<br />남기고 싶으세요?</>}
        helper="이 주제에 맞춘 질문을 매일 보내드려요"
      />
      <PurposeChips />
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-07 · B0 안내 ①
// ─────────────────────────────────────────────────────────────────────────────
export function M07_B0_Intro1({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-07 · Case B · Stage 4-B0"
      progress={{ total: 8, current: 2 }}
      cta={<PrimaryButton>네, 시작할게요</PrimaryButton>}
      onBack={onBack}
    >
      <div className="px-6 pt-8 pb-2 text-center">
        <div className="text-[60px] mb-3">👶✨</div>
        <div className="font-serif text-[22px] font-bold leading-[1.5] text-ink mb-3">
          먼저 키우고 계신<br />아이부터 알려주세요
        </div>
        <div className="text-[14px] leading-[1.7] text-ink-sub max-w-[280px] mx-auto">
          이미 만난 아이의 기록과<br />
          새로 시작하는 임신 기록을<br />
          따로따로 정리해드릴게요
        </div>
      </div>
      <div className="px-6 pt-6">
        <FrameCard className="p-5">
          <div className="flex items-center gap-3 pb-3 border-b border-beige">
            <div className="w-10 h-10 rounded-full bg-sage/30 flex items-center justify-center text-[18px]">
              1
            </div>
            <div className="flex-1 text-[14px] text-ink font-semibold">기존 아이 정보</div>
          </div>
          <div className="flex items-center gap-3 pt-3 pb-3 border-b border-beige">
            <div className="w-10 h-10 rounded-full bg-peach/40 flex items-center justify-center text-[18px]">
              2
            </div>
            <div className="flex-1 text-[14px] text-ink font-semibold">임신 중인 아이 정보</div>
          </div>
          <div className="flex items-center gap-3 pt-3">
            <div className="w-10 h-10 rounded-full bg-coral/20 flex items-center justify-center text-[18px]">
              3
            </div>
            <div className="flex-1 text-[14px] text-ink font-semibold">기록 시작</div>
          </div>
        </FrameCard>
      </div>
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-08 · B1 양육 아이 수
// ─────────────────────────────────────────────────────────────────────────────
export function M08_B1_Count({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-08 · Case B · Stage 4-B1"
      progress={{ total: 8, current: 3 }}
      cta={<PrimaryButton>다음</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader
        title={<>지금 키우고 계신<br />아이는 몇 명인가요?</>}
        helper="아이별로 기록을 따로 정리해드려요"
      />
      <div className="px-6 pt-2">
        <NumberPicker selected={2} />
      </div>
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable: Child info form
// ─────────────────────────────────────────────────────────────────────────────
function ChildInfoForm({ ordinal }: { ordinal: string }) {
  return (
    <FrameCard className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-coral text-white font-bold text-[14px] flex items-center justify-center">
          {ordinal}
        </div>
        <div className="text-[14px] font-bold text-ink">{ordinal}째 아이</div>
      </div>
      <div>
        <FieldLabel>이름</FieldLabel>
        <Input placeholder="이름 입력" />
      </div>
      <div>
        <FieldLabel>생년월일</FieldLabel>
        <FrameCard className="flex items-center px-4 py-3 bg-cream shadow-none">
          <span className="text-[18px] mr-3">📅</span>
          <span className="flex-1 text-[14px] text-ink font-semibold">2024년 3월 12일</span>
          <span className="text-ink-muted text-[16px]">›</span>
        </FrameCard>
      </div>
      <div>
        <FieldLabel>성별</FieldLabel>
        <div className="flex gap-2">
          <Pill>여자아이</Pill>
          <Pill selected>남자아이</Pill>
        </div>
      </div>
    </FrameCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-09 · B2 양육 아이 정보
// ─────────────────────────────────────────────────────────────────────────────
export function M09_B2_ChildrenInfo({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-09 · Case B · Stage 4-B2"
      progress={{ total: 8, current: 4 }}
      cta={<PrimaryButton>다음</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader title="아이들의 정보를 알려주세요" helper="이름과 생일만 있으면 충분해요" />
      <div className="px-6 pt-2 space-y-4">
        <ChildInfoForm ordinal="첫" />
        <ChildInfoForm ordinal="둘" />
      </div>
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-10 · B3 안내 ②
// ─────────────────────────────────────────────────────────────────────────────
export function M10_B3_Intro2({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-10 · Case B · Stage 4-B3"
      progress={{ total: 8, current: 5 }}
      cta={<PrimaryButton>네, 입력할게요</PrimaryButton>}
      onBack={onBack}
    >
      <div className="px-6 pt-8 pb-2 text-center">
        <div className="text-[60px] mb-3">🌱</div>
        <div className="font-serif text-[22px] font-bold leading-[1.5] text-ink mb-3">
          이제 곧 만날<br />아이 차례예요
        </div>
        <div className="text-[14px] leading-[1.7] text-ink-sub max-w-[280px] mx-auto">
          임신 중인 아이의 정보를 입력하면<br />
          홈에서 아이별로 자유롭게<br />
          전환할 수 있어요
        </div>
      </div>
      <div className="px-6 pt-8">
        <FrameCard className="p-5">
          <div className="text-[12px] text-ink-sub mb-3">이미 입력된 아이</div>
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-12 rounded-full bg-sage/30 flex items-center justify-center text-[18px]">
              👧
            </div>
            <div className="text-[14px] font-semibold text-ink">서연 · 2세</div>
            <div className="ml-auto">
              <Badge variant="sage">완료</Badge>
            </div>
          </div>
        </FrameCard>
      </div>
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-11 · B4 임신 아이 수
// ─────────────────────────────────────────────────────────────────────────────
export function M11_B4_PregnancyCount({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-11 · Case B · Stage 4-B4"
      progress={{ total: 8, current: 6 }}
      cta={<PrimaryButton>다음</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader
        title={<>이번에는 몇 명을<br />품고 계신가요?</>}
        helper="단태아라면 1을 골라주세요"
      />
      <div className="px-6 pt-2">
        <NumberPicker selected={1} />
      </div>
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-12 · B5 태아 정보
// ─────────────────────────────────────────────────────────────────────────────
export function M12_B5_FetusInfo({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-12 · Case B · Stage 4-B5"
      progress={{ total: 8, current: 7 }}
      cta={<PrimaryButton>다음</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader title={<>곧 만날 아이의 정보예요</>} helper="이전 아이들과 따로 기록해드려요" />
      <FetusInfoForm />
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-13 · B6 기록 목적 (아이별)
// ─────────────────────────────────────────────────────────────────────────────
export function M13_B6_Purpose({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-13 · Case B · Stage 4-B6"
      progress={{ total: 8, current: 7 }}
      cta={<PrimaryButton>시작하기 ✨</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader
        title={<>아이별로 어떤 이야기를<br />남기고 싶으세요?</>}
        helper="아이마다 다른 톤의 가이드를 보내드려요"
      />
      <div className="px-6 space-y-4">
        <div className="bg-sage/10 rounded-db-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-sage/40 flex items-center justify-center text-[14px]">
              👧
            </div>
            <div className="text-[14px] font-bold text-ink">서연 (2세)</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip selected>일상의 발견</Chip>
            <Chip selected>말의 성장</Chip>
            <Chip>가족과의 시간</Chip>
            <Chip>웃음 포인트</Chip>
          </div>
        </div>
        <div className="bg-peach/20 rounded-db-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-peach/60 flex items-center justify-center text-[14px]">
              🌱
            </div>
            <div className="text-[14px] font-bold text-ink">콩이 (임신 17주)</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip selected>매일의 마음</Chip>
            <Chip selected>몸의 변화</Chip>
            <Chip>아이에게 편지</Chip>
            <Chip>병원 기록</Chip>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-14 · C1 양육 아이 수
// ─────────────────────────────────────────────────────────────────────────────
export function M14_C1_Count({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-14 · Case C · Stage 5-C1"
      progress={{ total: 4, current: 1 }}
      cta={<PrimaryButton>다음</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader
        title={<>지금 키우고 계신<br />아이는 몇 명인가요?</>}
        helper="아이별로 따로 기록을 정리해드려요"
      />
      <div className="px-6 pt-2">
        <NumberPicker selected={1} />
      </div>
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-15 · C2 아이 정보
// ─────────────────────────────────────────────────────────────────────────────
export function M15_C2_ChildInfo({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-15 · Case C · Stage 5-C2"
      progress={{ total: 4, current: 2 }}
      cta={<PrimaryButton>다음</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader title="아이의 정보를 알려주세요" helper="기록 가이드를 맞춰드릴게요" />
      <div className="px-6 pt-2">
        <ChildInfoForm ordinal="첫" />
      </div>
    </OnboardingLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-16 · C3 기록 목적
// ─────────────────────────────────────────────────────────────────────────────
export function M16_C3_Purpose({ onBack }: { onBack: () => void }) {
  return (
    <OnboardingLayout
      label="M-16 · Case C · Stage 5-C3"
      progress={{ total: 4, current: 3 }}
      cta={<PrimaryButton>시작하기 ✨</PrimaryButton>}
      onBack={onBack}
    >
      <QuestionHeader
        title={<>어떤 이야기를<br />남기고 싶으세요?</>}
        helper="이 주제에 맞춘 질문을 매일 보내드려요"
      />
      <div className="px-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Chip selected>일상의 발견</Chip>
          <Chip selected>말과 행동의 성장</Chip>
          <Chip>웃긴 순간</Chip>
          <Chip>음식·취향</Chip>
          <Chip>친구와의 시간</Chip>
          <Chip>가족 이벤트</Chip>
          <Chip>병원·건강</Chip>
          <Chip>마음의 변화</Chip>
        </div>
        <div className="text-[12px] text-ink-sub pl-1">중복 선택 가능</div>
      </div>
    </OnboardingLayout>
  )
}
