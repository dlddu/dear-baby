---
doc_id: TRACKER-001
doc_type: tracker
product: dear_baby
created: 2026-05-02
updated: 2026-07-09
---

# 디어베이비 문서 체계 상태 추적

## 현재 상태 요약 (2026-07-09 기준)

- 정의된 가치: **7개** (V-001 ~ V-007)
- 가치 문서: **1개** (VDOC-001)
- PRD: **8개** (PRD-001 ~ PRD-008)
- Acceptance Criteria: **55개** (모두 가치 연결됨)
- 테스트 문서: **8개** (TEST-001 ~ TEST-008), 모든 PRD 커버됨
- 사용자 여정: **6개** (Onboarding · Daily Recording · Birth Conversion · AI Narrative · Book Production · Diary Browsing)
- 흐름도: **1개** (onboarding-flow.md)
- Mockup: **39개 화면** (M-01 ~ M-39, 일부 결번) + 갤러리, 단일 React 번들 `mockups/index.html`. 모든 사용자 여정 stage 1:1 매핑
- 엔지니어링 노트: **4개** (ENG-001 임신 주차 계산 · ENG-002 주간 질문(deferred) · ENG-003 클라이언트 로그인 · client-logout-process)
- 용어집: **1개** (GLOSSARY-001)
- e2e flow (Maestro): AC 매핑 다수 + 엔지니어링 노트 매핑 1개(`login.yaml`→ENG-003) + 스모크 예외 1개(`health.yaml`)
- **건강 상태**: ✅ 건강함 (인증을 엔지니어링 노트로 관리하기로 결정 — `login.yaml` 고아 e2e 를 ENG-003 매핑으로 해소, `health.yaml` 은 스모크 예외로 분류. PRD/AC 계층은 변동 없음: PRD 8 · AC 55 · TEST 8)

## 연결 매트릭스

| 가치 | 가치 유형 | 연결된 PRD | 상태 |
|------|-----------|-----------|------|
| V-001 감정 보존 | abstract | PRD-001, PRD-003, PRD-004, PRD-005, PRD-006, PRD-007, PRD-008 | ✅ |
| V-002 기록의 부담 제거 | abstract | PRD-001, PRD-002, PRD-005, PRD-006, PRD-007, PRD-008 | ✅ |
| V-003 서사적 의미 부여 | abstract | PRD-003, PRD-004, PRD-007, PRD-008 | ✅ |
| V-004 음성-텍스트 자동 변환 | concrete | PRD-001 | ✅ |
| V-005 임신 주차별 맞춤 질문 | concrete | PRD-002, PRD-006, PRD-007 | ✅ |
| V-006 실물 책 완성품 | concrete | PRD-004, PRD-006, PRD-007 | ✅ |
| V-007 멀티미디어 감정 표현 | concrete | PRD-005, PRD-006, PRD-008 | ✅ |

## PRD ↔ 테스트 커버리지

| PRD | AC 수 | 테스트 | 커버 상태 |
|-----|------|--------|----------|
| PRD-001 음성 일기 기록 | 5 | TEST-001 | ✅ |
| PRD-002 매일 다른 질문 알림 | (기존) | TEST-002 | ✅ |
| PRD-003 AI 편집 & 서사 구성 | (기존) | TEST-003 | ✅ |
| PRD-004 실물 책 제작 | (기존) | TEST-004 | ✅ |
| PRD-005 기록 미디어 통합 | (기존) | TEST-005 | ✅ |
| PRD-006 케이스 분기 온보딩 및 아이 컨텍스트 관리 | 10 | TEST-006 (19 TC) | ✅ |
| PRD-007 홈 화면 구성 | 10 | TEST-007 (17 TC) | ✅ |
| PRD-008 일기 탭 — 내 기록 조회 및 관리 | 10 | TEST-008 (22 TC) | ✅ |

## e2e flow 매핑

e2e flow(`e2e/maestro/*.yaml`)는 다음 중 하나에 매핑되어야 하며, 셋 다 아니면 고아로 간주한다.

1. **제품 AC** — 사용자에게 제공하는 가치를 검증하는 flow (대부분)
2. **엔지니어링 노트** — 제품 가치가 아니라 엔지니어링 계약/동작을 검증하는 flow
3. **예외(스모크·인프라)** — 제품도 엔지니어링 동작도 아닌 배포 게이트. 아래 표에 등재

> 인증은 사용자에게 보이는 제품 기능이 아니라 기록 귀속·세션 유지를 떠받치는 기반이라, PRD/AC 가 아니라 엔지니어링 노트(ENG-003)로 관리한다. 따라서 인증 flow 는 (1)이 아니라 (2)로 매핑된다. AC 가 없으므로 대응하는 TEST 문서도 두지 않는다(엔지니어링 노트 ENG-001·002 와 동일 방침).

| flow | 매핑 유형 | 대상 | 비고 |
|------|-----------|------|------|
| `login.yaml` | 엔지니어링 노트 | ENG-003 (`engineering/client-login-process.md`) | 테스터 로그인 게이트 + 세션 수립 후 온보딩 분기(§3.3·§4·§9). OAuth 경로는 외부 계정 의존으로 수동 QA |
| `subflows/tester-login.yaml` | (헬퍼) | — | 다른 flow 가 재사용하는 로그인 서브플로우. 독립 검증 단위가 아님 |
| `health.yaml` | 예외(스모크) | — | 앱 부팅 + 백엔드 도달 스모크. 랜딩 헬스체크 토스트 UI 의 승격 여부는 ENG-003 향후 검토 |

**등재 규칙**: (1) flow 헤더에 `검증 대상:` 주석과 근거를 남기고, (2) 본 표에 등재한다. `subflows/*.yaml` 은 테스트가 아니라 재사용 헬퍼이므로 매핑 대상이 아니다.

## 위험 진단

### 고아 가치 (소유자 없는 가치)
- VDOC-001 에 명시된 제품 소유자 항목이 없다 → ⚠️ 향후 명시 권장
- 그 외 가치 자체는 모두 정의됨

### 미정렬 문서 (가치 참조 없는 문서)
- (없음)

### 무가치 PRD (가치를 달성하지 않는 PRD)
- (없음)

### AC 없는 PRD
- (없음)

### 미연결 AC (가치와 연결되지 않은 AC)
- (없음)

### 미검증 AC (테스트 없는 AC)
- PRD-006 의 모든 AC(10개)는 TEST-006 의 19개 TC 로 커버됨
- PRD-007 의 모든 AC(10개)는 TEST-007 의 17개 TC 로 커버됨
- PRD-008 의 모든 AC(10개)는 TEST-008 의 22개 TC 로 커버됨
- 기존 PRD-001~005 의 AC는 기존 TEST-001~005 로 커버됨

### 고아 테스트 (AC·엔지니어링 노트 어디에도 매핑되지 않은 테스트)
- 문서 테스트(TEST-001~008): (없음)
- e2e flow: (없음) — 매핑 현황은 위 "e2e flow 매핑" 섹션 참조. `login.yaml`→ENG-003, `health.yaml`→스모크 예외

## 변경 이력

| 시점 | 변경 내용 | 이전 상태 | 이후 상태 |
|------|-----------|-----------|-----------|
| 2026-04-04 | 초기 가치/PRD-001~005/TEST-001~005 정의 | — | 가치 7, PRD 5, TEST 5 |
| 2026-04-15 | 용어집(GLOSSARY-001) 추가 | — | 용어집 1 |
| 2026-05-02 | PRD-006 (케이스 분기 온보딩 + 출산 전환 + 다자녀) 추가 | PRD 5, AC 25 (대략) | PRD 6, AC 35 |
| 2026-05-02 | TEST-006 추가 (19 TC) | TEST 5 | TEST 6 |
| 2026-05-02 | docs/README.md 의 PRD/테스트 목록 갱신 | — | — |
| 2026-05-06 | 페이지 단위 mockup HTML 35개 신설 (`mockups/`) — 5개 사용자 여정 stage 와 1:1 매핑, 디자인 시스템 토큰 1:1 적용 | mockup 0 | mockup 35 |
| 2026-05-06 | mockup 을 React + Vite + Tailwind + shadcn/ui 기반 단일 번들로 재작성. 정적 HTML 버전 폐기. 소스는 `mockups/source/`, 번들은 `mockups/index.html`. Tailwind config 에 dear-baby 디자인 토큰을 1:1 매핑하여 코드와 디자인 시스템 사이 정합성 강화. | 정적 HTML 35 | React 번들 35 |
| 2026-05-11 | PRD-007 (홈 화면 구성) 추가 — 헤더·오늘의 질문 카드·타인 기록 피드·하단 네비게이션의 화면 구성과 상호작용을 통합 정의. PRD-001/002/004/006과 연결. AC 10개 | PRD 6, AC 35 | PRD 7, AC 45 |
| 2026-05-11 | TEST-007 추가 (17 TC) — PRD-007의 모든 AC 커버 | TEST 6 | TEST 7 |
| 2026-05-12 | **홈 화면 정합성 검증 → 🔴 위험 3건 발견 → 해소**: ① PRD-007 ↔ M-17/M-18/M-26 시각화 완전 불일치 (PRD 핵심 요소 5종이 mockup에 부재) — mockup 3개를 PRD-007 명세대로 재디자인 ② Tabbar 4탭→5탭 (자서전·커뮤니티·홈·일기·설정) 갱신 (AC-007-10 준수) ③ daily-recording-journey "관련 PRD"에 PRD-007 누락 → 추가. `mockups/index.html` 재빌드. | 🔴 위험 3건 | ✅ 해소 |
| 2026-05-12 | **재검증으로 frontend 사슬 위험 3건 추가 발견 → 해소**: ① 🟡 B2-Purpose (AC-006-03) 시각화 누락 — M-35 mockup 신규 추가 (Onboarding.tsx, App.tsx, GalleryScreen.tsx, mockup README 갱신) + `mockups/index.html` 재빌드 완료 (parcel + html-inline, 348K) ② 🟢 `journeys/README.md` 의 "관련 PRD" 표·"PRD-001~006" 범위 표현이 PRD-007 추가를 반영 안 함 → 표/문구 갱신 ③ ⚪ `.claude/skills/design-system` 폴더 이름이 표준 `ui-with-design-system` 과 불일치 → 폴더+frontmatter `name:` 표준화, 내용(dear-baby 커스터마이즈) 보존 | mockup 35, 🟡 위험 1건 | mockup 36 ✅ 소스+번들 동기화 |
| 2026-05-14 | **일기 탭 명세 공백 해소 — PRD-008·TEST-008·Diary Browsing Journey·M-36~M-39 추가**: ① PRD-008 (일기 탭 — 내 기록 조회 및 관리) 신규 작성, AC 10개. PRD-001 AC-001-05 (기록 목록 조회)의 상위 명세로 흡수·확장. V-001·V-002·V-003·V-007 달성. ② TEST-008 (22 TC) 신규 작성, PRD-008 모든 AC 커버. ③ `journeys/diary-browse-journey.md` 신규 작성 — Daily Recording의 곁가지 비주기 루프로 정의, 4 stage(진입·스크롤·상세·사후관리). 모든 페르소나 대상, Case B 강조. ④ mockup 4개 신규 추가: M-36(단일 아이 통합)·M-37(다자녀 통합 콩이+하준 + 필터)·M-38(상세 + ⋯ 액션 시트)·M-39(빈 상태). `screens/Diary.tsx` 신설, `App.tsx`·`GalleryScreen.tsx` 등록. ⑤ `mockups/README.md` 카운트 36→39, 일람표/가치 매핑 갱신. ⑥ `journeys/README.md` 5→6개 플로우 갱신. ⑦ `.claude/skills/screen-with-mockup-and-design-system/SKILL.md` 35→39, Diary.tsx 추가. ⑧ `mockups/index.html` 번들 재빌드 완료 (parcel + html-inline, 373K). | PRD 7, AC 45, TEST 7, journey 5, mockup 36 | PRD 8, AC 55, TEST 8 (22 TC), journey 6, mockup 39 ✅ 소스+번들 동기화 |
| 2026-05-14 | **일기 탭 핵심 설계 결정 변경 — 아이별 분리 제거, 통합 표시로 재설계**: 사용자 의도에 따라 "일기 탭은 아이별로 나누지 않는다"로 핵심 결정 변경. ① PRD-008 전면 재작성 — AC-008-01(통합 표시) · AC-008-02(월 단위 그룹) · AC-008-03(카드 우상단 아이 컨텍스트 칩) · AC-008-08(다자녀 한정 아이 필터) · AC-008-09(아이 이름 미특정 카피) · AC-008-10(일기 탭 전용 헤더 — "일기" 타이틀만, 좌우 화살표·아이 이름 없음). ② TEST-008 22 TC 재구성 — 통합 표시 검증 TC 추가 (TC-008-01-A·B·C, TC-008-03-B, TC-008-08-A·B). ③ `diary-browse-journey.md` 통합 표시를 핵심 설계 결정으로 명시, 다자녀 공평성 점검 도구 측면 강조. ④ mockup 재작성 — M-36 단일 아이 통합(헤더 화살표 제거 + 카드 칩), M-37 콩이+하준 다자녀 통합(11월 그룹에 두 아이 섞임), M-38 상세 상단 메타 아이 칩, M-39 일반화 카피. `Diary.tsx` 컴포넌트명 변경 (M36_DiaryListPregnancy→M36_DiaryListSingle, M37_DiaryListParentMulti→M37_DiaryListMulti) + App.tsx·GalleryScreen.tsx 동기화. ⑤ **PRD-006 AC-006-09 갱신** — "일기 탭도 활성 아이 기준" 항목 삭제하고 "활성 아이 컨텍스트와 무관하게 통합 표시" 명시 (PRD-008이 PRD-006의 해당 부분을 갱신함을 명문화). ⑥ 번들 재빌드. | 아이별 분리 (활성 아이 기준 필터) | 통합 표시 (모든 아이 시간 축 하나) ✅ |
| 2026-07-09 | **인증을 엔지니어링 노트로 관리하기로 결정 — `login.yaml` 고아 e2e 해소**: e2e flow ↔ AC 매핑 점검에서 `login.yaml` 이 어떤 AC 도 참조하지 않는 고아 테스트로 확인됨(당시 PRD 8개 어디에도 로그인·인증 명세 없음). 초안에서 PRD-009/TEST-009 를 신설했으나, 인증은 사용자 제공 가치가 아니라 기반 계층이고 이미 `engineering/client-login-process.md` 에 상세 리포트가 있으므로 **PRD/AC 가 아닌 엔지니어링 노트로 관리하기로 방향 변경**. ① 로그인 리포트에 frontmatter 부여(ENG-003, doc_type: engineering-note) + `verified_by` 에 login.yaml/tester-login 명시. ② `login.yaml` 헤더를 ENG-003 매핑으로 갱신(제품 AC 아님). ③ `health.yaml` 은 스모크 예외로 분류. ④ doc-tracker 에 "e2e flow 매핑" 섹션 신설 — e2e 는 AC/엔지니어링 노트/예외 중 하나에 매핑되어야 한다는 규칙과 현황표. ⑤ PRD-009/TEST-009 는 두지 않음(엔지니어링 노트는 TEST 문서를 갖지 않는 ENG-001·002 방침과 동일). **PRD/AC/TEST 계층 카운트 변동 없음**: PRD 8 · AC 55 · TEST 8. | 고아 e2e flow 2건(login·health) | 고아 e2e flow 0건 — login→ENG-003, health→스모크 예외 ✅ |

## 향후 검토 항목

### PRD-006에서 도출됨

- 임신 X · 양육 X 케이스의 정식 정의
- 사산/유산 케이스의 출산 전환 분기 처리
- 아이 전환 탭의 정렬 규칙
- 설정 탭의 "아이 추가" 진입점 위치 (AC-006-10 후속)

### PRD-007에서 도출됨

- 오늘의 질문 풀 구체 구성과 회전 알고리즘 (PRD-002와 통합 검토)
- 회전 한도(3개)·자정 초기화의 사용자 안내 카피
- 책 진행도 임계값 50의 실데이터 기반 재산정
- 책 진행도 `(?)` 안내 모달의 사용자 친화적 카피
- 타인 기록 피드 답변 노출 글자 수 디자인 단계 확정
- 타인 기록 피드 정렬 알고리즘 (하트 수 외 최신·조회수 도입 여부, 노출 다양성)
- 타인 기록 피드 노출 풀 범위 (유사 주차 우선 등)
- 커뮤니티 가치(공감을 통한 동기부여)의 가치 문서 추가 여부 — 현재 V-002에 매핑되어 있음

### PRD-008에서 도출됨

- 텍스트 검색 (AC-008-08 필터와 통합 vs 별도 화면)
- 휴지통/N일 복구 (AC-008-06 영구 삭제의 안전장치)
- 다중 선택 삭제 (대량 정리 동선)
- 편집 이력 추적 (사후 편집이 잦은 사용자 보호)
- AC-008-08 필터 유지 정책 사용자 테스트 검증
- AC-008-03 답변 미리보기 글자 수·AC-008-02 페이지 크기 디자인 단계 확정
- 캘린더/타임라인 뷰 도입 여부
- 출산 전환 그룹 헤더 시각 구분 강도
- PRD-001 AC-001-05 (기록 목록 조회)의 처리 — PRD-008이 흡수했으나 PRD-001 본문 자체는 그대로 둠. 향후 PRD-001 리비전 시 AC-001-05를 deprecated 마킹할지 결정
