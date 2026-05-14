# 디어베이비 제품 문서

## 문서 체계

디어베이비 제품 문서는 가치 중심의 계층 구조로 관리된다.

```
제품 가치 (Values)
  └── 가치 문서 (Value Document)
        └── PRD 문서 (PRD Documents)
              └── 인수 조건 (Acceptance Criteria)
                    └── 테스트 문서 (Test Documents)
```

### 핵심 원칙

1. **가치 정렬**: 모든 문서는 제품 가치에 정렬되어야 한다
2. **추적 가능성**: 각 계층은 상위 계층을 명시적으로 참조한다
3. **인수 조건 단위**: PRD는 인수 조건(AC)으로 구성되며, 각 AC는 달성하는 가치를 명시한다
4. **테스트 커버리지**: 모든 인수 조건은 최소 1개의 테스트로 검증되어야 한다

## ID 체계

| 항목 | 패턴 | 예시 |
|---|---|---|
| 제품 | `dear_baby` | - |
| 가치 | `V-NNN` | `V-001` |
| 가치 문서 | `VDOC-NNN` | `VDOC-001` |
| PRD 문서 | `PRD-NNN` | `PRD-001` |
| 인수 조건 | `AC-PRD번호-NN` | `AC-001-01` |
| 테스트 | `TEST-NNN` | `TEST-001` |
| 용어집 | `GLOSSARY-NNN` | `GLOSSARY-001` |

## 문서 목록

### 가치 문서
- [제품 가치 정의서](values/product-values.md) (VDOC-001)

### PRD 문서
- [PRD-001: 음성 일기 기록](prd/PRD-001-voice-diary.md)
- [PRD-002: 매일 다른 질문 알림](prd/PRD-002-daily-questions.md)
- [PRD-003: AI 편집 & 서사 구성](prd/PRD-003-ai-editing.md)
- [PRD-004: 실물 책 제작](prd/PRD-004-book-production.md)
- [PRD-005: 기록 미디어 통합](prd/PRD-005-media-records.md)
- [PRD-006: 케이스 분기 온보딩 및 아이 컨텍스트 관리](prd/PRD-006-onboarding-cases.md)
- [PRD-007: 홈 화면 구성](prd/PRD-007-home-screen.md)
- [PRD-008: 일기 탭 — 내 기록 조회 및 관리](prd/PRD-008-diary-tab.md)

### 플로우
- [Onboarding Flow — 케이스 분기 온보딩 전체 흐름도](flows/onboarding-flow.md)

### 사용자 여정
- [User Journeys — 사용자 여정 인덱스](journeys/README.md)
- [Onboarding Journey — 발견 · 가입 · 케이스 분기 · 케이스별 입력](journeys/onboarding-journey.md)
- [Daily Recording Journey — 홈 첫 진입 · 일상 기록 루틴](journeys/daily-recording-journey.md)
- [Birth Conversion Journey — 출산 전환 (Case A · B)](journeys/birth-conversion-journey.md)
- [AI Narrative Journey — AI 서사 생성·편집](journeys/ai-narrative-journey.md)
- [Book Production Journey — 책 주문 · 배송 · 선물](journeys/book-production-journey.md)
- [Diary Browsing Journey — 일기 탭 · 누적 기록 재방문 · 사후 관리](journeys/diary-browse-journey.md)

### Mockups (페이지 단위 시각 산출물)
- [Mockups Index — 매핑 인덱스 + 재빌드 방법](mockups/README.md)
- [Mockups (브라우저로 열기) — 39개 화면 단일 React 번들](mockups/index.html)
- [Mockups Source — React + Tailwind 소스 (재현 가능)](mockups/source/)

### 테스트 문서
- [TEST-001: 음성 일기 기록 테스트](tests/TEST-001-voice-diary.md)
- [TEST-002: 매일 다른 질문 알림 테스트](tests/TEST-002-daily-questions.md)
- [TEST-003: AI 편집 & 서사 구성 테스트](tests/TEST-003-ai-editing.md)
- [TEST-004: 실물 책 제작 테스트](tests/TEST-004-book-production.md)
- [TEST-005: 기록 미디어 통합 테스트](tests/TEST-005-media-records.md)
- [TEST-006: 케이스 분기 온보딩 및 아이 컨텍스트 관리 테스트](tests/TEST-006-onboarding-cases.md)
- [TEST-007: 홈 화면 구성 테스트](tests/TEST-007-home-screen.md)
- [TEST-008: 일기 탭 — 내 기록 조회 및 관리 테스트](tests/TEST-008-diary-tab.md)

### 용어집
- [용어집 — 코드/문서 용어 사전](glossary.md) (GLOSSARY-001)

### 디자인 시스템
- [디자인 시스템 개요](design-system/README.md)
- [Colors — 컬러 팔레트](design-system/colors.md)
- [Typography — 타이포그래피](design-system/typography.md)
- [Components — 컴포넌트](design-system/components.md)
- [Patterns — UI/UX 패턴](design-system/patterns.md)
- [Tokens — 디자인 토큰](design-system/tokens.md)
