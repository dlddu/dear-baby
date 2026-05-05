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

## 케이스 분기 온보딩 컴포넌트 (PRD-006)

`docs/wireframes/onboarding.md` 의 화면 사양을 코드로 옮기기 위한 케이스 분기 온보딩 전용 컴포넌트군. 모두 `app/src/components/onboarding/` 에 위치하며, 케이스 액센트 토큰(colors.caseAccent.a|b|c)을 자동으로 적용한다.

| 컴포넌트 | 역할 |
|---|---|
| `<OnboardingScreen>` | 화면 골격(상단 ProgressBar/RepeatBadge + 본문 + 하단 CTA). 모든 온보딩 화면이 이 골격을 채운다. |
| `<CaseAccentProvider>` / `useCaseAccent()` | 케이스(A/B/C) 액센트 컬러를 자식에게 주입. Q1·Q2(케이스 결정 전)는 그레이로 폴백. |
| `<ProgressBar>` | 와이어프레임 상단 진행률 바 + "Case X · n/N" 텍스트. |
| `<RepeatBadge>` | 우상단 "반복 n/N" 배지. B2·B5·C2 반복 입력 화면 전용. |
| `<StepIndicator>` | Case B 의 ① → ② 두-단계 인디케이터. B0/B3 안내 화면 전용. |
| `<SelectCard>` | 옵션 단일/복수 선택 카드. A1, B1, C1, A3, B6, C3 등에서 사용. |
| `<Checkbox>` | 다중 선택 옵션 좌측 체크박스. SelectCard 의 `leading` 으로 결합. |
| `<GenderPicker>` | 성별 선택 pill (남아·여아·미정). |
| `<TextField>` | 단일/멀티라인 텍스트 입력 (이름·태명·임신주차·한줄 소개). |
| `<DateField>` | iOS spinner / Android modal 데이트픽커. 예정일·생년월일. |
| `<PhotoPicker>` | 양육 아이 사진 입력. expo-image-picker → 로컬 URI → S3 업로드 → photo_tmp_key. (선택). |

원칙:

- 화면 사양(문구·순서·필드 구성)은 `wireframes/onboarding.md` 가 정답이다. 컴포넌트는 그 사양을 시각화하는 도구일 뿐이다.
- 색은 `colors.caseAccent.a|b|c` 만 사용한다. 임의로 hex 박지 않는다.
- 라운드는 카드 `radius.md`, 칩/버튼 `radius.full`, 옵션 카드 `radius.sm` 으로 통일.
- 그림자는 사용하지 않는다(와이어프레임 톤 유지). FAB·플로팅 요소가 아닌 한 그림자 없이 1px 테두리로 구분한다.

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
