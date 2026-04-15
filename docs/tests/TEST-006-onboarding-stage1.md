---
doc_id: TEST-006
doc_type: test
product: dear_baby
verifies_design: design-system/onboarding.md
created: 2026-04-15
updated: 2026-04-15
---

# TEST-006: 온보딩 Stage 1 (감성 웰컴 + 예정일 입력) 테스트

## 대상 문서

- design-system/onboarding.md §Stage 1
- 구현: `app/app/(onboarding)/welcome.tsx`
- E2E 플로우: `app/.maestro/onboarding-stage1.yaml`,
  `app/.maestro/onboarding-stage1-skip.yaml`

## 전제 조건

온보딩 화면은 `AuthGate` 가 `status === 'onboarding'` 일 때 자동 라우팅되는
경로이다. 따라서 모든 테스트 케이스는 **로그인은 되어 있으나 `onboarded_at` 이
`null` 인 사용자** 를 사전 조건으로 둔다. CI 환경(Google OAuth client ID 미설정)
에서는 UI 를 통한 진입이 불가하므로, 이 문서의 E2E 는 로컬 dev build 또는
OAuth 가 주입된 환경에서 실행한다.

## 테스트 케이스

### TC-006-01: 온보딩 웰컴 화면 초기 상태 렌더링

- **검증 대상**: 감성 카피 및 단일 입력 필드 노출
- **사전 조건**: `status === 'onboarding'` 상태로 앱 진입
- **테스트 단계**:
  1. 앱을 실행한다
  2. `/(onboarding)/welcome` 으로 자동 라우팅되는지 확인한다
  3. 로고("DearBaby"), 인사말("반가워요, 엄마 🌷"),
     태그라인("아기를 기다리는 소중한 시간, 함께 기록해볼까요?") 이 보이는지
     확인한다
  4. "아기를 만날 예정일을 알려주세요" 카드 라벨과 "날짜 선택하기"
     placeholder 가 보이는지 확인한다
  5. `시작하기` 버튼과 `아직 정해지지 않았어요` 탈출구가 모두 노출되는지
     확인한다
- **기대 결과**: 설계 문서의 화면 구성대로 감성 카피, 단일 입력 필드,
  primary CTA, 탈출구가 정확히 한 화면에 모두 표시된다

### TC-006-02: 예정일 미선택 시 [시작하기] 버튼 비활성

- **검증 대상**: 유효성 가드
- **사전 조건**: 온보딩 웰컴 화면, 날짜 미선택 상태
- **테스트 단계**:
  1. `시작하기` 버튼을 탭한다
  2. 화면 전환이 일어나지 않는지 확인한다
- **기대 결과**: 날짜가 선택되지 않은 동안 `시작하기` 버튼은 동작하지 않으며
  홈으로 이동하지 않는다

### TC-006-03: 예정일 선택 → 한국어 포맷 표시

- **검증 대상**: 날짜 포맷 (`formatKoreanDate`, `YYYY년 M월 D일`)
- **사전 조건**: 온보딩 웰컴 화면
- **테스트 단계**:
  1. "날짜 선택하기" 필드를 탭해 date picker 를 연다
  2. iOS: 스피너에서 날짜를 선택 후 "완료" 를 탭한다
     Android: DatePickerDialog 에서 날짜 선택 후 "확인/OK" 를 탭한다
  3. date picker 가 닫힌 후 날짜 필드에 표시된 텍스트를 확인한다
- **기대 결과**: 날짜 필드가 placeholder 대신 `YYYY년 M월 D일` 패턴의
  한국어 포맷 날짜로 교체된다

### TC-006-04: 예정일 선택 → [시작하기] → 홈 이동 (해피 패스)

- **검증 대상**: `completeOnboarding(dueDate)` → `PATCH /me` → AuthGate 리라우팅
- **사전 조건**: TC-006-03 완료 (필드에 날짜 표시됨)
- **테스트 단계**:
  1. `시작하기` 버튼을 탭한다
  2. 버튼이 "저장 중…" 상태로 전환되는지 확인한다 (가능한 경우)
  3. `/(tabs)/` 홈 탭 (`testID=home-tab`) 이 나타날 때까지 대기한다
  4. 온보딩 웰컴 루트 (`testID=onboarding-welcome`) 가 화면에 더 이상
     보이지 않는지 확인한다
- **기대 결과**: `PATCH /me` 응답 후 `onboarded_at` 이 세팅되어
  `status` 가 `authenticated` 로 전환되며, 홈 탭으로 자동 이동한다

### TC-006-05: 탈출구 스킵 경로

- **검증 대상**: `completeOnboarding(null)` (예정일 미정 사용자)
- **사전 조건**: 온보딩 웰컴 화면, 날짜 미선택 상태
- **테스트 단계**:
  1. `아직 정해지지 않았어요` 를 탭한다
  2. 홈 탭 (`testID=home-tab`) 이 나타날 때까지 대기한다
- **기대 결과**: `due_date: null` 로 `PATCH /me` 가 호출되고 `onboarded_at`
  이 세팅되어, 예정일 없이도 온보딩이 완료되며 홈으로 이동한다

### TC-006-06: API 실패 시 에러 노출 및 복구

- **검증 대상**: 에러 핸들링 (`onboarding-error` testID)
- **사전 조건**: 백엔드 `/me` PATCH 를 실패하도록 유도 (네트워크 단절 또는
  500 응답 스텁)
- **테스트 단계**:
  1. 날짜를 선택한다
  2. `시작하기` 를 탭한다
  3. 에러 메시지 ("잠시 후 다시 시도해주세요.…") 가 `onboarding-error`
     testID 로 노출되는지 확인한다
  4. 버튼이 다시 활성화되어 재시도 가능한지 확인한다
- **기대 결과**: 홈으로 이동하지 않고 에러 문구가 표시되며, 같은 화면에서
  다시 시도할 수 있다

### TC-006-07: 과거 날짜/45주 이후 날짜 제한

- **검증 대상**: `MIN_DATE` / `MAX_DATE` 바운더리
  (`app/app/(onboarding)/welcome.tsx:35-40`)
- **사전 조건**: 온보딩 웰컴 화면, date picker 오픈 상태
- **테스트 단계**:
  1. Picker 에서 오늘 이전 날짜를 선택 시도한다
  2. Picker 에서 오늘로부터 45주 이후 날짜를 선택 시도한다
- **기대 결과**: 두 경우 모두 picker 에서 선택이 불가하다 (디바이스 네이티브
  DatePicker 가 범위를 제한함)

## 자동화 현황

| 케이스     | 자동화               | 파일                                              |
|-----------|----------------------|--------------------------------------------------|
| TC-006-01 | Maestro (해피/스킵)  | `app/.maestro/onboarding-stage1*.yaml`           |
| TC-006-02 | Maestro (스킵 플로우) | `app/.maestro/onboarding-stage1-skip.yaml`       |
| TC-006-03 | Maestro (해피)       | `app/.maestro/onboarding-stage1.yaml`            |
| TC-006-04 | Maestro (해피)       | `app/.maestro/onboarding-stage1.yaml`            |
| TC-006-05 | Maestro (스킵)       | `app/.maestro/onboarding-stage1-skip.yaml`       |
| TC-006-06 | 수동 (백엔드 스텁 필요) | —                                                |
| TC-006-07 | 수동 (네이티브 picker) | —                                                |
