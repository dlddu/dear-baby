---
doc_id: TRACKER-001
doc_type: tracker
product: dear_baby
created: 2026-05-02
updated: 2026-08-15
---

# 디어베이비 문서 체계 상태 추적

## 현재 상태 요약 (2026-08-15 기준)

- 정의된 가치: **8개** (V-001 ~ V-008)
- 가치 문서: **1개** (VDOC-001)
- PRD: **9개** (PRD-001 ~ PRD-009, **전부 확정** — PRD-009는 2026-08-05 확정)
- Acceptance Criteria: **70개 전부 확정** (검증 대상 69 + 1차 제외 1) — 2026-08-08: AC-002-05(단계 산출 불가 폴백) 신설 — 2026-08-05: PRD-001 +2 신설, PRD-007 -2 이관, PRD-009 13개 확정 + AC-009-14 신설(홈 피드 이관 수용) + AC-009-12(알림)는 1차 런치 제외로 확정
- 테스트 문서: **9개** (TEST-001 ~ TEST-009) — 전 PRD 커버 (TEST-009는 18 TC, 2026-08-05 신설 / TEST-002는 2026-08-08 단계 분기 개정으로 4→11 TC)
- 사용자 여정: **6개** (Onboarding · Daily Recording · Birth Conversion · AI Narrative · Book Production · Diary Browsing)
- 흐름도: **1개** (onboarding-flow.md)
- Mockup: **43개 화면** (M-01 ~ M-43, 일부 결번) + 갤러리, 단일 React 번들 `docs/index.html` (GitHub Pages 진입점). M-01~M-42 는 6개 사용자 여정의 갤러리 그룹에 전수 매핑(떠 있는 카드 0장) / **M-43(커뮤니티 메인)은 여정 문서 부재로 PRD-009 AC 직접 매핑** — 단계 수준 매핑·미시각화 5건·구 번호 라벨 34건은 [여정 ↔ 목업 매핑 레지스트리](journey-mockup-map.md) 참조
- 엔지니어링 노트: **13개** — ENG-001 **단계 산출**(임신 주차+생후 나이, 2026-08-08 확장) · ENG-002 **단계별 질문**(deferred) · ENG-003 로그인 · ENG-004 AI preview scopes · ENG-005 오디오 저장 · ENG-006 로그아웃 (004~006은 2026-08-05 기존 문서 ID 부여) · ENG-007 피드 기본 정렬(draft) · ENG-008 노출 풀(draft) · ENG-009 페이지네이션(draft) · ENG-010 본인 기록 노출(draft) · ENG-011 유사 시기 추천(**확정**) · ENG-012 삭제 delete marker(**확정**) · ENG-013 단계 스냅샷 저장·재계산(**확정**, 2026-08-08 신설)
- 용어집: **1개** (GLOSSARY-001)
- e2e flow (Maestro): AC↔flow 1:1 매핑 확정 — 제품 flow 22개(각 AC 1개 단독, `home-feed.yaml`은 AC-009-14로 재매핑 완료) + 후속 flow 46건(미작성 — PRD-009 확정 AC 12건 신규 편입). **영구 예외 AC 0건** — 자동화 곤란은 AC가 아니라 외부 호출 모킹 경계 6개(2 구현·4 신설)로 등재(경계만 결정적 치환, 나머지 구간은 실 e2e). + 엔지니어링 노트 1개(`login.yaml`→ENG-003) + 스모크 예외 1개(`health.yaml`). 상세는 "e2e flow 매핑" 섹션 참조
- **건강 상태**: ✅ 건강 — **PRD-009 확정 완료 (2026-08-05)**. 편입 당시 미확정 13건을 전수 결정(결정 원장: claude-docs `20260805-dear-baby-prd-009-decisions`)해 draft 해제. 노출 로직(정렬·노출 풀·페이지네이션·본인 기록)은 의도적으로 AC 밖 ENG-007~010 초안으로 분리(확정 시 재개발), 유사 시기(ENG-011)·delete marker(ENG-012)는 확정. 잔여: 커뮤니티 여정·mockup 미작성(아래 향후 검토), e2e 신규 ⬜ 14건은 backlog 순차 소화

## 연결 매트릭스

| 가치 | 가치 유형 | 연결된 PRD | 상태 |
|------|-----------|-----------|------|
| V-001 감정 보존 | abstract | PRD-001, PRD-003, PRD-004, PRD-005, PRD-006, PRD-007, PRD-008 | ✅ |
| V-002 기록의 부담 제거 | abstract | PRD-001, PRD-002, PRD-005, PRD-006, PRD-007, PRD-008, PRD-009 | ✅ |
| V-003 서사적 의미 부여 | abstract | PRD-003, PRD-004, PRD-007, PRD-008 | ✅ |
| V-004 음성-텍스트 자동 변환 | concrete | PRD-001 | ✅ |
| V-005 아이 단계별 맞춤 질문 | concrete | PRD-002, PRD-006, PRD-007, PRD-009 | ✅ |
| V-006 실물 책 완성품 | concrete | PRD-004, PRD-006, PRD-007 | ✅ |
| V-007 멀티미디어 감정 표현 | concrete | PRD-005, PRD-006, PRD-008 | ✅ |
| V-008 공감을 통한 연결 | abstract | PRD-001, PRD-009 | ✅ |

## PRD ↔ 테스트 커버리지

| PRD | AC 수 | 테스트 | 커버 상태 |
|-----|------|--------|----------|
| PRD-001 음성 일기 기록 | 7 | TEST-001 (7 TC) | ✅ |
| PRD-002 매일 다른 질문 알림 | 5 | TEST-002 (11 TC) | ✅ — 2026-08-08 단계 일반화 개정, AC-002-05 신설 |
| PRD-003 AI 편집 & 서사 구성 | (기존) | TEST-003 | ✅ |
| PRD-004 실물 책 제작 | (기존) | TEST-004 | ✅ |
| PRD-005 기록 미디어 통합 | (기존) | TEST-005 | ✅ |
| PRD-006 케이스 분기 온보딩 및 아이 컨텍스트 관리 | 10 | TEST-006 (19 TC) | ✅ |
| PRD-007 홈 화면 구성 | 8 | TEST-007 (14 TC) | ✅ — TC-007-08·09-A/B 3건은 TEST-009로 이관 완료 (2026-08-05) |
| PRD-008 일기 탭 — 내 기록 조회 및 관리 | 10 | TEST-008 (22 TC) | ✅ |
| PRD-009 커뮤니티 탭 | 14 (검증 대상 13 + 1차 제외 1) | TEST-009 (18 TC) | ✅ — AC-009-12는 1차 제외로 TC 없음 |

## e2e flow 매핑

e2e flow(`e2e/maestro/*.yaml`)는 다음 중 하나에 매핑되어야 하며, 셋 다 아니면 고아로 간주한다.

1. **제품 AC** — 사용자에게 제공하는 가치를 검증하는 flow (대부분)
2. **엔지니어링 노트** — 제품 가치가 아니라 엔지니어링 계약/동작을 검증하는 flow
3. **예외(스모크·인프라)** — 제품도 엔지니어링 동작도 아닌 배포 게이트. 아래 표에 등재

> 인증은 사용자에게 보이는 제품 기능이 아니라 기록 귀속·세션 유지를 떠받치는 기반이라, PRD/AC 가 아니라 엔지니어링 노트(ENG-003)로 관리한다. 따라서 인증 flow 는 (1)이 아니라 (2)로 매핑된다. AC 가 없으므로 대응하는 TEST 문서도 두지 않는다(엔지니어링 노트 ENG-001·002 와 동일 방침).

| flow | 매핑 유형 | 대상 | 비고 |
|------|-----------|------|------|
| `login.yaml` | 엔지니어링 노트 | ENG-003 (`engineering/ENG-003-client-login-process.md`) | 테스터 로그인 게이트 + 세션 수립 후 온보딩 분기(§3.3·§4·§9). **실제 15탭 제스처를 구동하는 유일한 flow.** OAuth 경로는 외부 계정 의존으로 수동 QA |
| `subflows/tester-login.yaml` | (헬퍼) | — | 실제 제스처 서브플로우. `login.yaml` 전용. 독립 검증 단위가 아님 |
| `subflows/tester-login-fast.yaml` | (헬퍼) | — | 로그인을 준비 단계로만 쓰는 나머지 flow **전부**가 쓰는 단축 진입점(E2E 빌드 한정). 독립 검증 단위가 아님 |
| `subflows/tester-login-credentials.yaml` | (헬퍼) | — | 위 두 진입점이 공유하는 자격 증명 입력·제출 구간. 독립 검증 단위가 아님 |
| `health.yaml` | 예외(스모크) | — | 앱 부팅 + 백엔드 도달 스모크. 랜딩 헬스체크 토스트 UI 의 승격 여부는 ENG-003 향후 검토 |

**등재 규칙**: (1) flow 헤더에 `검증 대상:` 주석과 근거를 남기고, (2) 본 표에 등재한다. `subflows/*.yaml` 은 테스트가 아니라 재사용 헬퍼이므로 매핑 대상이 아니다.

### AC ↔ e2e flow 매핑 (제품 AC 69개)

> 각 AC 는 (a) 전용 flow 1개(✅) · (b) 후속 flow(⬜, 미작성) 중 하나로 분류된다. **영구 예외 AC 는 없다** — 외부 서비스에 의존하는 AC 도 해당 외부 호출 경계만 결정적으로 치환하면 e2e 로 구동 가능하므로, "e2e 불가"를 AC 에 붙이지 않고 아래 [외부 호출 모킹 경계 레지스트리](#외부-호출-모킹-경계-레지스트리-mock-boundary-registry)에 경계(라이브러리/서비스) 단위로 등재한다. 모킹이 필요한 후속 AC 는 매핑에 경계 ID(MB-n)를 병기한다.
> 2026-07-12 첫 정비 · 2026-07-15 예외 재정비 · 2026-07-20 경계 재프레이밍 · 2026-07-22 AC-007-01 flow 신설 · **2026-07-27 AC-008-10 flow 신설** · **2026-07-30 AC-007-05 flow 신설** · **2026-08-05 PRD-001 AC 2건 신설 + AC-007-08/09 이관 + PRD-009 확정(AC 14건 편입, `home-feed.yaml`→AC-009-14 재매핑)** · **2026-08-06 AC-002-01 flow 신설** · **2026-08-08 PRD-002 단계 일반화(AC-002-05 신설)** 기준: ✅ 22 · ⬜ 47 · 🟡 0 · 1차 제외 1(AC-009-12). 모든 제품 flow 는 헤더에 정확히 1개 AC 를 선언한다(중복·묶음 0). *(2026-08-05 reconciler rct_20260805-0001: `home-feed.yaml` 헤더 AC 재선언 완료 — AC-007-08/09·TC-007-08/09 → AC-009-14·TC-009-14-A, 참조 무결성 복구, flow 커맨드 무변경)*

| AC | 제목 | 매핑 |
|----|------|------|
| AC-001-01 | 음성 녹음 시작 및 종료 | ✅ `home-voice-record.yaml` |
| AC-001-02 | AI 음성-텍스트 변환 | ⬜ 후속 |
| AC-001-03 | 변환 텍스트 편집 | ⬜ 후속 |
| AC-001-04 | 텍스트 직접 입력 | ⬜ 후속 |
| AC-001-05 | 기록 목록 조회 | ⬜ 후속 |
| AC-001-06 | 작성 시점 공개/비공개 선택 | ⬜ 후속 |
| AC-001-07 | 임시 저장 — 업로드 전 로컬 보관 | ⬜ 후속 (MB-1) |
| AC-002-01 | 오늘의 질문 표시 | ✅ `daily-question-display.yaml` |
| AC-002-02 | 아이 단계별 질문 매칭 | ⬜ 후속 |
| AC-002-03 | 질문에서 기록으로 연결 | ⬜ 후속 |
| AC-002-04 | 질문 알림 발송 | ⬜ 후속 (MB-5) |
| AC-002-05 | 단계 산출 불가 시 폴백 | ⬜ 후속 |
| AC-003-01 | AI 서사 생성 | ⬜ 후속 (MB-4) |
| AC-003-02 | 서사 미리보기 | ⬜ 후속 |
| AC-003-03 | 서사 편집 | ⬜ 후속 |
| AC-003-04 | 미디어 서사 통합 | ⬜ 후속 |
| AC-004-01 | 책 레이아웃 선택 | ⬜ 후속 |
| AC-004-02 | 책 내용 구성 확인 | ⬜ 후속 |
| AC-004-03 | 제작 주문 및 결제 | ⬜ 후속 (MB-6) |
| AC-004-04 | 제작 상태 추적 | ⬜ 후속 |
| AC-005-01 | 사진 촬영 첨부 | ⬜ 후속 (MB-3) |
| AC-005-02 | 갤러리 사진 첨부 | ⬜ 후속 |
| AC-005-03 | 영상 촬영 첨부 | ⬜ 후속 (MB-3) |
| AC-005-04 | 갤러리 영상 첨부 | ⬜ 후속 |
| AC-005-05 | 음성 메모 첨부 | ⬜ 후속 |
| AC-005-06 | 미디어 미리보기 및 관리 | ⬜ 후속 |
| AC-005-07 | 미디어 포함 기록 목록 표시 | ⬜ 후속 |
| AC-005-08 | 미디어 AI 서사 연동 | ⬜ 후속 (MB-4) |
| AC-006-01 | 두 개의 독립 체크로 케이스 분기 | ⬜ 후속 |
| AC-006-02 | Case A 입력 흐름 (첫 아이 임신 중) | ✅ `onboarding-caseA.yaml` |
| AC-006-03 | Case B 입력 흐름 (양육 + 임신 중) | ✅ `onboarding-caseB.yaml` |
| AC-006-04 | Case C 입력 흐름 (순수 양육자) | ✅ `onboarding-caseC.yaml` |
| AC-006-05 | 출산 D-7 푸시 알림 | ⬜ 후속 (MB-5) |
| AC-006-06 | 출산 확인 팝업 및 양육자 모드 전환 | ⬜ 후속 |
| AC-006-07 | 출산 미전환 시 수동 전환 유도 | ⬜ 후속 |
| AC-006-08 | 홈 상단 아이 전환 탭 | ⬜ 후속 |
| AC-006-09 | 선택된 아이 기준으로 모든 탭이 동작 | ⬜ 후속 |
| AC-006-10 | 설정 탭에서 아이 추가 (우선순위 낮음) | ⬜ 후속 |
| AC-007-01 | 헤더 — 활성 아이 컨텍스트 표시 | ✅ `home-header-active-child.yaml` |
| AC-007-02 | 헤더 — 다자녀 아이 전환 | ✅ `home-header-multichild.yaml` |
| AC-007-03 | 헤더 — 알림 아이콘 | ✅ `home-header-notification-dot.yaml` |
| AC-007-04 | 오늘의 질문 카드 — 표시 | ✅ `home-question-card-undecided.yaml` |
| AC-007-05 | 오늘의 질문 카드 — 다른 질문 보기 | ✅ `home-question-reroll.yaml` |
| AC-007-06 | 오늘의 질문 카드 — 음성/텍스트 기록 진입 | ✅ `home-record-ctas.yaml` |
| AC-007-07 | 오늘의 질문 카드 — 책 진행도 표시 | ✅ `home-book-progress.yaml` |
| AC-007-08 | *(→ AC-009-14로 이관 완료, 2026-08-05)* | ➡️ 아래 AC-009-14 참조 |
| AC-007-09 | 타인 기록 피드 — *(ENG-007·008·010으로 이관, 2026-08-05)* | ➡️ AC 아님 (엔지니어링 초안) |
| AC-007-10 | 하단 네비게이션 바 | ✅ `home-nav-5tabs.yaml` |
| AC-008-01 | 모든 아이의 기록 통합 표시 | ✅ `diary-list-multichild.yaml` |
| AC-008-02 | 기록 목록 — 월 단위 시간 그룹 | ⬜ 후속 |
| AC-008-03 | 기록 카드 — 아이 컨텍스트 칩과 표시 요소 | ⬜ 후속 |
| AC-008-04 | 기록 상세 — 진입과 전체 표시 | ✅ `diary-detail-and-back.yaml` |
| AC-008-05 | 기록 편집 — 사후 편집 | ✅ `diary-edit.yaml` |
| AC-008-06 | 기록 삭제 — 확인 모달 | ✅ `diary-delete-confirm.yaml` |
| AC-008-07 | 공개/비공개 토글 — 사후 변경 | ✅ `diary-visibility-toggle.yaml` |
| AC-008-08 | 필터 — 아이·날짜·미디어·공개 여부 | ✅ `diary-filter-by-child.yaml` |
| AC-008-09 | 빈 상태 처리 | ✅ `diary-list-empty.yaml` |
| AC-008-10 | 일기 탭 헤더 + 하단 네비게이션 바 | ✅ `diary-header-nav.yaml` |
| AC-009-01 | 콘텐츠 출처 — 공개 기록 기반 | ⬜ 후속 |
| AC-009-02 | 커뮤니티 메인 화면 구조와 피드 카드 | ⬜ 후속 |
| AC-009-03 | 상단 상태값 표시·아이 전환 갱신 | ⬜ 후속 |
| AC-009-04 | 오늘의 질문 카드 — CTA 상태 분기 | ⬜ 후속 |
| AC-009-05 | 같은 질문 답변 모아보기 — 상호 공개·권한 소멸 | ⬜ 후속 |
| AC-009-06 | 콘텐츠 타입 필터 | ⬜ 후속 |
| AC-009-07 | 게시글 상세 — 본인 글 관리·공개 수명주기 | ⬜ 후속 |
| AC-009-08 | 공감 — 토글·본인 제한 | ⬜ 후속 |
| AC-009-09 | 댓글/대댓글 — 1depth·작성자 표시 | ⬜ 후속 |
| AC-009-10 | 개인정보 보호 — 마스킹 표시명 | ⬜ 후속 |
| AC-009-11 | 신고 — 접수 | ⬜ 후속 |
| AC-009-12 | 커뮤니티 알림 | — 1차 런치 제외 (매핑 대상 아님) |
| AC-009-13 | 빈 상태/예외 상태 | ⬜ 후속 |
| AC-009-14 | 홈 "다른 엄마들의 기록" 섹션 | ✅ `home-feed.yaml` (구 AC-007-08 flow 재매핑) |

### 외부 호출 모킹 경계 레지스트리 (Mock Boundary Registry)

**원칙**: e2e flow 는 최대한 실제 경로로 구동한다. 결정적으로 치환하는 것은 **외부 세계 부작용**(실물 배송·실결제 청구·OS 푸시 실도달·LLM 산출 품질처럼 CI 에서 재현 불가·비결정적인 부분)뿐이고, 그 앞뒤의 앱 로직·네트워크·화면 전이는 모두 실제로 e2e 한다. 따라서 자동화 곤란은 **AC 단위가 아니라 외부 호출 경계(라이브러리/서비스) 단위**로 등재한다 — "AC-xxx 는 e2e 불가" 목록을 두지 않는다. 앱은 이미 이 방식으로 두 경계(MB-1 오디오/STT, MB-2 OAuth)를 e2e 화했고, 신규 경계는 이 검증된 패턴을 그대로 따른다.

| ID | 외부 호출 경계 (라이브러리/서비스) | 모킹 seam | 결정적 치환 — 최소 부분만 | e2e 로 그대로 구동되는 실제 구간 | 경계 성질상 e2e 밖 잔여 | 관련 AC |
|----|-----------------------------------|-----------|--------------------------|--------------------------------|------------------------|---------|
| **MB-1** | 마이크 캡처 + 온디바이스 STT — `expo-audio` + `whisper.rn` | **구현됨**: `EXPO_PUBLIC_E2E_AUDIO_FIXTURE` → `FixtureRecorder` + canned transcript (`app/src/config/env.ts` · `app/src/voice/recorder.ts`·`whisperEngine.ts`·`modelManager.ts`) | 마이크 입력 + Whisper 모델 추론만 | 녹음 UI → 저장 → 업로드 → 목록/홈 반영 전 구간 | 실제 음성 인식 정확도(품질) | AC-001-01, AC-001-02 |
| **MB-2** | OAuth 신원 공급자 — `@react-native-google-signin/google-signin` + `expo-apple-authentication` | **구현됨**: tester-login 제스처(`app/src/auth/useTesterLoginGesture.ts`) + `TesterLoginModal` (`app/src/auth/`) → 세션 토큰 발급. 도달 경로 단축분 `EXPO_PUBLIC_E2E_FAST_TESTER_LOGIN` → `tester-login-fast` 히트존 (`app/src/config/env.ts` · `app/app/(landing)/index.tsx` · `e2e/maestro/subflows/tester-login-fast.yaml` · `.github/workflows/e2e-*.yml`) 포함 | 외부 Google/Apple 로그인 왕복만. `EXPO_PUBLIC_E2E_FAST_TESTER_LOGIN` 은 **아무것도 치환하지 않는다** — 모달 도달 방법만 15탭 제스처에서 히트존 1회로 줄이고 모달·`POST /auth/password-login`·세션 기록은 동일 | 세션 수립 후 모든 인증 flow (`subflows/tester-login-fast.yaml` 경유). 15탭 제스처 원경로는 `login.yaml` · `subflows/tester-login.yaml` 가 계속 단정 | 실제 OAuth 제공자 계정 왕복 | (ENG-003 기반, 전 authed flow) |
| **MB-3** | 카메라/미디어 캡처 — expo 카메라·이미지 모듈 *(미도입)* | **신설**: `EXPO_PUBLIC_E2E_CAMERA_FIXTURE`(오디오 fixture 동형) → 캡처 시 canned 이미지/영상 파일 반환 | 디바이스 카메라 캡처만 | 촬영 CTA → 미리보기 → 첨부 → 기록 저장 전 구간 | 실제 카메라 하드웨어 화질 | AC-005-01, AC-005-03 |
| **MB-4** | AI 서사 생성(LLM) — OpenRouter(워커의 `chat.completions`), 앱은 `react-native-sse` 로 스트리밍 수신 | **구현됨**: mock OpenRouter 서버 `scripts/openrouter-mock/server.js` (in-cluster 변형 `deployment.yaml`) + 워커의 `OPENROUTER_BASE_URL` 주입 (`.github/actions/setup-ai-worker/action.yml` 이 mock 을 띄우고 워커를 물린다 — `e2e-android.yml`·`e2e-ios.yml` 양 maestro 레인과 `integration.yml` 이 모두 사용). 주입점: `worker/cmd/worker/main.go` · `worker/internal/openrouter/client.go` | LLM 공급자로의 HTTP 왕복만 (mock 이 결정적 응답을 돌려준다) | 생성 트리거 → enqueue → 워커 처리 → 백엔드 → SSE 수신 → 서사 표시·편집 전 구간이 전부 실제 컴포넌트로 돈다 | LLM 산출 **품질**(별도: 프롬프트/통합 단위 + 수동 QA) | AC-003-01, AC-005-08 |
| **MB-5** | 푸시 알림 도달 — OS 푸시(APNs/FCM); *앱 푸시 라이브러리 없음* — 서버 스케줄, 앱은 `app/src/api/notifications.ts` 로 조회 | **신설(백엔드)**: e2e 모드에서 예약 알림을 즉시 생성 → 앱이 알림 API 로 조회·표시 | OS 푸시의 디바이스 실도달만 | 알림 생성 → 조회 → 홈 알림 점·알림 목록 표시 전 구간 | 물리 디바이스 OS 푸시 실수신 | AC-002-04, AC-006-05 |
| **MB-6** | 결제 + 실물 제작·배송 — 결제 게이트웨이 + 제작 fulfillment; *네이티브 결제 라이브러리 없음* — 백엔드 주문 API | **신설(백엔드)**: e2e 모드에서 샌드박스/스텁 결제 승인 + 스텁 fulfillment 상태 | 실제 대금 청구 + 실물 제작·배송만 | 주문 구성 → 체크아웃 → 주문 확정·상태 추적 전 구간 | 실제 청구·실물 책 제작·배송 | AC-004-03, AC-004-04 |

> **경계별 후속**: MB-1·MB-2·MB-4 는 구현 완료(해당 seam 재사용). MB-3·MB-5·MB-6 은 seam 실구현(카메라 fixture, 백엔드 e2e 결정 모드)과 대응 신 flow 저작이 필요하고 앱 구동·백엔드 통합 검증을 요하므로 **경계별 후속 task** 로 분리한다. 각 경계의 "실제 구간"은 e2e 로 반드시 단정하고, "잔여"만 단위/통합 테스트·수동 QA 로 커버한다.
>
> **2026-07-15 예외 재정비 이력**: 이전 정비에서 예외를 "본질적으로 e2e 구동 불가"로 한정해 5건(AC-001-02·003-04·004-04·007-09·002-02)을 후속 flow 로 재분류했다. **2026-07-20** 본 재프레이밍은 남은 7건까지 전부 경계 등재로 흡수해 **영구 예외 AC 를 0건**으로 만든다.

**표기 규약**: 등재된 경계의 모킹 seam 은 **그 지점 직전 줄에** 사유 주석을 단다.

```
// mock-exception: MB-N — <실환경으로 불가능한 이유 한 줄>
```

YAML·Go·셸에서는 각 언어의 주석 문법을 쓰되 `mock-exception: MB-N` 토큰은 그대로 유지한다. 이 토큰이 곧 "코드에 실재하는 seam" 의 기계 판독 지점이다 — 위 표의 **구현됨** 경계 집합과, as-is 스캔 범위(`app` `backend` `worker` `e2e` `scripts` `.github`; `docs/` 는 제외 — 이 문서 자신이 잡히면 안 된다)에서 뽑은 토큰 집합이 정확히 일치해야 한다. 검증 명령:

```bash
git grep -ho 'mock-exception: MB-[0-9][0-9]*' -- app backend worker e2e scripts .github | sort -u
```

현재 양쪽 모두 `{MB-1, MB-2, MB-4}` 다. 주석만 있고 미등재이거나, 등재만 있고 주석이 없으면 drift 다. 규약의 목적은 **지문의 사각지대를 덮는 것**이다: 새 이름의 환경 플래그·프록시 주입처럼 기존 토큰 패턴에 안 걸리는 모킹 수단도 이 주석을 달면 잡힌다.

**등재 불가 · 제거 대기** (예외 목록이 **아니다** — 정책 위반으로 남아 있는 부채이며, 닫는 조건은 등재가 아니라 제거다):

| 지점 | 왜 등재 불가인가 | 제거의 선행 조건 |
|------|------------------|------------------|
| `app/src/api/notifications.ts` 의 `STUB_UNREAD_COUNT = 1` (AC-007-03 종 아이콘 red dot) | 파일 주석이 스스로 밝히듯 **백엔드 알림 API 미구현 우회**다. 외부 세계 부작용이 아니므로 경계 등재 자격(요건 1)을 못 채운다. MB-5 는 "백엔드가 e2e 모드에서 예약 알림을 생성" 하는 **서버측** 신설 seam이라 이 클라이언트 stub 과 같은 것이 아니다 | 백엔드 미읽음 알림 조회 API → `getUnreadCount()` 를 실 호출로 교체하고 상수 삭제 |
| `app/src/api/recordsCount.ts` 의 하드코딩 fallback(50/36/12/50) (AC-007-07 책 진행도) | 같은 사유 — **백엔드 답변 카운트 API 미구현 우회**. "두 분기를 같은 mock 으로 검증" 이라는 선택 근거 자체가 시드로 대체 가능한 데이터를 고정한 것이라 불허에 이중으로 걸린다 | 백엔드 답변 수 집계 API → `getCountByActiveChild()` 를 실 호출로 교체하고 fallback 삭제 |

**지문 오탐(계측 한계)**: as-is 지문 스크립트의 패턴에 걸리지만 **모킹 seam 이 아닌** 것들 — 재심리하지 말 것. ① `.github/workflows/e2e-ios.yml` 의 `E2E_KEYCHAIN_PATH`/`E2E_KEYCHAIN_PWD` (iOS 코드 서명 키체인. STRONG 패턴 `\bE2E_[A-Z0-9_]+\b` 가 접두사만 보고 잡는다) ② `app/src/api/community.ts` 의 산문 "예전 mock 셀렉터" 언급 (실제 seam 이 아니라 오히려 *클라이언트 재구현 금지* 근거) ③ `notifications.ts`·`recordsCount.ts` 의 산문 `mock`/`stub` 낱말 (WEAK 패턴이 위 표의 실제 지점과 중복 계수) ④ `app/src/voice/uploadAudio.ts` 의 `EXPO_PUBLIC_E2E_AUDIO_FIXTURE` 언급 — **업로드 경로는 치환되지 않는다**고 명시하는 산문이며(CI 는 실제 MinIO 를 친다) seam 이 아니다. ①~④ 에는 `mock-exception:` 주석을 달지 않는다.

**⬜ 후속 flow backlog** (34건 — 목표 flow / 단정 핵심; 새 maestro flow 는 앱 구동 검증이 필요해 후속 task 로 저작. 뒤 7건은 외부 호출 경계 모킹이 선행되는 승격분):

- **AC-001-02** AI 음성-텍스트 변환 → `record-stt-result.yaml`: 녹음 종료 → canned-transcript fixture 로 변환 결과 텍스트·로딩 상태 표시 (정확도 품질은 예외 — 단위/수동 QA)
- **AC-001-03** 변환 텍스트 편집 → `record-audio-review-edit.yaml`: 녹음 리뷰 화면에서 transcript 편집 후 저장 반영
- **AC-001-04** 텍스트 직접 입력 → `record-text-input.yaml`: 텍스트 CTA → record-text 입력 → 저장 → 목록/홈 반영
- **AC-001-05** 기록 목록 조회 → `record-list.yaml`: 저장된 기록이 목록에 노출·정렬
- **AC-002-02** 아이 단계별 질문 매칭 → `daily-question-stage-match.yaml`: (blocked — ENG-002 본 구현 확정 후) 임신 아이는 주차 풀·양육 아이는 생후 나이 풀에서 노출되고 두 풀이 혼합되지 않음을 아이 전환으로 단정
- **AC-002-05** 단계 산출 불가 시 폴백 → `daily-question-stage-fallback.yaml`: 예정일 미입력 온보딩 경로 → 질문 카드는 정상 노출·단계 배지만 부재 단정 (공용 풀 문항 자체의 적절성은 e2e 밖 — ENG-002 단위 + 수동 QA)
- **AC-002-03** 질문에서 기록으로 연결 → `daily-question-to-record.yaml`: 질문 카드 CTA → 기록 화면 진입
- **AC-003-02** 서사 미리보기 → `narrative-preview.yaml`: 생성 서사 미리보기 화면 렌더(fixture 서사)
- **AC-003-03** 서사 편집 → `narrative-edit.yaml`: 서사 편집 → 저장 반영
- **AC-003-04** 미디어 서사 통합 → `narrative-media-edit.yaml`: 서사 편집에서 미디어 순서 변경·제외·캡션 입력 반영 (AI 통합 산출 품질은 예외 — 여기선 편집 UI)
- **AC-004-01** 책 레이아웃 선택 → `book-layout-select.yaml`: 레이아웃 옵션 선택이 구성에 반영
- **AC-004-02** 책 내용 구성 확인 → `book-compose-review.yaml`: 구성 확인 화면 렌더·항목 표시
- **AC-004-04** 제작 상태 추적 → `book-status-tracking.yaml`: 스텁 백엔드 상태(접수→인쇄→제본→배송)가 추적 화면에 단계별 표시 (실물 제작·배송 자체는 예외)
- **AC-005-02** 갤러리 사진 첨부 → `media-attach-gallery-photo.yaml`: 갤러리 피커 → 사진 첨부 → 기록 반영
- **AC-005-04** 갤러리 영상 첨부 → `media-attach-gallery-video.yaml`: 갤러리 피커 → 영상 첨부 → 기록 반영
- **AC-005-05** 음성 메모 첨부 → `media-attach-voice-memo.yaml`: 음성 메모 첨부(audio fixture 재사용) → 기록 반영
- **AC-005-06** 미디어 미리보기 및 관리 → `media-preview-manage.yaml`: 첨부 미디어 미리보기·삭제 UI
- **AC-005-07** 미디어 포함 기록 목록 표시 → `media-record-list.yaml`: 미디어 포함 기록이 목록에 썸네일과 표시
- **AC-006-01** 두 개의 독립 체크로 케이스 분기 → `onboarding-branching.yaml`: Q1×Q2 조합이 올바른 Case(A/B/C)로 분기
- **AC-006-06** 출산 확인 팝업 및 양육자 모드 전환 → `birth-confirm-convert.yaml`: 출산 확인 팝업 → 양육자 모드 전환 반영
- **AC-006-07** 출산 미전환 시 수동 전환 유도 → `birth-manual-convert-nudge.yaml`: 미전환 상태에서 수동 전환 유도 UI
- **AC-006-08** 홈 상단 아이 전환 탭 → `home-child-switch-tab.yaml`: 홈 상단 아이 전환 탭 노출·전환(AC-007-02와 화면 공유, 별도 단정)
- **AC-006-09** 선택된 아이 기준으로 모든 탭이 동작 → `active-child-scopes-tabs.yaml`: 아이 전환 시 각 탭이 선택 아이 기준으로 반영
- **AC-006-10** 설정 탭에서 아이 추가 (우선순위 낮음) → `settings-add-child.yaml`: 설정 탭 → 아이 추가 진입/완료 (우선순위 낮음)
- ~~**AC-007-09** 타인 기록 피드 — 노출 로직 → `home-feed-exposure.yaml`~~ — **2026-08-05 이관**: 노출 로직이 AC에서 분리되어 ENG-007·008·010(미확정 초안)으로 이동. 초안 확정 시 검증 flow를 ENG 매핑으로 재정의
- **AC-001-06** 작성 시점 공개/비공개 선택 → `record-visibility-default.yaml`: 저장 화면 토글 기본값 비공개 단정 → 공개 저장 → 상세에서 상태 확인
- **AC-001-07** 임시 저장 — 업로드 전 로컬 보관 (MB-1) → `record-draft-retry.yaml`: 업로드 실패(네트워크 차단 fixture) → 보관함 표시·일기 목록 부재 → 재시도 → 정식 기록 전환 (오디오 fixture는 MB-1 재사용)
- **AC-008-02** 기록 목록 — 월 단위 시간 그룹 → `diary-list-month-groups.yaml`: 여러 달 기록이 월 단위 그룹 헤더로 구분
- **AC-008-03** 기록 카드 — 아이 컨텍스트 칩과 표시 요소 → `diary-card-elements.yaml`: 카드에 아이 컨텍스트 칩·표시 요소 노출
- **AC-009-01** 콘텐츠 출처 → `community-source-visibility.yaml`: 공개만 노출·비공개/임시저장 미노출·글쓰기 부재 (TC-009-01)
- **AC-009-02** 메인 화면·피드 카드 → `community-main-card.yaml`: 화면 구성 순서·카드 요소·상세 진입 (TC-009-02)
- **AC-009-03** 상태값·아이 전환 → `community-context-switch.yaml`: 상태값 표시·전환 갱신·수동 필터 부재 (TC-009-03)
- **AC-009-04** 질문 카드 CTA 분기 → `community-question-cta.yaml`: 미답변/비공개/공개 3분기 (TC-009-04-A/B/C)
- **AC-009-05** 모아보기 상호 공개 → `community-mutual-visibility.yaml`: 권한 표·공개하고 보기·재비공개 시 소멸 (TC-009-05-A/B)
- **AC-009-06** 타입 필터 → `community-type-filter.yaml`: 전체/질문답변/자유일기 (TC-009-06)
- **AC-009-07** 상세·수명주기 → `community-detail-lifecycle.yaml`: 표시 요소·본인 관리·전환 보존·삭제 소멸 (TC-009-07-A/B)
- **AC-009-08** 공감 → `community-like.yaml`: 토글·본인 글/댓글 불가 경로 무관 (TC-009-08)
- **AC-009-09** 댓글/대댓글 → `community-comments.yaml`: 1depth·작성자 표시명·배지·본인 삭제 (TC-009-09)
- **AC-009-10** 개인정보 보호 → `community-privacy-mask.yaml`: 마스킹 길이 분기·비노출 항목·사진 제외 (TC-009-10)
- **AC-009-11** 신고 접수 → `community-report.yaml`: 사유 5종·토스트·중복 방지·신고자 숨김 (TC-009-11)
- **AC-009-13** 빈/예외 상태 → `community-empty-states.yaml`: 상황별 문구 6종 (TC-009-13)

_경계 모킹 선행 — 예외에서 승격된 7건 (각 경계 ID 참조; "잔여"는 e2e 밖):_

- **AC-002-04** 질문 알림 발송 (MB-5) → `daily-question-notify.yaml`: 백엔드 e2e 예약 알림 생성 → 홈 알림 점·알림 목록에 표시 (OS 푸시 실도달은 MB-5 잔여 — 스케줄러 백엔드 단위 + 수동 QA)
- **AC-006-05** 출산 D-7 푸시 알림 (MB-5) → `birth-d7-notify.yaml`: 출산 D-7 예약 알림 생성 → 알림 목록·전환 유도 표시 (OS 푸시 실도달은 MB-5 잔여)
- **AC-003-01** AI 서사 생성 (MB-4) → `narrative-generate.yaml`: 생성 트리거 → canned 서사 SSE 수신 → 서사 표시 (LLM 산출 품질은 MB-4 잔여 — 프롬프트/통합 단위 + 수동 QA)
- **AC-005-08** 미디어 AI 서사 연동 (MB-4) → `narrative-media-integrate.yaml`: 미디어 첨부 후 생성 → canned 서사에 해당 미디어 반영 확인 (연동 산출 품질은 MB-4 잔여)
- **AC-004-03** 제작 주문 및 결제 (MB-6) → `book-order-pay.yaml`: 주문 구성 → 스텁 결제 승인 → 주문 확정 상태 표시 (실결제·실물 제작·배송은 MB-6 잔여 — 결제 샌드박스 통합 + 수동 QA)
- **AC-005-01** 사진 촬영 첨부 (MB-3) → `media-attach-camera-photo.yaml`: `EXPO_PUBLIC_E2E_CAMERA_FIXTURE` 촬영 → 미리보기 → 첨부 → 기록 반영 (실카메라 화질은 MB-3 잔여)
- **AC-005-03** 영상 촬영 첨부 (MB-3) → `media-attach-camera-video.yaml`: 카메라 fixture 영상 촬영 → 미리보기 → 첨부 → 기록 반영 (실카메라 화질은 MB-3 잔여)

## 여정 mockup 예외

사용자 여정(`docs/journeys/*-journey.md`)은 원칙적으로 목업 진입점(갤러리 여정 그룹) 1개를 갖는다.
**목업을 두지 않기로 결정한 여정**만 여기에 사유·재검토 시점과 함께 등재하며, 등재된 여정은
진입점이 없어도 drift 가 아니다. 등재 없이 진입점만 없는 여정은 drift 다.

전수 매핑과 원장(미시각화 단계 · 고아 진입점 · 구 번호 라벨)은
[여정 ↔ 목업 매핑 레지스트리](journey-mockup-map.md)가 SSOT 이고,
`scripts/check-journey-mockup-map.mjs` 가 이 표와 그 레지스트리의 일관성을 CI 에서 강제한다
(J3: 진입점 없는 여정은 반드시 이 표에 있어야 하고, 이 표에 있는 여정은 진입점을 가지면 안 된다).

**현재 등재 0건** — 여정 6개 모두 진입점을 갖는다. 단계 수준의 미시각화(현재 5건)는 여정 전체를
빼는 것이 아니므로 이 표가 아니라 레지스트리 §3 원장에서 관리한다.

<!-- journey-mockup-exceptions:begin -->

| 여정 문서 | 사유 | 재검토 시점 |
|---|---|---|

<!-- journey-mockup-exceptions:end -->

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
- (없음) — PRD-009 확정과 함께 TEST-009 (18 TC) 작성 완료 (2026-08-05). AC-009-12는 1차 제외라 검증 대상 아님
- PRD-002 의 모든 AC(5개, AC-002-05 포함)는 TEST-002 의 11개 TC 로 커버됨 (2026-08-08)
- PRD-006 의 모든 AC(10개)는 TEST-006 의 19개 TC 로 커버됨
- PRD-007 의 확정 AC(8개)는 TEST-007 의 14개 TC 로 커버됨 (구 08/09 검증은 TEST-009·ENG로 이관)
- PRD-008 의 모든 AC(10개)는 TEST-008 의 22개 TC 로 커버됨
- 기존 PRD-001~005 의 AC는 기존 TEST-001~005 로 커버됨

### 고아 테스트 (AC·엔지니어링 노트 어디에도 매핑되지 않은 테스트)
- 문서 테스트(TEST-001~008): (없음)
- e2e flow: (없음) — 매핑 현황은 위 "e2e flow 매핑" 섹션 참조. `login.yaml`→ENG-003, `health.yaml`→스모크 예외

## 변경 이력

| 시점 | 변경 내용 | 이전 상태 | 이후 상태 |
|------|-----------|-----------|-----------|
| 2026-08-15 여정 ↔ 목업 매핑 레지스트리 신설 | 여정 ↔ 목업 1:1 정합성의 **매핑 SSOT 부재** 해소 (reconciler rct_20260815-0001): ① **`docs/journey-mockup-map.md` 신설** — 여정 6개 ↔ 갤러리 여정 그룹 6개(규칙 1·2)와 단계 25개 ↔ 카드 43장을 전수 등재하고, 미시각화 단계 5건·고아 진입점 1건·구 번호 라벨 34장을 각각 상한이 선언된 원장으로 고정했다. ② **`docs/mockups/README.md` 일람 표의 `여정 / Stage` 칸을 여정 문서 기준으로 정정** — 43행 중 36행이 여정 문서에 **존재하지 않는 식별자**를 가리키고 있었다. 가장 위험한 형태는 여정을 가로지르는 충돌로, M-31~M-34(Book Production)가 `9-1`~`9-4` 를 인용했는데 그 번호는 문서상 AI Narrative 의 것이다(Book Production 은 `10-1`~`11`). 같은 절의 선언 `✅ M-01~M-42 는 6개 사용자 여정 stage 와 1:1 매핑` 은 **사실이 아니었으므로** 실제 상태(전수 그룹 매핑 ✅ · 미시각화 5 · 구 번호 라벨 34 · 고아 1)로 교체했다. ③ **「여정 mockup 예외」 섹션 신설**(등재 0건) — 모델 규칙 8 의 등재 지점이 없어 "예외 등재 없이 진입점 없는 여정"과 "정당한 예외"를 구분할 수 없던 상태를 닫았다. ④ **`scripts/check-journey-mockup-map.mjs` + `.github/workflows/journey-mockup-map.yml` 신설** — J0~J9 를 PR·main push 마다 강제한다(원장은 래칫: 새 위반도, 고쳐졌는데 남은 공전 행도 실패). 허브 동기화 검사가 "소스만 고치고 재빌드 안 함"을 잡는다. 문서·검사 전용 변경 — 목업 소스·번들 바이트·앱 코드·AC↔flow 매핑 무변경, 집계 무이동. | 매핑 SSOT 없음(`docs/journey-mockup-map.md` 부재), README 일람 표의 Stage 인용 36행이 문서에 없는 식별자, 거짓 1:1 선언, 여정 mockup 예외 등재 지점 없음, 기계 검증 0 | 매핑 SSOT 신설(여정 6·단계 25·카드 43 전수), README Stage 인용 43행 전부 문서에 실재, 원장 3종(5·1·34) 상한 선언, 예외 섹션 신설(등재 0건), J0~J9 CI 강제 |
| 2026-08-08 모킹 경계 표기 규약 도입 · 등재 1:1 정정 | 외부 호출 모킹 경계 레지스트리 정합 (reconciler rct_20260808-0001): ① **표기 규약 도입** — `// mock-exception: MB-N — <사유>` 주석이 레포 전역 0건이었다. 구현된 경계 3건의 실재 seam 사이트마다 직전 줄에 주석을 달아, 레포의 토큰 집합과 레지스트리의 **구현됨** 경계 집합이 `{MB-1, MB-2, MB-4}` 로 정확히 일치하게 했다 — 이제 `grep -rho 'mock-exception: MB-[0-9]*' | sort -u` 로 1:1 이 기계 검증된다. ② **MB-4 = 신설(백엔드) → 구현됨 정정** — LLM 경계 mock 이 이미 코드에 있는데 등재문은 "신설 예정" 이었다. mock 을 띄우고 워커를 물리는 것은 `.github/actions/setup-ai-worker` 이고, 그 액션을 **`e2e-android.yml`·`e2e-ios.yml` 양 maestro 레인과 `integration.yml` 이 모두 사용**한다(둘 다 `openrouter-base-url` 미지정 → 액션이 로컬 mock 기동). 실제 치환 지점도 백엔드 SSE 가 아니라 **LLM 공급자 HTTP 경계** 라, 등재문보다 오히려 "최소 부분" 요건을 더 잘 만족한다(worker→backend→SSE→앱 전 구간이 실제로 돈다). 4개 컬럼을 실측에 맞춰 재작성. ③ **`EXPO_PUBLIC_E2E_FAST_TESTER_LOGIN` 을 MB-2 에 흡수 등재** — ENG-003 에는 기술돼 있으나 레지스트리 MB-2 행에는 없었다. 이 플래그는 아무것도 치환하지 않는다(모달·`POST /auth/password-login`·세션 기록 동일, 도달 방법만 15탭 → 히트존 1회)고, 그 15탭 제스처 자체가 이미 MB-2 로 등재된 치환의 진입 어포던스이지 실제 사용자 경로가 아니므로 불허 항목 "속도만을 위한 **실경로** 우회" 에 해당하지 않는다. `login.yaml` 이 제스처 원경로를 계속 단정해 커버리지 유지. ④ **등재 불가 부채 2건 명시** — `notifications.ts` 의 `STUB_UNREAD_COUNT`, `recordsCount.ts` 하드코딩 fallback. 두 파일 주석이 스스로 "백엔드 API 미구현" 우회임을 밝혀 등재 자격이 없다(백엔드에 해당 라우트·핸들러가 실제로 0건임을 확인). **예외 목록이 아니라 제거 대기 부채**로, 닫는 조건(백엔드 알림/답변수 API)과 함께 표로 적었다. ⑤ **지문 오탐 4종 명시** — `E2E_KEYCHAIN_*`(iOS 서명 키체인) · `community.ts` 산문 언급 · `notifications.ts`/`recordsCount.ts` 산문 낱말 중복 계수 · `uploadAudio.ts` 의 "업로드는 치환 안 함" 산문. 다음 정비가 재심리하지 않도록 고정. 주석·문서 전용 변경 — 런타임 코드·flow 커맨드·CI 배선·집계 무변경(AC↔flow 매핑 무이동). | `mock-exception:` 0건, MB-4 "신설(백엔드)" 로 오기, `EXPO_PUBLIC_E2E_FAST_TESTER_LOGIN` 미등재, 등재 불가 stub 2건 무기록, 오탐 무기록 | 구현 경계 3건(MB-1·MB-2·MB-4) 토큰 1:1, MB-4 "구현됨", MB-2 가 FAST_TESTER_LOGIN 을 명시, 제거 대기 부채 2건 + 지문 오탐 4종 등재 |
| 2026-08-08 단계 스냅샷 저장 방식 확정 (ENG-013 신설) | 열려 있던 "물리 저장 vs 소급 계산" 구현 재량을 **물리 저장 + 기준값 정정 시 재계산(백필)** 으로 확정하고, 상세를 **ENG-013 `ENG-013-stage-snapshot-persistence.md` 신규 문서**로 분리. ① **프레이밍** — 단계는 `f(작성일, 기준값)` 의 결과이고 작성일은 불변이므로 스냅샷은 **순수 함수의 캐시**이고 백필은 캐시 무효화다. 정합성 조건이 "`f` 의 입력이 바뀌는 모든 지점에서 재계산" 하나로 환원된다. ② **재계산 트리거 3종 등재** — T1 `due_date` 수정(임신 축 기록 전량) · T2 `birth_date` 수정(양육 축) · T3 컬럼 도입 마이그레이션(1회). 사용자 질문은 예정일만 언급했으나 **`birth_date` 도 정정 가능하므로 T2 를 함께 등재**. ③ **비대상 명문화** — **출산 전환은 백필하지 않는다.** 전환은 아이의 *현재* 축을 바꿀 뿐 과거 기록을 다시 칠하지 않으며(ENG-011 "작성 후 케이스가 바뀌어도 소속 불변"), 전환 시 `birth_date` 최초 설정은 T2 의 "수정" 이 아니다(그 시점 양육 축 기록 = 공집합). 이를 놓치면 **임신기 기록 전체가 "생후 -N개월" 로 오염**되므로 구현상 최대 함정으로 경고 기재. ④ **재계산은 전량 재산출** — 델타 이동 금지(오차 누적 + ENG-001 clamp·경계 우회). 멱등이므로 실패 시 단순 재시도. ⑤ **컬럼 nullable 필수** — AC-002-05 단계 없음 상태 작성분, 그리고 정정 결과가 단계 없음이 되는 경우(예정일을 5주 이상 과거로) NULL 로 덮인다. ⑥ **AC-002-03 조건 정정** — 기존 "이후 아이의 단계가 바뀌어도 변하지 않는다" 가 시간 경과와 기준값 정정을 구분하지 못했다. 시간 경과·출산 전환 = 불변 / 기준값 정정 = 재계산 으로 3분기. ⑦ **ENG-011 정정** — "스냅샷 컬럼 저장 여부는 구현 재량이며 소급 계산이 항상 가능하므로 기존 기록 백필은 불필요" 문장이 물리 저장 채택으로 거짓이 되어 ENG-013 참조로 교체(도입 시 1회 백필 필요). ⑧ 용어집 `StageSnapshot` 행 갱신(`ChildStage \| null`, 물리 저장·재계산). ⑨ TEST-002 에 TC-002-03-C 추가(정정 반영 · 작성일 불변 · 되돌림 멱등 · **전환은 비트리거** 4점 단정), 10→11 TC. AC·집계 무변동. | 스냅샷 저장 방식 구현 재량, ENG 12개, TEST-002 10 TC | 물리 저장+재계산 확정, ENG 13개(ENG-013 신설), TEST-002 11 TC |
| 2026-08-08 양육 축 질문 풀 구간 확정 | PRD-002 개정에서 열어 둔 "생후 나이 질문 풀의 구간 단위" 를 **확정**. 양육 축 풀 구간을 **1년차 1개월 · 2년차 3개월 · 3년차 6개월 · 4년차 이후 1년** 티어로 정의 (첫 3년 = 18구간, 이후 매년 +1). 근거: 신생아기는 한 달마다 아이가 달라지지만 세 살 이후엔 반년이 지나도 질문의 결이 크게 달라지지 않아, 균일 구간이면 초기엔 질문이 뭉툭해지고 후기엔 문항 제작 비용만 늘어난다. ① PRD-002 "질문 풀 구간" 절 신설 — 티어 표 + **반개구간 `[시작, 끝)`** 규칙(정확히 12개월인 아이는 2년차 첫 구간) + 개월은 ENG-001 달력 기준. ② **표기 임계와 구간 경계의 불일치를 의도로 명문화** — PRD-007 AC-007-01 의 표기 전환은 12/13개월, 본 티어 경계는 12개월. 표기 형식과 풀 구간은 독립 관심사이므로 한쪽에 맞춰 다른 쪽을 "고치지" 말 것을 경고로 기재. ③ ENG-002 본 구현 범위를 갱신 — 구간 단위는 확정, 남은 것은 **각 구간의 문항 구성**과 최상위 흡수 구간(n살 이상 통합) 여부. ④ 출산 전환 히스토리 처리에 **기본 방침 "보존"** 기재(비가역성 + 보존 비용 무시 가능). AC·TEST·집계 무변동 — 기존 AC-002-02 조건의 구현 세부를 채운 것이라 새 AC 를 만들지 않았다. | 양육 축 구간 단위 미정 (ENG-002 선행 과제), AC 70 | 양육 축 4티어 확정, AC 70 (무변동) |
| 2026-08-08 커뮤니티 탭 mockup 신설 | **M-43 (커뮤니티 메인 피드) 추가** — PRD-009 확정 이후 잔존하던 "커뮤니티 탭 mockup 미작성" 공백의 부분 해소. ① `mockups/source/src/screens/Community.tsx` 신설 — AC-009-02(화면 구조 5블록 + 피드 카드 구성)·AC-009-03(유사 시기 상태값 표시, 수동 필터 미제공)·AC-009-04(오늘의 질문 카드 라벨·질문·안내 문구·CTA)·AC-009-06(전체/질문답변/자유일기, 기본값 전체)·AC-009-08(공감 표기)·AC-009-10(마스킹 표시명 `seo***1` 형식·태명/사진 비노출) 시각화. AC-009-01 준수로 글쓰기 버튼 없음. ② `App.tsx`·`GalleryScreen.tsx` 등재 — 여정 문서가 없어 JOURNEY 그룹이 아닌 **`PRD-009` 그룹**으로 분리 등재(여정 미작성을 갤러리에서 가시화). ③ 번호는 PRD-009·tracker 가 예고한 M-40 이 아니라 **M-43** — M-40~42 는 #142 에서 일기 사후 관리 3종이 선점. ④ **번들은 `docs/index.html`**: #176 의 GitHub Pages 전환으로 번들 경로가 `docs/mockups/index.html` → `docs/index.html` 로 이동했고 M-40~42 드리프트도 그 빌드에서 해소됐다. 본 PR 은 새 경로에 동일 파이프라인(vite build + html-inline, 394K)으로 재빌드해 M-43 을 반영한다. ⑤ `mockups/README.md` 42→43 갱신 (V-008 가치 매핑 행 신설, Pages 진입점 문구 유지). | mockup 42 (문서=소스=번들, #176 기준), 커뮤니티 화면 0 | mockup **43** (문서=소스=번들 동기화), 커뮤니티 화면 1 (메인) ⚠️ 상세·모아보기·빈 상태 미작성 |
| 2026-08-08 질문 모델 단계 일반화 | **PRD-002 질문 모델을 임신 주차 전용 → 아이 단계(임신 주차 \| 생후 나이)로 일반화**. 배경: PRD-006 AC-006-06(출산 전환)·PRD-007 AC-007-01(헤더 컨텍스트)·PRD-008 AC-008-03(기록 칩)·ENG-011(유사 시기 ±4주/±1개월)은 이미 양축을 다뤘으나 PRD-002·V-005·용어집·ENG-002 만 임신 전용으로 잔존해, **Case C 및 출산 전환 완료 사용자에게 질문 모델상 대상이 정의되지 않은 공백**이 있었다. ① **VDOC-001 V-005 개정** — "임신 주차별 맞춤 질문" → "아이 단계별 맞춤 질문" (**ID 유지**; 가치의 본질은 "그 시기에만 느낄 수 있는 감정 포착"이고 임신은 그 한 종류라는 판단). ② **PRD-002 전면 개정** — "질문 모델" 절 신설(단계를 **기본 속성**으로 규정, 두 축 배타·케이스 혼합 금지·단계 스냅샷은 작성 당시 기준이며 물리 저장은 구현 재량 = ENG-011 방침 준용), AC-002-01·02·03·04 를 양축으로 재작성, **AC-002-05(단계 산출 불가 시 폴백 — 단계 무관 공용 풀 + 단계 표시 생략) 신설**. ③ **ENG-001 확장** — 제목을 "아이 단계 산출 정책"으로 바꾸고 생후 나이 산출(출생 당일=1일째, 개월은 30일 나눗셈이 아닌 **달력 기준**, 상한 없음)·양축 비교표·단계 산출 불가 판정을 추가. ENG-011 이 "계산식은 ENG-001 준용"으로 참조하는데 정작 생후 나이 산출이 없던 **죽은 참조를 해소**. ④ **ENG-002 일반화** — 플레이스홀더의 개정 후 gap 표 명시(단일 풀 = 신규 gap, AC-002-05 는 "우연히 충족"이나 분기 부재), 본 구현 범위에 양육 축 구간 단위·폴백 풀·**아이 단위 히스토리 키**(유저 단위면 다자녀에서 중복 누출)·출산 전환 시 히스토리 처리 추가. ⑤ **용어집** — `DailyQuestion` 정의 갱신 + `ChildStage`·`PostnatalAge`·`StageSnapshot` 3행 추가. ⑥ **TEST-002 개정** — 4→10 TC (임산부/양육자 분기, 케이스 혼합 금지, 단계 스냅샷 불변성, 폴백 2건). ⑦ 하위 참조 정합 — PRD-006·007·009 제공 가치 문구, PRD-007 AC-007-04(단계 풀 참조), 여정 4편 가치 매트릭스 헤더, birth-conversion "V-005 마지막 작동 지점" 서술 정정(**축 전환 지점**으로), mockups README, design-system 카피. | AC 69 (검증 68+제외 1), V-005 임신 전용, ENG-001 임신 주수만, TEST-002 4 TC, ✅22·⬜46 | AC 70 (검증 69+제외 1), V-005 단계 일반화, ENG-001 양축, TEST-002 10 TC, ✅22·⬜47 |
| 2026-08-07 flow 헤더 AC 선언 정규화 | AC↔flow 매핑의 **선언 형식** 정합 (reconciler rct_20260807-0002): ① #169(PRD-009 슬라이스 2)가 `home-feed.yaml` 헤더를 `AC-009-14 + AC-009-13` 2개 선언으로 바꿔 규칙 #2(파일→AC 유일)를 깬 것을 **단일 AC 선언으로 복원**. 빈 상태는 AC-009-13 이 아니라 AC-009-14 자신의 조건이다 — PRD-009 AC-009-14 조건 마지막 줄이 "공개 기록이 0건이면 mock data 를 표시하지 않고 빈 카드 + `첫 기록을 공개해보세요` CTA" 를 직접 규정하고 TEST-009 TC-009-14-B 도 `검증 대상: AC-009-14` 로 선언한다. AC-009-13(빈/예외 상태) 전용 검증은 커뮤니티 피드·필터·상세의 문구 6종을 보는 `community-empty-states.yaml`(TC-009-13) 이며 커뮤니티 탭 화면이 29줄 플레이스홀더인 동안 ⬜ 후속으로 유지된다. ② 위 불변식("모든 제품 flow 는 헤더에 정확히 1개 AC 를 선언한다")이 실측으론 22개 중 13개에서만 참이었다 — 관례 도입 이전에 작성된 legacy flow 8건(`diary-detail-and-back`·`diary-edit`·`diary-delete-confirm`·`diary-visibility-toggle`·`diary-filter-by-child`·`home-book-progress`·`onboarding-caseA`·`onboarding-caseB`)이 서술형 주석 안에 AC 를 언급만 하고 `검증 대상:` 헤더가 없어 등재 규칙 (1) 미충족이었다. 8건 모두 헤더 한 줄을 추가해 정규화(지목 AC 는 기존 주석·매핑 표와 동일, 매핑 변경 0건). 이제 `grep -h "검증 대상" e2e/maestro/*.yaml` 로 불변식이 기계 검증된다. 주석 전용 변경 — flow 커맨드·앱 코드·CI run-list 무변경, 집계 무이동. | 제품 flow 22개 중 13개만 `검증 대상:` 헤더에 정확히 1개 AC 선언 (묶음 1 = `home-feed.yaml`, 헤더 없음 8), ✅22·⬜46·🟡0·1차제외1 | 제품 flow **22/22** 가 정확히 1개 AC 선언 (묶음 0·중복 0·헤더 누락 0), 선언 AC 22개 == 매핑 표 ✅ 22행 (파일명까지 일치), ✅22·⬜46·🟡0·1차제외1 |
| 2026-08-06 AC-002-01 flow 신설 | AC↔flow 1:1 잔여 gap 축소 1건 (reconciler rct_20260731-0001): AC-002-01(오늘의 질문 표시 — PRD-002) 전용 e2e flow `daily-question-display.yaml` 신설 — CI 실행 형제 `home-question-card-undecided.yaml`(AC-007-04)·`home-question-reroll.yaml`(AC-007-05)와 동일 Case A 서브플로우(tester-login-fast·onboarding-q1-q2-caseA·onboarding-caseA-full) 재사용, 홈 질문 카드의 오늘의 질문 본문·임신 주차 컨텍스트 노출을 testID `home-question-card`·`home-question-card-context`·`home-question-card-question` 으로 단정(한국어 부분문자열 회피 — testID 노출만). 주검증 요소 `home-question-card-question` 은 기존 어떤 flow 도 단정하지 않아 AC-007-04(카드+CTA 구성)와 매핑이 겹치지 않는다(모델 규칙2: 헤더 선언 AC 1개, 셋업 경유는 미검증). 조건3 "짧은 안내 문구" 마이크로카피는 e2e 밖 잔여 = dailyQuestions 단위 + 수동 QA. 매핑 ⬜→✅, backlog 34→33. 신규 subflow 0, 앱 코드·CI run-list 무변경(형제 카드 flow와 동일하게 파일 단위 1:1 충족). *(주: 2026-08-01 스테이징된 PR #163 을 2026-08-05 PRD-009 확정 이후 main 기준으로 rebase 하며 카운트를 새 baseline 에 맞춰 재작성)* | ✅21·⬜47·🟡0·1차제외1, AC-002-01 ⬜ 후속 | ✅22·⬜46·🟡0·1차제외1, AC-002-01 ✅ `daily-question-display.yaml` |
| 2026-07-30 AC-007-05 flow 신설 | AC↔flow 1:1 잔여 gap 축소 1건 (reconciler rct_20260729-0001): AC-007-05(오늘의 질문 카드 — 다른 질문 보기) 전용 e2e flow `home-question-reroll.yaml` 신설 — CI 실행 형제 `home-question-card-undecided.yaml`(AC-007-04)와 동일 Case A 서브플로우(tester-login·onboarding-q1-q2-caseA·onboarding-caseA-full) 재사용, 회전 footer 인덱스 testID `home-question-card-index` 를 ASCII `n/3`(1/3→▶2/3→▶3/3→▶(상한 무시)3/3→◀2/3, TC-007-05 step 1-5)로 단정. 한국어 부분문자열 회피(testID+ASCII만) — 회전·상한 로직은 app/(tabs)/index.tsx handleNext/PrevQuestion 클램프 + getDailyQuestionTriplet(항상 3개)로 소스 확인. 자정 초기화(step 6)는 e2e 밖 잔여 = dailyQuestions 단위 + 수동 QA. 매핑 ⬜→✅, backlog 35→34. 신규 subflow 0, 앱 코드·CI run-list 무변경(형제 카드 flow와 동일하게 파일 단위 1:1 충족). | ✅20·⬜35·🟡0, AC-007-05 ⬜ 후속 | ✅21·⬜34·🟡0, AC-007-05 ✅ `home-question-reroll.yaml` |
| 2026-07-27 AC-008-10 flow 신설 | AC↔flow 1:1 잔여 gap 축소 1건 (reconciler rct_20260726-0001): AC-008-10(일기 탭 헤더 + 하단 네비게이션 바) 전용 e2e flow `diary-header-nav.yaml` 신설 — 검증된 Case B 서브플로우(tester-login·onboarding-q1-q2-caseB·onboarding-caseB-full) 재사용(home-header-multichild와 동일 다자녀 셋업), 일기 탭 헤더 diary-header/diary-header-bell 노출 + home-header-prev/next/name 부재(TC-008-10-A) + 하단 5탭 tab-button-{memoir,community,home,diary,settings} 구성·현재 일기 탭(TC-008-10-B) 단정. 매핑 ⬜→✅, backlog 36→35. 신규 subflow 0, 앱 코드·CI run-list 무변경(형제 헤더/네비 flow와 동일하게 파일 단위 1:1 충족). | ✅19·⬜36·🟡0, AC-008-10 ⬜ 후속 | ✅20·⬜35·🟡0, AC-008-10 ✅ `diary-header-nav.yaml` |
| 2026-07-22 AC-007-01 flow 신설 | AC↔flow 1:1 잔여 gap 축소 1건 (reconciler rct_20260722-0001): AC-007-01(헤더 — 활성 아이 컨텍스트 표시) 전용 e2e flow `home-header-active-child.yaml` 신설 — 검증된 Case A 서브플로우(tester-login·onboarding-q1-q2-caseA·onboarding-caseA-full) 재사용, 헤더 이름 노출 + 컨텍스트 라벨 임산부 포맷(`[0-9]+주차`\|`D-[0-9]+`, TC-007-01-A/B) 정규식 단정. 매핑 ⬜→✅, backlog 37→36. 앱 코드·CI run-list 무변경(형제 헤더 flow와 동일하게 파일 단위 1:1 충족). | ✅18·⬜37·🟡0, AC-007-01 ⬜ 후속 | ✅19·⬜36·🟡0, AC-007-01 ✅ `home-header-active-child.yaml` |
| 2026-07-20 경계 재프레이밍 | 예외 모델 전환 (reconciler rct_20260712-0001 3차 재계획, 사용자 반려 ①②반영): "AC 단위 e2e-불가 목록"을 폐기하고 **외부 호출 모킹 경계 레지스트리(MB-1~6)**로 재구성. 경계마다 결정적 치환 최소부분 vs 실 e2e 구동 구간 vs 잔여를 명시(①: 불가능 부분만 모킹·나머지 실 e2e / ②: AC 아닌 라이브러리·서비스 단위 기술). 앵커는 구현된 seam MB-1(오디오/STT `EXPO_PUBLIC_E2E_AUDIO_FIXTURE`)·MB-2(OAuth tester-login). 남은 예외 7건(002-04·003-01·004-03·005-01·005-03·005-08·006-05)을 전부 ⬜ 후속(경계 참조)으로 승격 → **영구 예외 AC 0**. docs/doc-tracker.md 1파일만 변경(maestro·앱·워크플로 무변). | 예외 7건 등재(AC 단위 "e2e 불가"), 후속 30, ✅18·🟡7·⬜30 | 영구 예외 0, 외부 호출 경계 6개 등재(2 구현·4 신설), 후속 37, ✅18·🟡0·⬜37 |
| 2026-07-12 첫 정비 · 2026-07-15 재정비 | AC↔e2e flow 1:1 정합성 정비 (reconciler rct_20260712-0001): 55개 AC 매핑 표 + 예외 목록 신설, TC-선언 헤더 4건 AC 정규화(header-multichild→AC-007-02, notification-dot→AC-007-03, nav-5tabs→AC-007-10, caseC→AC-006-04), 묶음·중복 flow 를 헤더 단일-AC 재선언으로 정리(비-CI 트윈 `home-record-modal-entry.yaml` 삭제, CI 실행 flow `home-record-ctas`→AC-007-06 단독 소유, `home-voice-record`→AC-001-01 재배치). **2026-07-15 재계획**: 예외를 "본질적 e2e 구동 불가"로 한정해 12→7 축소(AC-001-02·003-04·004-04·007-09·002-02 를 후속 backlog 로 재분류), 삭제 대상을 ctas→modal-entry 로 교정해 CI 결함(워크플로가 참조하는 flow 삭제) 해소(워크플로 무수정). 새 flow 저작은 후속. | 다대다: AC 55 vs flow 21, 묶음 5·중복 5·TC-선언 4·AC 예외 0 | 제품 flow 18개 각 AC 1개 단독, 예외 7건 등재(본질적 e2e 불가만), 후속 30건 명세; 중복·묶음 0 |
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
| 2026-07-09 | **인증을 엔지니어링 노트로 관리하기로 결정 — `login.yaml` 고아 e2e 해소**: e2e flow ↔ AC 매핑 점검에서 `login.yaml` 이 어떤 AC 도 참조하지 않는 고아 테스트로 확인됨(당시 PRD 8개 어디에도 로그인·인증 명세 없음). 초안에서 PRD-009/TEST-009 를 신설했으나, 인증은 사용자 제공 가치가 아니라 기반 계층이고 이미 `engineering/ENG-003-client-login-process.md` 에 상세 리포트가 있으므로 **PRD/AC 가 아닌 엔지니어링 노트로 관리하기로 방향 변경**. ① 로그인 리포트에 frontmatter 부여(ENG-003, doc_type: engineering-note) + `verified_by` 에 login.yaml/tester-login 명시. ② `login.yaml` 헤더를 ENG-003 매핑으로 갱신(제품 AC 아님). ③ `health.yaml` 은 스모크 예외로 분류. ④ doc-tracker 에 "e2e flow 매핑" 섹션 신설 — e2e 는 AC/엔지니어링 노트/예외 중 하나에 매핑되어야 한다는 규칙과 현황표. ⑤ PRD-009/TEST-009 는 두지 않음(엔지니어링 노트는 TEST 문서를 갖지 않는 ENG-001·002 방침과 동일). **PRD/AC/TEST 계층 카운트 변동 없음**: PRD 8 · AC 55 · TEST 8. | 고아 e2e flow 2건(login·health) | 고아 e2e flow 0건 — login→ENG-003, health→스모크 예외 ✅ |

| 2026-07-15 | **PRD-009 (커뮤니티 탭) draft 편입**: 최서영의 「0704 커뮤니티(WIP) 기획안」을 PRD 형식으로 변환해 문서 체계에 편입. ① `prd/PRD-009-community-tab.md` 신규 — `status: draft`, AC 13개 (콘텐츠 출처·메인 화면·유사 시기 추천·오늘의 질문 카드·같은 질문 모아보기·타입 필터·상세/공개 수명주기·공감·댓글·개인정보/사진 보호·신고·알림·빈/예외 상태). 원문 4-1~4-19 전 섹션 반영, 원문↔PRD 매핑표 포함. V-002·V-005 매핑 (기존 검토 항목 "커뮤니티 가치는 현재 V-002 매핑" 방침 유지). ② PRD-007 AC-007-08/09 (홈 타인 기록 피드)의 확장 화면으로 상호 참조. ③ **의도된 미완**: TEST-009·커뮤니티 여정·mockup 은 draft 해제 후 작성 — 미검증 AC 위험으로 등재. ④ 원문 미기재 공백(피드 정렬 기준, 유사 시기 범위, 닉네임 마스킹 규칙 등)을 PRD 내 "미확정·후속 검토 항목"으로 명시. | PRD 8, AC 55 | PRD 9 (확정 8 + draft 1), AC 68 (확정 55 + draft 13) ⚠️ |
| 2026-08-05 | **PRD-009 확정 기반 작업 (1/2)**: PRD-009 미결 사항 전수 결정(결정 원장은 claude-docs `20260805-dear-baby-prd-009-decisions`) 후 주변 문서 선행 정합. ① PRD-001 AC 2건 신설 — AC-001-06(작성 시점 공개/비공개, **기본 비공개**, V-008 연결)·AC-001-07(임시 저장 로컬 보관, 코드 `app/src/drafts/` 문서화). TEST-001에 TC-001-06·07 추가. ② PRD-007 AC-007-08/09 이관 스텁화 — 카드 명세는 PRD-009 AC-009-14(예정)로, 노출 로직은 ENG-007·008·010 초안으로. `home-feed.yaml`은 과도기 등재. ③ PRD-008 — AC-008-06을 delete marker(ENG-012)와 정합화(모달 공감·댓글 문구, 커뮤니티 소멸 명시), AC-008-07의 죽은 참조("설정 탭 공개 기본값") 제거·비공개 기본 명시·모아보기 열람권 소멸 교차 참조. ④ ENG 정비 — 무번호 3편에 ENG-004~006 부여, ENG-007~010(노출 로직 4주제, draft)·ENG-011(유사 시기: ±4주/±1개월·케이스 분리·작성 시점 주차·정렬 가중치, **확정**)·ENG-012(delete marker, **확정**, 파기 기한 열린 항목) 신설. ⑤ glossary — 커뮤니티 개념 6행(공개 상태·임시 저장·공감·댓글·신고·커뮤니티 표시명 `MaskedDisplayName`) 추가, ID 체계 V-008·ENG 반영. PRD-009 본문 확정은 2/2에서. | AC 68 (확정 55: PRD-001 5·PRD-007 10), ENG 4, ✅21·⬜34 | AC 68 (확정 55: PRD-001 7·PRD-007 8), ENG 12 (확정 8·draft 4), ✅20·⬜35·과도기 1 |
| 2026-08-05 | **PRD-009 확정 (2/2)**: 기반 작업(1/2)에 이어 PRD-009 본문을 결정 원장대로 전면 반영하고 draft 해제. ① frontmatter `status: draft` 제거·DRAFT 경고를 확정 안내로 교체. ② AC 확정 — 01(AC-001-06/07 참조 연결)·02(표시명 정리·노출 로직 ENG 위임 명시)·03(slim: 상태값+전환 갱신+수동 필터 부재, 유사 시기는 ENG-011 참조)·04(ENG-002 고정 풀 전제 명문화)·05(재비공개 시 열람권 즉시 소멸)·07(V-001 제거, 삭제=소멸 대칭 명시)·08(본인 공감 불가 경로 무관+본인 댓글 준용)·09(작성자 표시명·배지 행)·10(**표시명 소스 확정: 이메일 로컬파트**, 앞3+`***`+끝1/4자↓ 첫1+`***`, `MaskedDisplayName`)·11(접수 플로우 신설, 로드맵 행 하단 표 단일화)·12(**1차 제외** — 설정 탭 보류)·13(홈 섹션 빈 상태 행)·**14 신설**(홈 피드 이관 수용, mock 삭제→빈 카드+CTA). ③ 1차 런치 표에 알림 제외·인기순 ENG-007 위임·차단 후순위의 iOS UGC 1.2 리젝 리스크 각주. ④ 미확정 섹션을 해소 이력 표로 교체. ⑤ TEST-009 신설(18 TC), TEST-007 TC 3건 이관 처리(17→14). ⑥ V-008 연결을 PRD-007에서 PRD-009로 이동(PRD-001·PRD-009 소유). ⑦ e2e: `home-feed.yaml`→AC-009-14 재매핑(✅ 복귀), 신규 ⬜ 12건 backlog 명세 등재. | PRD 9 (확정 8 + draft 1), AC 68 (확정 55 + draft 13), TEST 8, ✅20·⬜35·과도기 1 | PRD 9 전부 확정, AC 69 전부 확정 (검증 68 + 제외 1), TEST 9, ✅21·⬜47·제외 1 ✅ |
| 2026-07-15 | **V-008 (공감을 통한 연결) 신설**: 기존 검토 항목("커뮤니티 가치의 가치 문서 추가 여부") 해소. 커뮤니티의 1순위 목적 "나만 이런 게 아니구나"가 V-002(부담 제거)로 환원되지 않는 독립 가치라 판단, VDOC-001에 추상적 가치로 추가. ① `values/product-values.md` V-008 추가. ② PRD-007: delivers_values·제공 가치·AC-007-08/09에 V-008 반영 (홈 타인 기록 피드가 기존 구현체). ③ PRD-009: 제공 가치 재서술(V-008 주 가치화) + AC 13개 매핑 교정 — 공감·연결 계열(03·05·06·11은 V-008로 이관, 01·02·04·07·08·09·12는 V-008 병기), 위생·안내 계열(10·13)은 V-002 유지. "콘텐츠 축적"·"장기 수익화"는 사업 목표로 판단해 가치 미등재. ④ 테스트 문서는 AC ID 기준 참조라 변경 없음 — 정합성 유지 확인. | 가치 7 | 가치 8 (V-008: PRD-007 확정 + PRD-009 draft 연결) |

## 향후 검토 항목

### PRD-006에서 도출됨

- **태명 수집 무문서 drift (2026-08-05 발견)**: 온보딩이 태명(`nickname`, `fetuses/children.nickname`)을 수집·표시하는데 PRD-006 AC 어디에도 수집 항목으로 명시돼 있지 않다 — AC-006-02/04 입력 명세 보강 필요
- 임신 X · 양육 X 케이스의 정식 정의
- 사산/유산 케이스의 출산 전환 분기 처리
- 아이 전환 탭의 정렬 규칙
- 설정 탭의 "아이 추가" 진입점 위치 (AC-006-10 후속)

### PRD-002에서 도출됨 (2026-08-08)

- ~~생후 나이 질문 풀의 구간 단위~~ — **2026-08-08 확정**: 1년차 1개월 · 2년차 3개월 · 3년차 6개월 · 4년차 이후 1년 (첫 3년 18구간, 반개구간). PRD-002 "질문 풀 구간" 표. 잔여는 각 구간의 **문항 구성**(ENG-002)과 최상위 흡수 구간 여부
- **단계 무관 공용 폴백 풀의 문항 구성** — AC-002-05 폴백 풀의 문항 수·톤. 현재 플레이스홀더 12문항 재활용 가능성 검토
- **출산 전환 시 질문 히스토리 처리** — 아이의 축이 임신 → 양육으로 바뀔 때 그 아이의 임신 풀 히스토리를 **삭제할지 남길지**. ENG-002 에 **기본 방침 "보존"** 을 기재 (삭제는 비가역이고, 오입력 전환을 되돌리면 임신기 질문이 중복 노출된다). 사용자 확정 대기
- ~~단계 스냅샷의 물리 저장 여부~~ — **2026-08-08 확정**: 물리 저장 + 기준값 정정 시 재계산 (ENG-013 신설). 잔여는 컬럼명·타입(구현 시)

### PRD-007에서 도출됨

- ~~오늘의 질문 풀 구체 구성과 회전 알고리즘 (PRD-002와 통합 검토)~~ — **2026-08-08 부분 해소**: 풀의 **분기 축**(단계별·케이스 분리)은 PRD-002 질문 모델로 확정. 풀의 구체 문항 구성과 회전 알고리즘은 ENG-002 본 구현으로 존속
- 회전 한도(3개)·자정 초기화의 사용자 안내 카피
- 책 진행도 임계값 50의 실데이터 기반 재산정
- 책 진행도 `(?)` 안내 모달의 사용자 친화적 카피
- 타인 기록 피드 답변 노출 글자 수 디자인 단계 확정
- 타인 기록 피드 정렬 알고리즘 (하트 수 외 최신·조회수 도입 여부, 노출 다양성)
- 타인 기록 피드 노출 풀 범위 (유사 주차 우선 등)
- ~~커뮤니티 가치(공감을 통한 동기부여)의 가치 문서 추가 여부~~ — **2026-07-15 해소**: V-008 (공감을 통한 연결) 신설. PRD-007 AC-007-08/09 및 PRD-009에 매핑

### PRD-009에서 도출됨

- ~~draft 해제~~ · ~~정렬~~ · ~~유사 시기 범위~~ · ~~마스킹 규칙~~ · ~~아이 전환 갱신~~ · ~~페이지네이션~~ · ~~신고 처리 범위~~ — **2026-08-05 전수 해소** (PRD-009 "미확정 항목 해소 이력" 표 참조). 노출 로직 4주제는 ENG-007~010 초안으로 존속(확정 시 재개발), 나머지는 AC·ENG-011·012로 확정
- **커뮤니티 사용자 여정 문서** — 잔존 (mockup M-43 이 여정 stage 없이 AC 직접 매핑 상태)
- **커뮤니티 탭 잔여 mockup** — 2026-08-08 M-43(메인) 추가로 부분 해소. 게시글 상세(AC-009-07)·같은 질문 답변 모아보기(AC-009-05)·공개 전환 유도 팝업(AC-009-04·05)·빈/예외 상태(AC-009-13)·신고 시트(AC-009-11) 미작성
- **ENG-007~010 (노출 로직) 제품 결정** — 초안 확정 시 재개발 + `home-feed-exposure` 계열 검증을 ENG 매핑으로 정의
- **ENG-012 파기 기한 결정** — delete marker 후 물리 파기 유예 기간·탈퇴 시 처리·파기 배치
- **차단 기능의 1차 편입 재검토** — iOS UGC 심사(1.2) 리젝 리스크 (PRD-009 1차 런치 표 각주)
- **커뮤니티 알림 재개** — 설정 탭 확정 후 AC-009-12 재정의

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
