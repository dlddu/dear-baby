import { PhoneFrame } from "@/components/PhoneFrame"
import {
  TopBar,
  PrimaryButton,
  Badge,
  FrameCard,
  Row,
  BottomAction,
  StepIndicator,
  Tabbar,
  Input,
  FieldLabel,
  BackToGallery,
} from "@/components/Common"

// ─────────────────────────────────────────────────────────────────────────────
// M-31 · 표지·레이아웃 선택
// ─────────────────────────────────────────────────────────────────────────────
export function M31_BookLayout({ onBack }: { onBack: () => void }) {
  const covers = [
    {
      name: "크림 클래식",
      desc: "담백한 정통 스타일",
      bg: "bg-gradient-to-br from-cream to-beige",
      text: "text-ink",
      title: "Dear Baby",
      sub: "A LETTER TO MY CHILD",
      selected: true,
    },
    {
      name: "코랄 글로우",
      desc: "따뜻한 일출",
      bg: "bg-gradient-to-br from-coral to-peach",
      text: "text-white",
      title: "콩이의 시간",
      sub: "2026 · A STORY",
    },
    {
      name: "세이지 평온",
      desc: "차분하고 자연적",
      bg: "bg-gradient-to-br from-sage to-teal",
      text: "text-white",
      title: "너에게로",
      sub: "A JOURNEY",
    },
    {
      name: "갈색 양장",
      desc: "고급 가죽풍",
      bg: "bg-gradient-to-br from-ink to-ink-sub",
      text: "text-cream",
      title: "아이의 책",
      sub: "2026",
    },
  ]

  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-31 · Book Production · Stage 9-1" screenClassName="bg-cream">
        <TopBar title="표지 고르기" />
        <StepIndicator steps={["표지", "미리보기", "결제"]} current={0} />

        <div className="px-5 pt-2">
          <div className="font-serif text-[18px] font-bold text-ink leading-[1.5]">
            마음에 드는 표지를 골라주세요
          </div>
          <div className="text-[12px] text-ink-sub mt-1">
            레이아웃은 자동으로 어울리게 맞춰드려요
          </div>
        </div>

        <div className="px-5 pt-3">
          <div className="grid grid-cols-2 gap-3">
            {covers.map((c) => (
              <div
                key={c.name}
                className={
                  "bg-ivory rounded-db-md p-3 shadow-db-sm border-2 transition-all " +
                  (c.selected ? "border-coral ring-4 ring-coral/15" : "border-transparent")
                }
              >
                <div
                  className={`aspect-[3/4] rounded-db-sm flex flex-col items-center justify-center text-center p-3 mb-2 ${c.bg} ${c.text}`}
                >
                  <div className="font-display text-[14px] font-bold leading-tight">
                    {c.title}
                  </div>
                  <div className="text-[8px] tracking-wider mt-1 opacity-80">{c.sub}</div>
                </div>
                <div className="text-[12px] font-semibold text-ink">{c.name}</div>
                <div className="text-[10px] text-ink-muted mt-0.5">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 pt-4">
          <FieldLabel>
            표지 제목 <span className="text-ink-muted font-normal">(직접 수정 가능)</span>
          </FieldLabel>
          <Input value="Dear Baby — 콩이에게" />
        </div>

        <div className="px-5 pt-3 pb-4">
          <FieldLabel>크기 · 재질</FieldLabel>
          <FrameCard className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <input type="radio" defaultChecked className="w-4 h-4 accent-coral" />
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-ink">하드커버 A5 · 크림지</div>
                <div className="text-[11px] text-ink-sub">표준 — 추천</div>
              </div>
              <div className="text-[14px] font-bold text-ink">₩42,000</div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5 border-t border-beige">
              <input type="radio" className="w-4 h-4 accent-coral" />
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-ink">소프트커버 B6 · 백색지</div>
                <div className="text-[11px] text-ink-sub">가벼운 휴대용</div>
              </div>
              <div className="text-[14px] font-bold text-ink">₩28,000</div>
            </div>
          </FrameCard>
        </div>

        <BottomAction>
          <PrimaryButton>미리보기로 →</PrimaryButton>
        </BottomAction>
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-32 · 전체 미리보기
// ─────────────────────────────────────────────────────────────────────────────
function Spread({
  caption,
  left,
  right,
  pageL,
  pageR,
}: {
  caption: string
  left: React.ReactNode
  right: React.ReactNode
  pageL: number
  pageR: number
}) {
  return (
    <div className="px-4 pt-1 pb-2">
      <div className="text-[11px] text-ink-sub text-center mb-2">{caption}</div>
      <div className="flex gap-1.5">
        <div className="flex-1 bg-white rounded-l shadow-db-sm relative min-h-[180px] p-3">
          {left}
          <div className="absolute bottom-1.5 left-3 text-[8px] text-ink-muted">{pageL}</div>
        </div>
        <div className="flex-1 bg-white rounded-r shadow-db-sm relative min-h-[180px] p-3">
          {right}
          <div className="absolute bottom-1.5 right-3 text-[8px] text-ink-muted">{pageR}</div>
        </div>
      </div>
    </div>
  )
}

export function M32_BookPreview({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-32 · Book Production · Stage 9-2" screenClassName="bg-beige">
        <div className="bg-cream">
          <TopBar title="전체 미리보기" right={<span className="text-[18px]">⤓</span>} />
          <StepIndicator steps={["표지", "미리보기", "결제"]} current={1} />
        </div>

        {/* Spread 1 — 텍스트 */}
        <Spread
          caption="CHAPTER 03 · pp. 24-25"
          pageL={24}
          pageR={25}
          left={
            <>
              <div className="font-display text-[11px] font-bold text-ink leading-tight mb-1.5">
                처음 콩이를<br />느낀 날
              </div>
              <p className="font-serif text-[7.5px] leading-[1.6] text-ink-sub mb-1.5">
                그날은 비가 왔다. 회사에서 점심을 먹고 돌아오는 길에, 배 안쪽에서 작은 톡 — 누군가
                손가락 끝으로 살짝 두드린 것 같은 신호가 왔다.
              </p>
              <p className="font-serif text-[7.5px] leading-[1.6] text-ink-sub">
                처음엔 기분 탓인 줄 알았다. 그런데 다시, 또 한 번.
              </p>
            </>
          }
          right={
            <>
              <p className="font-serif text-[7.5px] leading-[1.6] text-ink-sub mb-2">
                그 자리에서 한참을 가만히 서 있었다. 비 내리는 소리보다 더 또렷한, 작은 발끝의 안부.
              </p>
              <div className="bg-cream rounded p-2 mt-2">
                <div className="font-hand text-[11px] text-coral leading-tight">
                  17주 3일<br />비 오는 화요일
                </div>
              </div>
            </>
          }
        />

        {/* Spread 2 — 영상 */}
        <Spread
          caption="CHAPTER 05 · pp. 42-43 · 영상"
          pageL={42}
          pageR={43}
          left={
            <>
              <div className="aspect-[4/3] rounded bg-gradient-to-br from-ink to-ink-sub flex items-center justify-center text-white text-[18px] relative mb-1.5">
                ▶
                <div className="absolute bottom-1 right-1 w-5 h-5 bg-white rounded-sm border border-ink flex items-center justify-center text-[7px] text-ink font-bold">
                  QR
                </div>
              </div>
              <div className="font-hand text-[10px] text-ink-sub text-center">
                28주 검진 — 콩이 손 흔들기
              </div>
            </>
          }
          right={
            <>
              <div className="font-display text-[11px] font-bold text-ink leading-tight mb-1.5">
                손 흔드는 아이
              </div>
              <p className="font-serif text-[7.5px] leading-[1.6] text-ink-sub mb-1.5">
                의사 선생님이 화면을 멈추고 말했다. "어머, 손을 흔드네요."
              </p>
              <p className="font-serif text-[7px] leading-[1.5] text-ink-muted italic mt-2">
                왼쪽 페이지 QR을 스캔하면 영상을 볼 수 있어요
              </p>
            </>
          }
        />

        {/* Spread 3 — 음성 */}
        <Spread
          caption="CHAPTER 09 · pp. 78-79 · 음성"
          pageL={78}
          pageR={79}
          left={
            <>
              <div className="font-display text-[11px] font-bold text-ink leading-tight mb-1.5">
                엄마의 자장가
              </div>
              <p className="font-serif text-[7.5px] leading-[1.6] text-ink-sub">
                그날 새벽, 콩이가 잠들지 않아서 아무 노래나 흥얼거렸다. 핸드폰에 작게 녹음해두었더니,
                지금은 그 목소리가 가장 그립다.
              </p>
            </>
          }
          right={
            <>
              <div className="aspect-[4/3] rounded bg-cream border border-dashed border-ink-muted flex flex-col items-center justify-center gap-1">
                <div className="w-9 h-9 bg-white border border-ink rounded-sm flex items-center justify-center text-[14px]">
                  ▦
                </div>
                <div className="text-[7px] text-ink-sub">▶ 음성 듣기</div>
              </div>
              <div className="font-hand text-[10px] text-ink-sub text-center mt-1">
                34주 · 0:42
              </div>
            </>
          }
        />

        {/* Summary */}
        <div className="px-4 pb-4 bg-cream pt-3">
          <FrameCard className="p-3.5">
            <div className="flex justify-between text-center">
              <div className="flex-1">
                <div className="font-display text-[18px] font-bold text-ink">128</div>
                <div className="text-[10px] text-ink-sub">페이지</div>
              </div>
              <div className="flex-1 border-l border-r border-beige">
                <div className="font-display text-[18px] font-bold text-ink">12</div>
                <div className="text-[10px] text-ink-sub">챕터</div>
              </div>
              <div className="flex-1">
                <div className="font-display text-[18px] font-bold text-ink">9</div>
                <div className="text-[10px] text-ink-sub">QR 코드</div>
              </div>
            </div>
          </FrameCard>
        </div>

        <BottomAction className="bg-cream">
          <PrimaryButton>결제로 →</PrimaryButton>
        </BottomAction>
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-33 · 결제
// ─────────────────────────────────────────────────────────────────────────────
export function M33_BookCheckout({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-33 · Book Production · Stage 9-3" screenClassName="bg-cream">
        <TopBar title="결제" />
        <StepIndicator steps={["표지", "미리보기", "결제"]} current={2} />

        {/* order summary */}
        <div className="px-5 pt-2">
          <FrameCard className="p-3.5">
            <div className="flex items-center gap-3.5">
              <div className="w-14 aspect-[3/4] rounded bg-gradient-to-br from-cream to-beige flex flex-col items-center justify-center text-center p-1.5 flex-shrink-0">
                <div className="font-display text-[8px] font-bold text-ink leading-tight">
                  Dear<br />Baby
                </div>
                <div className="text-[6px] text-ink-muted mt-1">2026</div>
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-bold text-ink">Dear Baby — 콩이에게</div>
                <div className="text-[11px] text-ink-sub mt-0.5">
                  하드커버 A5 · 크림지 · 128p · 12챕터
                </div>
                <div className="text-[12px] text-coral font-semibold mt-1">크림 클래식 표지</div>
              </div>
            </div>
          </FrameCard>
        </div>

        {/* quantity */}
        <div className="px-5 pt-3">
          <FrameCard className="flex items-center px-4 py-3.5">
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-ink">수량</div>
              <div className="text-[11px] text-ink-sub">가족 선물용은 +1권 추천</div>
            </div>
            <div className="flex items-center gap-3">
              <button className="w-7 h-7 rounded-full bg-cream text-ink flex items-center justify-center font-bold">
                −
              </button>
              <span className="text-[16px] font-bold w-6 text-center">1</span>
              <button className="w-7 h-7 rounded-full bg-coral text-white flex items-center justify-center font-bold">
                +
              </button>
            </div>
          </FrameCard>
        </div>

        {/* shipping */}
        <div className="px-5 pt-4">
          <div className="text-[11px] text-ink-muted uppercase tracking-wider pl-1 mb-2">
            배송지
          </div>
          <FrameCard className="p-3.5">
            <div className="flex justify-between items-start mb-1.5">
              <div className="text-[14px] font-bold text-ink">하늘맘 · 010-1234-5678</div>
              <Badge>기본</Badge>
            </div>
            <div className="text-[12px] text-ink-sub leading-[1.5]">
              서울특별시 마포구 와우산로 94<br />
              홍익빌딩 3층 305호 (04066)
            </div>
            <button className="text-[12px] text-coral font-semibold mt-2">변경</button>
          </FrameCard>
        </div>

        {/* payment method */}
        <div className="px-5 pt-3">
          <div className="text-[11px] text-ink-muted uppercase tracking-wider pl-1 mb-2">
            결제 수단
          </div>
          <FrameCard className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <input type="radio" defaultChecked className="w-4 h-4 accent-coral" />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-ink">신용·체크카드</div>
                <div className="text-[11px] text-ink-sub">신한카드 · 5021로 끝나는 카드</div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 border-t border-beige">
              <input type="radio" className="w-4 h-4 accent-coral" />
              <div className="text-[13px] font-semibold text-ink">카카오페이</div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 border-t border-beige">
              <input type="radio" className="w-4 h-4 accent-coral" />
              <div className="text-[13px] font-semibold text-ink">네이버페이</div>
            </div>
          </FrameCard>
        </div>

        {/* price summary */}
        <div className="px-5 pt-4 pb-4">
          <FrameCard className="p-3.5">
            <div className="flex justify-between text-[13px] py-1">
              <span className="text-ink-sub">상품 (1권)</span>
              <span className="text-ink">₩42,000</span>
            </div>
            <div className="flex justify-between text-[13px] py-1">
              <span className="text-ink-sub">배송비</span>
              <span className="text-ink">₩3,500</span>
            </div>
            <div className="flex justify-between text-[13px] py-1 text-coral">
              <span>첫 책 할인</span>
              <span className="font-semibold">−₩5,000</span>
            </div>
            <div className="flex justify-between pt-2.5 mt-1 border-t border-beige">
              <span className="text-[14px] font-bold text-ink">최종 결제</span>
              <span className="font-display text-[20px] font-bold text-coral">₩40,500</span>
            </div>
          </FrameCard>
        </div>

        <BottomAction>
          <PrimaryButton>₩40,500 결제하기</PrimaryButton>
          <div className="text-[11px] text-ink-sub text-center mt-2">
            결제 후 평균 7~10일 내 배송됩니다
          </div>
        </BottomAction>
      </PhoneFrame>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// M-34 · 제작·배송 추적
// ─────────────────────────────────────────────────────────────────────────────
export function M34_BookTracking({ onBack }: { onBack: () => void }) {
  const stages = [
    { label: "주문 접수", date: "9월 16일 (화) · 오후 2:14", state: "done", msg: "결제 확인 완료. 곧 인쇄에 들어갑니다." },
    { label: "인쇄", date: "9월 17일 (수) · 오전 10:32", state: "done", msg: "크림지 128페이지 인쇄 완료." },
    {
      label: "제본 중",
      date: "9월 18일 (목) · 오후 4:00 진행 중",
      state: "active",
      msg: "하드커버 합지·재단·표지 부착 중이에요. 평균 1~2일 소요됩니다.",
    },
    { label: "배송 출발", date: "예상: 9월 22일 (월)", state: "pending" },
    { label: "도착", date: "예상: 9월 25일 (목)", state: "pending" },
  ]

  return (
    <div className="flex flex-col items-center w-full">
      <BackToGallery onClick={onBack} />
      <PhoneFrame label="M-34 · Book Production · Stage 9-4" screenClassName="bg-cream">
        <TopBar title="제작 현황" right={<span className="text-[18px]">↗</span>} />

        {/* order header */}
        <div className="px-5 pt-2">
          <FrameCard className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-[14px] font-bold text-ink">Dear Baby — 콩이에게</div>
                <div className="text-[11px] text-ink-sub mt-0.5">하드커버 A5 · 1권</div>
              </div>
              <Badge>제작 중</Badge>
            </div>
            <div className="flex justify-between pt-3 border-t border-beige">
              <div>
                <div className="text-[10px] text-ink-muted">주문번호</div>
                <div className="text-[12px] font-semibold text-ink tabular-nums">DB-26090923</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-ink-muted">예상 도착</div>
                <div className="text-[12px] font-bold text-coral">9월 25일 (목)</div>
              </div>
            </div>
          </FrameCard>
        </div>

        {/* timeline */}
        <div className="px-7 pt-4">
          <div className="relative pl-8">
            <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-beige" />
            {stages.map((s, i) => (
              <div key={i} className="relative py-2.5">
                <div
                  className={
                    "absolute left-[-26px] top-3 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold border-2 " +
                    (s.state === "done"
                      ? "bg-sage border-sage text-white"
                      : s.state === "active"
                        ? "bg-coral border-coral text-white ring-4 ring-coral/20"
                        : "bg-cream border-beige text-ink-muted")
                  }
                >
                  {s.state === "done" ? "✓" : i + 1}
                </div>
                <div
                  className={
                    "text-[14px] font-bold mb-0.5 " +
                    (s.state === "active" ? "text-coral" : "text-ink")
                  }
                >
                  {s.label}
                </div>
                <div className="text-[11px] text-ink-muted">{s.date}</div>
                {s.msg && (
                  <div className="text-[12px] text-ink-sub mt-1.5 leading-[1.5]">{s.msg}</div>
                )}
                {s.state === "active" && (
                  <div className="mt-2 aspect-[5/3] rounded-db-sm bg-gradient-to-br from-beige to-gold/40 flex items-center justify-center text-[24px] text-white/60">
                    📚
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* helpful links */}
        <div className="px-5 pt-4 pb-4">
          <FrameCard className="overflow-hidden">
            <Row icon="📦" title="배송 조회" subtitle="제본 완료 후 운송장 전송" border={false} />
            <Row icon="💬" title="고객 지원" subtitle="제작·배송 문의" />
            <Row icon="🎁" iconBg="bg-coral text-white" title="한 권 더 주문하기" subtitle="가족·친구 선물용 추가" />
          </FrameCard>
        </div>

        <Tabbar active="book" />
      </PhoneFrame>
    </div>
  )
}
