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
// ─────────────────────────────────────────────────────────────────────────────
export function M26_ParentModeHome({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-26 · Birth Conversion · Stage 7-4" screenClassName="bg-cream">
        {/* welcome ribbon */}
        <div className="px-5 pt-4">
          <div
            className="rounded-db-md p-5"
            style={{
              background: "linear-gradient(135deg, #FDDDD5 0%, #F0E6D8 100%)",
            }}
          >
            <div className="text-[12px] font-semibold text-coral tracking-[0.1em] mb-1.5">
              WELCOME
            </div>
            <div className="font-serif text-[20px] font-bold text-ink leading-[1.5] mb-2">
              콩이의 양육 일기가<br />시작됐어요 💗
            </div>
            <div className="text-[13px] text-ink-sub leading-[1.6]">
              지금까지 남긴 임신 기록은 그대로 보관되어 있어요.<br />
              나중에 책 한 권으로 엮어드릴게요.
            </div>
          </div>
        </div>

        <div className="px-5 pt-5 pb-2">
          <div className="text-[13px] text-ink-sub">9월 16일 화요일 · 오전 9:41</div>
          <div className="font-serif text-[22px] font-bold leading-[1.45] text-ink mt-1">
            오늘 콩이는<br />어떤 표정이었나요?
          </div>
        </div>

        <div className="px-5 pt-2">
          <Badge>D+1</Badge>
        </div>

        <div className="px-5 pt-3">
          <FrameCard className="p-[18px]">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 rounded-db-md flex items-center justify-center text-[30px] bg-gradient-to-br from-peach to-[#FDDDD5]">
                👶
              </div>
              <div className="flex-1">
                <div className="text-[17px] font-bold text-ink">콩이</div>
                <div className="text-[13px] text-ink-sub">2026.09.15 출생 · 3.2kg</div>
                <div className="text-[13px] text-coral font-medium mt-0.5">생후 1일째</div>
              </div>
            </div>
            <div className="mt-3.5 pt-3.5 border-t border-beige">
              <div className="font-serif text-[14px] leading-[1.7] text-ink-sub italic">
                "처음 안았을 때, 손가락이 어찌나 작던지…"
              </div>
              <div className="text-[12px] text-ink-muted mt-1">— 어제 임신 마지막 기록 중에서</div>
            </div>
          </FrameCard>
        </div>

        <div className="px-5 pt-3 pb-32">
          <div className="text-[13px] text-ink-sub mb-2">오늘의 기록 도움말</div>
          <div className="flex flex-wrap gap-2">
            {["처음 본 표정", "엄마 기분", "병실 풍경", "가족 첫 만남"].map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </div>
        </div>

        <Tabbar active="home" />
      </PhoneFrame>
    </div>
  )
}
