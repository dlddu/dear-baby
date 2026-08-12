---
name: screen-with-mockup-and-design-system
description: 새 화면을 구현하거나 기존 화면을 수정할 때 반드시 실행. 사용자 여정의 특정 stage에 해당하는 화면을 React Native/Expo 코드로 만들기 전에 (1) docs/mockups/ 의 해당 mockup 화면을 먼저 확인하고, (2) docs/design-system/ 의 토큰·컴포넌트로만 구현하도록 강제한다. 화면, screen, page, route, 신규 UI flow, 온보딩 화면, 홈 화면, 음성 녹음 화면, 출산 전환 화면, 책 미리보기 화면 등 "사용자가 보는 한 페이지" 단위의 작업에 사용한다. design-system 스킬보다 더 구체적이며, design-system 과 함께 동시에 트리거된다.
---

# Screen Implementation — Mockup + Design System

dear-baby 의 화면을 코드로 구현할 때는 **반드시** 아래 절차를 따른다. mockup 을 보지 않고 화면을 구현하는 것은 금지한다 (시각·레이아웃·카피의 출처가 사라지기 때문).

## Mockup 위치

mockup 은 React + Tailwind 기반 단일 번들이다.

- **번들 (브라우저로 보기)**: `docs/index.html` — 갤러리에서 43개 화면 모두 클릭 가능 (GitHub Pages 진입점)
- **소스 (코드 참조)**: `docs/mockups/source/src/`
  - `components/PhoneFrame.tsx`, `components/Common.tsx` — 공통 프리미티브
  - `screens/Onboarding.tsx` — M-01 ~ M-16, M-35
  - `screens/HomePregnancyScreen.tsx` — M-17
  - `screens/DailyRecording.tsx` — M-18 ~ M-22
  - `screens/BirthConversion.tsx` — M-23, M-25, M-26
  - `screens/BirthDateScreen.tsx` — M-24 ★
  - `screens/AINarrative.tsx` — M-27 ~ M-30
  - `screens/BookProduction.tsx` — M-31 ~ M-34
  - `screens/Diary.tsx` — M-36 ~ M-42 (일기 탭 · 조회 + 사후 관리)
  - `screens/Community.tsx` — M-43 (커뮤니티 탭 메인)

## 절차

### Step 1 — Mockup 매칭 확인 (필수, 우회 금지)

1. `docs/mockups/README.md` 의 43개 페이지 일람표를 연다.
2. 지금 만들려는 화면이 어느 mockup(M-NN)에 해당하는지 식별한다.
3. 해당 mockup 의 React 소스를 **반드시 먼저 view 한다** — 위치는 mockups/README.md 의 "디자인 시스템 매핑" 섹션 참조. 추출할 정보:
   - 페이지 구조 (PhoneFrame > TopBar / 본문 / BottomAction / Tabbar 등)
   - 사용된 카피 (한 글자도 임의 변경 금지 — 변경이 필요하면 mockup 부터 갱신)
   - 사용된 공통 컴포넌트 (Common.tsx 의 `<Badge>`, `<Chip>`, `<FrameCard>` 등)
   - 색상·폰트의 의도 (예: 감정 봉우리 페이지의 그라디언트 배경)

### Step 2 — Design System 토큰 매핑

4. mockup 의 Tailwind 클래스를 RN 코드의 토큰·컴포넌트로 1:1 매핑한다:
   - `bg-coral`, `text-ink`, `rounded-db-md` 등 Tailwind 토큰 → `app/src/theme/` 의 토큰 상수
   - mockup 의 `<PrimaryButton>`, `<FrameCard>` 등 → `app/src/components/` 의 공통 컴포넌트
5. mockup 의 raw hex 색상은 dear-baby palette (Coral #D4836B, Peach #F5C6A8 등) 만 등장한다. 토큰에 없는 색상·간격·라디우스를 코드에서 인라인으로 사용하지 않는다 — 필요하면 토큰을 먼저 추가한다 (`design-system` 스킬 절차).

### Step 3 — 빠진 mockup 처리

해당 화면의 mockup 이 `docs/mockups/source/src/screens/` 에 없다면 **코드부터 작성하지 않는다.** 다음 순서를 지킨다:

1. 사용자에게 알린다: "이 화면의 mockup 이 없습니다. 먼저 mockup 을 만들고 싶은가요?"
2. 사용자가 동의하면 mockup 부터 만든다:
   - 적절한 그룹 파일 (예: `screens/Onboarding.tsx`) 에 새 컴포넌트 추가하거나, 분량이 크면 별도 파일 생성
   - `screens/GalleryScreen.tsx` 의 `groups` 와 `ScreenId` 타입에 추가
   - `App.tsx` 의 switch 에 추가
   - 재빌드: `cd docs/mockups/source && pnpm install && bash <bundle-script>` 후 `bundle.html` 을 `docs/mockups/index.html` 로 복사
3. mockup 이 만들어지면 `docs/mockups/README.md` 매핑 표 갱신, `docs/doc-tracker.md` 의 mockup 카운트 갱신
4. 그 다음에 RN 코드를 작성한다.

## ★ 감정 봉우리 화면 (M-24, M-29) 특별 주의사항

이 두 화면은 사용자 여정의 정서적 정점으로 설계되었다. 코드 구현 시 다음을 그대로 지킨다:

- 그라디언트 배경 (cream → peach → coral 단계)
- 손글씨 폰트 (`font-hand` / Nanum Pen Script) — 헤로 카피에만 사용
- 풀-블리드 레이아웃 (TopBar 의 transparent 모드)
- 카피의 정확한 줄바꿈 — 시각 디자인 의도

이 요소를 임의로 줄이거나 단순화하지 않는다. UX 변경은 mockup 부터 수정.

## 출력 시 동반 보고

화면 구현이 끝나면 PR 설명 또는 사용자 보고에 다음을 포함한다:
- 참조한 mockup ID (예: M-19)
- 참조한 Common 컴포넌트 (예: `<PhoneFrame>`, `<FrameCard>`, `<Chip>`)
- 참조한 design-system 항목 (예: components.md 의 `<Badge>`, tokens.md 의 spacing scale)
- 카피·시각이 mockup 과 다른 부분이 있다면 그 사유

## 함께 사용하는 스킬

- `design-system` — 토큰 사용 강제 (모든 UI 작업의 베이스)
- 본 스킬 — 화면 단위 작업의 시각 출처 강제

UI 작업이 컴포넌트 단위(예: 버튼 하나 추가)면 design-system 만 트리거되고, 화면 단위면 두 스킬이 함께 트리거된다.
