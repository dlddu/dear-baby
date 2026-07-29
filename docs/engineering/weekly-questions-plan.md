---
doc_id: ENG-002
doc_type: engineering-note
product: dear_baby
created: 2026-04-24
updated: 2026-04-24
status: deferred
---

# 온보딩 주차별 질문 — 구현 연기 메모

## 요약

PRD-002 의 **AC-002-02 (임신 주차별 질문 매칭)** 본 구현은 **프롬프트 엔지니어링이
끝난 뒤** 별도 작업으로 진행한다. 현재 홈 화면의 "오늘의 질문" 은 주차 무관한
고정 풀에서 day-of-year 로 뽑는 **임시 플레이스홀더** 로 유지한다.

## 현재 상태 (플레이스홀더)

- 구현: [`app/src/data/dailyQuestions.ts`](../../app/src/data/dailyQuestions.ts)
  의 `getDailyQuestionTriplet(date, pool)` — 12개 1인칭 문항 풀(`DAILY_QUESTIONS`) 에서
  `dayOfYear(date) % pool.length` 를 시작 인덱스로 연속 3개(`DAILY_QUESTION_SLOTS = 3`) 를
  결정적으로 고른다. 같은 날엔 같은 3개, 다음 날엔 한 칸 밀린 3개이며 `12 % 3 == 0`
  이라 4일마다 같은 묶음이 반복된다 — 본격 풀이 들어오기 전 임시 동작이다.
- 주차 무관: `weekLabel`(임신 주차 배지) 은 카드·라우팅 파라미터 표시에만 쓰이고
  (`HomeQuestionCard`), 질문 선정 로직에는 관여하지 않는다.
- 소비처: [`app/app/(tabs)/index.tsx`](../../app/app/(tabs)/index.tsx) 홈 화면
  `HomeTab` 의 1인칭 질문 카드(`HomeQuestionCard`) — 일일 3개 회전(PRD-007 AC-007-04·05).

이 구조는 Stage 2 의 UI 기능(코치마크 · AI 미리보기 트리거)을 먼저 검증하기 위한
임시 해결책이며, 주차 기반 매칭 로직은 본 문서의 "본 구현" 단계에서 교체된다.

## 연기 사유

1. **질문 품질이 프롬프트 설계에 의존한다.** 주차별(초기/중기/후기 · 4·8·12주 단위
   등) 질문은 "그 시기에만 느낄 수 있는 감정을 포착" (V-001, V-005) 해야 한다.
   이 tone/depth/format 은 하드코딩 풀보다 LLM 생성 + 큐레이션이 적합하고,
   프롬프트가 확정되지 않은 상태에서 문항을 고정하면 나중에 전량 재작성해야 한다.
2. **풀 방식 vs. 생성 방식 결정 미정.** 정적 풀(주차별 고정 문항)로 갈지,
   LLM 이 사용자 컨텍스트(기존 기록, 주수, 계절)를 반영해 매일 생성할지는 프롬프트
   실험 결과에 따라 정해진다. 두 접근의 스키마 · 저장소 · 캐싱 정책이 다르다.
3. **반복 방지 정책도 프롬프트와 묶여 있다.** AC-002-02 의 "같은 질문이
   반복되지 않는다" 는 풀 크기 · 유저별 히스토리 테이블 · 생성 시드에 의존한다.
   프롬프트가 확정되기 전에 스키마를 박으면 손해 본다.

## 본 구현에서 다룰 범위

프롬프트 엔지니어링이 끝난 뒤 별도 PR 로 다음을 수행한다.

- **질문 소스**: 주차 범위(예: 1–12 · 13–27 · 28–40) 별 프롬프트 확정 → 생성/풀 중
  택1 → 서비스 레이어 추가.
- **주차 매칭**: 프론트의 `calcPregnancy` (docs/engineering/pregnancy-week-calc.md)
  결과를 입력으로, 현재 주차에 해당하는 질문을 내려준다.
- **반복 방지**: 유저별 질문 히스토리 테이블 혹은 결정적 시드로 AC-002-02 의 "같은
  질문이 반복되지 않는다" 를 만족시킨다.
- **플레이스홀더 제거**: `app/src/data/dailyQuestions.ts` 삭제 또는 테스트 전용
  픽스처로 축소.
- **알림 연계 (AC-002-04)**: 푸시 알림 payload 가 주차별 질문을 참조하도록 연결.
  현재 플레이스홀더 단계에서는 알림 본 구현을 시작하지 않는다.

## 본 구현에서 다루지 않는 범위

- Stage 2 의 **AI 미리보기** (`onboarding.ai_preview`) — 이미 구현되어 있고
  스코프가 다르다. 경계는 [`docs/engineering/ai-preview-scopes.md`](./ai-preview-scopes.md)
  참고.
- Stage 3 의 서사체 AI — 별도 계획.

## 관련 문서

- PRD: [`docs/prd/PRD-002-daily-questions.md`](../prd/PRD-002-daily-questions.md)
  (AC-002-01 ~ AC-002-04)
- Mockup: [`docs/mockups/`](../mockups)
- 주차 계산: [`docs/engineering/pregnancy-week-calc.md`](./pregnancy-week-calc.md)
- AI 피처 경계: [`docs/engineering/ai-preview-scopes.md`](./ai-preview-scopes.md)
