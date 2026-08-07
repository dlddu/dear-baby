---
doc_id: TRACKER-001
doc_type: tracker
product: dear_baby
created: 2026-05-02
updated: 2026-08-05
---

# 디어베이비 문서 체계 상태 추적

## 현재 상태 요약 (2026-08-05 기준)

- 정의된 가치: **8개** (V-001 ~ V-008)
- 가치 문서: **1개** (VDOC-001)
- PRD: **9개** (PRD-001 ~ PRD-009, **전부 확정** — PRD-009는 2026-08-05 확정)
- Acceptance Criteria: **69개 전부 확정** (검증 대상 68 + 1차 제외 1) — 2026-08-05: PRD-001 +2 신설, PRD-007 -2 이관, PRD-009 13개 확정 + AC-009-14 신설(홈 피드 이관 수용) + AC-009-12(알림)는 1차 런치 제외로 확정
- 테스트 문서: **9개** (TEST-001 ~ TEST-009) — 전 PRD 커버 (TEST-009는 18 TC, 2026-08-05 신설)
- 사용자 여정: **6개** (Onboarding · Daily Recording · Birth Conversion · AI Narrative · Book Production · Diary Browsing)
- 흐름도: **1개** (onboarding-flow.md)
- Mockup: **39개 화면** (M-01 ~ M-39, 일부 결번) + 갤러리, 단일 React 번들 `mockups/index.html`. 모든 사용자 여정 stage 1:1 매핑
- 엔지니어링 노트: **12개** — ENG-001 주차 계산 · ENG-002 주간 질문(deferred) · ENG-003 로그인 · ENG-004 AI preview scopes · ENG-005 오디오 저장 · ENG-006 로그아웃 (004~006은 2026-08-05 기존 문서 ID 부여) · ENG-007 피드 기본 정렬(draft) · ENG-008 노출 풀(draft) · ENG-009 페이지네이션(draft) · ENG-010 본인 기록 노출(draft) · ENG-011 유사 시기 추천(**확정**) · ENG-012 삭제 delete marker(**확정**)
- 용어집: **1개** (GLOSSARY-001)
- e2e flow (Maestro): AC↔flow 1:1 매핑 확정 — 제품 flow 23개(각 AC 1개 단독, `home-feed.yaml`은 AC-009-14로 재매핑 완료) + 후속 flow 45건(미작성 — PRD-009 확정 AC 12건 신규 편입). **영구 예외 AC 0건** — 자동화 곤란은 AC가 아니라 외부 호출 모킹 경계 6개(2 구현·4 신설)로 등재(경계만 결정적 치환, 나머지 구간은 실 e2e). + 엔지니어링 노트 1개(`login.yaml`→ENG-003) + 스모크 예외 1개(`health.yaml`). 상세는 "e2e flow 매핑" 섹션 참조
- **건강 상태**: ✅ 건강 — **PRD-009 확정 완료 (2026-08-05)**. 편입 당시 미확정 13건을 전수 결정(결정 원장: claude-docs `20260805-dear-baby-prd-009-decisions`)해 draft 해제. 노출 로직(정렬·노출 풀·페이지네이션·본인 기록)은 의도적으로 AC 밖 ENG-007~010 초안으로 분리(확정 시 재개발), 유사 시기(ENG-011)·delete marker(ENG-012)는 확정. 잔여: 커뮤니티 여정·mockup 미작성(아래 향후 검토), e2e 신규 ⬜ 14건은 backlog 순차 소화(2026-08-07 AC-001-06 소화 → 13건)

## 연결 매트릭스

| 가치 | 가치 유형 | 연결된 PRD | 상태 |
|------|-----------|-----------|------|
| V-001 감정 보존 | abstract | PRD-001, PRD-003, PRD-004, PRD-005, PRD-006, PRD-007, PRD-008 | ✅ |
| V-002 기록의 부담 제거 | abstract | PRD-001, PRD-002, PRD-005, PRD-006, PRD-007, PRD-008, PRD-009 | ✅ |
| V-003 서사적 의미 부여 | abstract | PRD-003, PRD-004, PRD-007, PRD-008 | ✅ |
| V-004 음성-텍스트 자동 변환 | concrete | PRD-001 | ✅ |
| V-005 임신 주차별 맞춤 질문 | concrete | PRD-002, PRD-006, PRD-007, PRD-009 | ✅ |
| V-006 실물 책 완성품 | concrete | PRD-004, PRD-006, PRD-007 | ✅ |
| V-007 멀티미디어 감정 표현 | concrete | PRD-005, PRD-006, PRD-008 | ✅ |
| V-008 공감을 통한 연결 | abstract | PRD-001, PRD-009 | ✅ |

## PRD ↔ 테스트 커버리지

| PRD | AC 수 | 테스트 | 커버 상태 |
|-----|------|--------|----------|
| PRD-001 음성 일기 기록 | 7 | TEST-001 (7 TC) | ✅ |
| PRD-002 매일 다른 질문 알림 | (기존) | TEST-002 | ✅ |
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
| `login.yaml` | 엔지니어링 노트 | ENG-003 (`engineering/client-login-process.md`) | 테스터 로그인 게이트 + 세션 수립 후 온보딩 분기(§3.3·§4·§9). **실제 15탭 제스처를 구동하는 유일한 flow.** OAuth 경로는 외부 계정 의존으로 수동 QA |
| `subflows/tester-login.yaml` | (헬퍼) | — | 실제 제스처 서브플로우. `login.yaml` 전용. 독립 검증 단위가 아님 |
| `subflows/tester-login-fast.yaml` | (헬퍼) | — | 로그인을 준비 단계로만 쓰는 나머지 flow **전부**가 쓰는 단축 진입점(E2E 빌드 한정). 독립 검증 단위가 아님 |
| `subflows/tester-login-credentials.yaml` | (헬퍼) | — | 위 두 진입점이 공유하는 자격 증명 입력·제출 구간. 독립 검증 단위가 아님 |
| `health.yaml` | 예외(스모크) | — | 앱 부팅 + 백엔드 도달 스모크. 랜딩 헬스체크 토스트 UI 의 승격 여부는 ENG-003 향후 검토 |

**등재 규칙**: (1) flow 헤더에 `검증 대상:` 주석과 근거를 남기고, (2) 본 표에 등재한다. `subflows/*.yaml` 은 테스트가 아니라 재사용 헬퍼이므로 매핑 대상이 아니다.

### AC ↔ e2e flow 매핑 (제품 AC 69개)

> 각 AC 는 (a) 전용 flow 1개(✅) · (b) 후속 flow(⬜, 미작성) 중 하나로 분류된다. **영구 예외 AC 는 없다** — 외부 서비스에 의존하는 AC 도 해당 외부 호출 경계만 결정적으로 치환하면 e2e 로 구동 가능하므로, "e2e 불가"를 AC 에 붙이지 않고 아래 [외부 호출 모킹 경계 레지스트리](#외부-호출-모킹-경계-레지스트리-mock-boundary-registry)에 경계(라이브러리/서비스) 단위로 등재한다. 모킹이 필요한 후속 AC 는 매핑에 경계 ID(MB-n)를 병기한다.
> 2026-07-12 첫 정비 · 2026-07-15 예외 재정비 · 2026-07-20 경계 재프레이밍 · 2026-07-22 AC-007-01 flow 신설 · **2026-07-27 AC-008-10 flow 신설** · **2026-07-30 AC-007-05 flow 신설** · **2026-08-05 PRD-001 AC 2건 신설 + AC-007-08/09 이관 + PRD-009 확정(AC 14건 편입, `home-feed.yaml`→AC-009-14 재매핑)** · **2026-08-06 AC-002-01 flow 신설** · **2026-08-07 AC-001-06 flow 신설** 기준: ✅ 23 · ⬜ 45 · 🟡 0 · 1차 제외 1(AC-009-12). 모든 제품 flow 는 헤더에 정확히 1개 AC 를 선언한다(중복·묶음 0). *(2026-08-05 reconciler rct_20260805-0001: `home-feed.yaml` 헤더 AC 재선언 완료 — AC-007-08/09·TC-007-08/09 → AC-009-14·TC-009-14-A, 참조 무결성 복구, flow 커맨드 무변경)*

| AC | 제목 | 매핑 |
|----|------|------|
| AC-001-01 | 음성 녹음 시작 및 종료 | ✅ `home-voice-record.yaml` |
| AC-001-02 | AI 음성-텍스트 변환 | ⬜ 후속 |
| AC-001-03 | 변환 텍스트 편집 | ⬜ 후속 |
| AC-001-04 | 텍스트 직접 입력 | ⬜ 후속 |
| AC-001-05 | 기록 목록 조회 | ⬜ 후속 |
| AC-001-06 | 작성 시점 공개/비공개 선택 | ✅ `record-visibility-select.yaml` |
| AC-001-07 | 임시 저장 — 업로드 전 로컬 보관 | ⬜ 후속 (MB-1) |
| AC-002-01 | 오늘의 질문 표시 | ✅ `daily-question-display.yaml` |
| AC-002-02 | 임신 주차별 질문 매칭 | ⬜ 후속 |
| AC-002-03 | 질문에서 기록으로 연결 | ⬜ 후속 |
| AC-002-04 | 질문 알림 발송 | ⬜ 후속 (MB-5) |
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
| **MB-2** | OAuth 신원 공급자 — `@react-native-google-signin/google-signin` + `expo-apple-authentication` | **구현됨**: tester-login 제스처 + `TesterLoginModal` (`app/src/auth/`) → 세션 토큰 발급 | 외부 Google/Apple 로그인 왕복만 | 세션 수립 후 모든 인증 flow (`login.yaml` · `subflows/tester-login.yaml`) | 실제 OAuth 제공자 계정 왕복 | (ENG-003 기반, 전 authed flow) |
| **MB-3** | 카메라/미디어 캡처 — expo 카메라·이미지 모듈 *(미도입)* | **신설**: `EXPO_PUBLIC_E2E_CAMERA_FIXTURE`(오디오 fixture 동형) → 캡처 시 canned 이미지/영상 파일 반환 | 디바이스 카메라 캡처만 | 촬영 CTA → 미리보기 → 첨부 → 기록 저장 전 구간 | 실제 카메라 하드웨어 화질 | AC-005-01, AC-005-03 |
| **MB-4** | AI 서사 생성(LLM) — 백엔드 LLM 공급자, 앱은 `react-native-sse` 로 스트리밍 수신 | **신설(백엔드)**: e2e 모드에서 백엔드가 결정적 canned 서사를 스트리밍 | LLM 비결정적 생성만 | 생성 트리거 → SSE 수신 → 서사 표시·편집 전 구간 | LLM 산출 **품질**(별도: 프롬프트/통합 단위 + 수동 QA) | AC-003-01, AC-005-08 |
| **MB-5** | 푸시 알림 도달 — OS 푸시(APNs/FCM); *앱 푸시 라이브러리 없음* — 서버 스케줄, 앱은 `app/src/api/notifications.ts` 로 조회 | **신설(백엔드)**: e2e 모드에서 예약 알림을 즉시 생성 → 앱이 알림 API 로 조회·표시 | OS 푸시의 디바이스 실도달만 | 알림 생성 → 조회 → 홈 알림 점·알림 목록 표시 전 구간 | 물리 디바이스 OS 푸시 실수신 | AC-002-04, AC-006-05 |
| **MB-6** | 결제 + 실물 제작·배송 — 결제 게이트웨이 + 제작 fulfillment; *네이티브 결제 라이브러리 없음* — 백엔드 주문 API | **신설(백엔드)**: e2e 모드에서 샌드박스/스텁 결제 승인 + 스텁 fulfillment 상태 | 실제 대금 청구 + 실물 제작·배송만 | 주문 구성 → 체크아웃 → 주문 확정·상태 추적 전 구간 | 실제 청구·실물 책 제작·배송 | AC-004-03, AC-004-04 |

> **경계별 후속**: MB-1·MB-2 는 구현 완료(해당 seam 재사용). MB-3~MB-6 은 seam 실구현(카메라 fixture, 백엔드 e2e 결정 모드)과 대응 신 flow 저작이 필요하고 앱 구동·백엔드 통합 검증을 요하므로 **경계별 후속 task** 로 분리한다. 각 경계의 "실제 구간"은 e2e 로 반드시 단정하고, "잔여"만 단위/통합 테스트·수동 QA 로 커버한다.
>
> **2026-07-15 예외 재정비 이력**: 이전 정비에서 예외를 "본질적으로 e2e 구동 불가"로 한정해 5건(AC-001-02·003-04·004-04·007-09·002-02)을 후속 flow 로 재분류했다. **2026-07-20** 본 재프레이밍은 남은 7건까지 전부 경계 등재로 흡수해 **영구 예외 AC 를 0건**으로 만든다.

**⬜ 후속 flow backlog** (45건 — 목표 flow / 단정 핵심; 새 maestro flow 는 앱 구동 검증이 필요해 후속 task 로 저작. 뒤 7건은 외부 호출 경계 모킹이 선행되는 승격분):

- **AC-001-02** AI 음성-텍스트 변환 → `record-stt-result.yaml`: 녹음 종료 → canned-transcript fixture 로 변환 결과 텍스트·로딩 상태 표시 (정확도 품질은 예외 — 단위/수동 QA)
- **AC-001-03** 변환 텍스트 편집 → `record-audio-review-edit.yaml`: 녹음 리뷰 화면에서 transcript 편집 후 저장 반영
- **AC-001-04** 텍스트 직접 입력 → `record-text-input.yaml`: 텍스트 CTA → record-text 입력 → 저장 → 목록/홈 반영
- **AC-001-05** 기록 목록 조회 → `record-list.yaml`: 저장된 기록이 목록에 노출·정렬
- **AC-002-02** 임신 주차별 질문 매칭 → `daily-question-week-match.yaml`: (blocked — 매칭 알고리즘·풀 회전 확정 후) 지정 주차에 해당 풀 질문 노출
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
| 2026-08-07 AC-001-06 flow 신설 | AC↔flow 1:1 잔여 gap 축소 1건 (reconciler rct_20260807-0001): AC-001-06(작성 시점 공개/비공개 선택) 전용 e2e flow `record-visibility-select.yaml` 신설 — backlog 등재명 `record-visibility-default.yaml` 대신 AC 제목(선택)에 맞춰 명명. 이 AC 는 **서버·API 는 이미 완성돼 있고 UI 토글만 없던** 경우라(backend records.Create 가 visibility 를 받아 검증·기본 private 저장, app src/api/records.ts 도 payload 에 이미 실어 보냄) 신규 컴포넌트 `VisibilityToggle` 을 두 저장 화면(record-text · record-audio-review)의 고정 footer 에 배선하는 것으로 닫았다 — 마이그레이션 0건, 백엔드 0줄. 선택 상태는 VisibilityBadge 와 같은 규약으로 **컨테이너 testID 접미사**(`-private`/`-public`)로 노출하고 칩 testID 는 `-option-*` 로 고정 — 칩 두 개는 항상 렌더되므로 칩 존재만으로는 선택 상태를 단정할 수 없다(한국어·이모지 부분 매칭 회피). AuthContext 의 create{Text,Voice}Record 옵션 타입이 `{subjectId, questionText}` 로 좁아 visibility 를 조용히 떨어뜨리던 것도 `CreateRecordOptions` 로 교정(tsc 로 검출). 저장된 값이 payload 에 실리는지는 신규 기록의 record id 를 flow 가 알 수 없어 (`diary-list-card-<id>` 특정 불가) e2e 밖 잔여 → app/app/__tests__/record-visibility.test.tsx(6 케이스)로 단정. 매핑 ⬜→✅, backlog 45 (헤더 stale 34 → 실측치로 교정; #163 AC-002-01 소화 반영 후 기준). 신규 subflow 0, CI run-list 무변경(신규 flow 미등재 — 직전 5개 슬라이스와 동일). | ✅22·⬜46·🟡0·1차제외1, AC-001-06 ⬜ 후속 | ✅23·⬜45·🟡0·1차제외1, AC-001-06 ✅ `record-visibility-select.yaml` |
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
| 2026-07-09 | **인증을 엔지니어링 노트로 관리하기로 결정 — `login.yaml` 고아 e2e 해소**: e2e flow ↔ AC 매핑 점검에서 `login.yaml` 이 어떤 AC 도 참조하지 않는 고아 테스트로 확인됨(당시 PRD 8개 어디에도 로그인·인증 명세 없음). 초안에서 PRD-009/TEST-009 를 신설했으나, 인증은 사용자 제공 가치가 아니라 기반 계층이고 이미 `engineering/client-login-process.md` 에 상세 리포트가 있으므로 **PRD/AC 가 아닌 엔지니어링 노트로 관리하기로 방향 변경**. ① 로그인 리포트에 frontmatter 부여(ENG-003, doc_type: engineering-note) + `verified_by` 에 login.yaml/tester-login 명시. ② `login.yaml` 헤더를 ENG-003 매핑으로 갱신(제품 AC 아님). ③ `health.yaml` 은 스모크 예외로 분류. ④ doc-tracker 에 "e2e flow 매핑" 섹션 신설 — e2e 는 AC/엔지니어링 노트/예외 중 하나에 매핑되어야 한다는 규칙과 현황표. ⑤ PRD-009/TEST-009 는 두지 않음(엔지니어링 노트는 TEST 문서를 갖지 않는 ENG-001·002 방침과 동일). **PRD/AC/TEST 계층 카운트 변동 없음**: PRD 8 · AC 55 · TEST 8. | 고아 e2e flow 2건(login·health) | 고아 e2e flow 0건 — login→ENG-003, health→스모크 예외 ✅ |

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

### PRD-007에서 도출됨

- 오늘의 질문 풀 구체 구성과 회전 알고리즘 (PRD-002와 통합 검토)
- 회전 한도(3개)·자정 초기화의 사용자 안내 카피
- 책 진행도 임계값 50의 실데이터 기반 재산정
- 책 진행도 `(?)` 안내 모달의 사용자 친화적 카피
- 타인 기록 피드 답변 노출 글자 수 디자인 단계 확정
- 타인 기록 피드 정렬 알고리즘 (하트 수 외 최신·조회수 도입 여부, 노출 다양성)
- 타인 기록 피드 노출 풀 범위 (유사 주차 우선 등)
- ~~커뮤니티 가치(공감을 통한 동기부여)의 가치 문서 추가 여부~~ — **2026-07-15 해소**: V-008 (공감을 통한 연결) 신설. PRD-007 AC-007-08/09 및 PRD-009에 매핑

### PRD-009에서 도출됨

- ~~draft 해제~~ · ~~정렬~~ · ~~유사 시기 범위~~ · ~~마스킹 규칙~~ · ~~아이 전환 갱신~~ · ~~페이지네이션~~ · ~~신고 처리 범위~~ — **2026-08-05 전수 해소** (PRD-009 "미확정 항목 해소 이력" 표 참조). 노출 로직 4주제는 ENG-007~010 초안으로 존속(확정 시 재개발), 나머지는 AC·ENG-011·012로 확정
- **커뮤니티 사용자 여정 문서 + 커뮤니티 탭 mockup (M-40~) 추가** — 잔존
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
