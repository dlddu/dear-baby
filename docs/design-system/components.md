# Components — 컴포넌트

## Buttons

### Primary Button (CTA)

- 배경: `#D4836B` (Warm Coral)
- 텍스트: `#FFFFFF`, 15px, font-weight 600
- Border Radius: 12px
- Shadow: `0 4px 12px rgba(212,131,107,0.3)`
- 예시: `🎙 음성으로 기록`

### Secondary Button (보조 액션)

- 배경: `#FAF6F1` (Cream White)
- 테두리: `1px solid #F0E6D8`
- 텍스트: `#3D2E1E`, 15px, font-weight 600
- Border Radius: 12px
- 예시: `✏️ 텍스트로 작성`

### FAB (플로팅 액션 버튼)

- 크기: 56×56px
- 배경: `#D4836B`
- 텍스트: `#FFFFFF`, 24px, font-weight 300
- Border Radius: 9999px (완전 원형)
- Shadow: `0 4px 20px rgba(212,131,107,0.35)`
- 아이콘: `+`

## Cards

### 오늘의 질문 카드

```
┌─────────────────────────────────────────┐
│  오늘의 질문              [임신 17주 3일] │  ← 배지: Sage Green 배경
│                                         │
│  요즘 아기가 가장 활발하게 움직인          │  ← H3: 17px/600
│  순간은 언제였나요?                       │
│                                         │
│  아기의 작은 움직임도 소중한 추억이 돼요 ✨ │  ← Caption: 13px/400 Muted
└─────────────────────────────────────────┘
```

- 배경: `#FAF6F1`
- Border Radius: 16px
- 구조: 상단(라벨 + 배지) → 중단(질문 텍스트) → 하단(격려 텍스트)

### 기록 썸네일 카드

- 썸네일: 정사각형, Border Radius 16px
- 타이틀: 13px/600, `#3D2E1E`
- 날짜: 13px/400, `#B5A898`
- 가로 3개 그리드로 나열

## Navigation

### Bottom Tab Bar

- 탭 4개: 홈 / 기록 / 질문 / 마이
- 활성 탭: `#D4836B` (Warm Coral)
- 비활성 탭: `#B5A898` (Muted)
- FAB이 탭 바 위에 겹쳐 배치

## Badges & Tags

| 유형 | 배경 | 텍스트 | 예시 |
|------|------|--------|------|
| 임신 주차 | `#A8C5A0` | `#FFFFFF` | 임신 17주 3일 |
| 보조 액션 | `#F0E6D8` | `#8C7B6B` | 더보기 > |
| 카테고리 | `#D4836B` | `#FFFFFF` | 음성 기록 |

- Border Radius: 8px
- Font: 12px/600

## Onboarding Components (PRD-006 케이스 분기 온보딩)

`app/src/components/onboarding/` 의 공통 컴포넌트는 [와이어프레임 — 온보딩](../wireframes/onboarding.md) 에 정의된 화면 사양을 그대로 따른다.

| 컴포넌트 | 책임 | 비고 |
|---------|------|------|
| `<CaseAccentTheme case>` | 케이스(A/B/C) 액센트 팔레트 컨텍스트 제공 | `useCaseAccent()` 로 자식 컴포넌트가 수동 prop 전달 없이 접근 |
| `<CaseHeader step total label repeat?>` | 화면 상단 진행 바 + "Case X · n/N" + (선택) 반복 배지 | 모든 케이스 화면 최상단에 배치 |
| `<ProgressBar current total tone>` | 진행 바 단독. tone='neutral' 은 Q1/Q2 공통 진입 | radius-xs 트랙 + 케이스 컬러 fill |
| `<RepeatBadge current total>` | "반복 n/N" 알약. 반복 입력 화면 우상단 | 케이스 액센트 배경 + 텍스트 |
| `<StepIndicator active>` | Case B의 ① → ② 인디케이터 | active=1 (B0), active=2 (B3) |
| `<OptionCard selected onPress>` | 탭 가능한 선택 카드 | radius-md, 선택 시 케이스 액센트 보더 + 배경 |
| `<GenderToggle value onChange>` | 남아·여아·미정 3-pill | radius-full, 케이스 액센트 선택 강조 |
| `<DateField label value onChange pastOnly futureOnly>` | 라벨 + 탭 가능한 ISO 날짜 입력 | iOS 인라인 spinner / Android native modal |
| `<ChildInfoForm value onChange>` | 양육 아이 정보 입력 묶음 | 사진(선택)·이름·성별·생년월일·한줄 소개 |
| `<PhotoPicker onUploaded>` | 사진 픽커 + presigned PUT 업로드 | expo-image-picker + uploadPhoto helper |

케이스별 액센트 컬러는 `colors.caseAccent.{a,b,c}` 토큰을 사용한다 ([Colors](colors.md) 참고).

## Icon Style

아이콘은 **원형 배경 + 중앙 아이콘** 패턴을 사용합니다. 배경색으로 카테고리를 구분합니다.

| 카테고리 | 아이콘 배경색 | 아이콘 |
|----------|--------------|--------|
| 음성 기록 | `#F5C6A8` | 🎙 |
| 질문 알림 | `#FDDDD5` | ❤️ |
| 책 제작 | `#D8E8D4` | 📖 |
| AI 편집 | `#E0D4C4` | ✨ |

- 아이콘 컨테이너: 48×48px, 완전 원형
- 항상 원형 배경 위에 배치하여 일관성 유지
