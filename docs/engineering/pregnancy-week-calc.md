---
doc_id: ENG-001
doc_type: engineering-note
product: dear_baby
created: 2026-04-18
updated: 2026-04-18
---

# 임신 주수 계산 정책

## 개요

Stage 2 홈 화면의 컨텍스트 배지 ("임신 17주 3일") 를 위해 프론트엔드에서
`due_date` 를 현재 주수로 환산한다. 이 문서는 계산의 기준과 경계 처리의
근거를 한 곳에 모아 둔 단일 레퍼런스다. UI/UX 스펙은
[`docs/wireframes/onboarding.md`](../wireframes/onboarding.md) 를
참고한다.

## 모델

- 산과 표준 LMP(Last Menstrual Period) 기반. 만삭 = **280 일 = 40 주**.
- `daysPregnant = 280 - (due_date - today)` 로 계산.
- 주수 = `floor(daysPregnant / 7)`, 일수 = `daysPregnant % 7`.

## 경계값

| 입력 | 처리 | 이유 |
|------|------|------|
| `due_date = null` | 배지 숨김 | Stage 1 "아직 정해지지 않았어요" 탈출구 |
| Stage 1 허용 범위 (`today … today+45주`) | 항상 배지 표시 | 사용자가 유효하게 고른 값은 "일관되게" 보여야 함 |
| `daysPregnant < 0` (40 주 초과 미래 due_date) | **0 으로 clamp** 하여 "임신 0주 0일" 표시 | 음수는 이론상 "임신 전" 이지만 Stage 1 이 허용한 입력이므로 배지를 숨기지 않는다 |
| `due_date` 가 5 주 이상 과거 | 배지 숨김 | 사용자가 값을 갱신하지 않은 방치 상태. 오탈자 가능성도 있어 표시 생략 |
| `due_date` 가 45 주 초과 미래 | 배지 숨김 | Stage 1 피커에서 막혀 있어 실질적으로 발생하지 않지만 방어적으로 null 반환 |

## 참고: 역사상 최장 임신 — Beulah Hunter (1945)

> 1945년 미국 LA, Beulah Hunter 가 **375 일** (약 53.6 주) 임신 끝에
> 건강한 여아 (Penny Diana, 약 3.2 kg) 를 출산. 담당의 Daniel Beltz 의
> 기록 기준 임신 약 3 개월 시점에 태아 성장이 일시 정지했다가 6 개월경
> 재개된 사례로, 의학적으로 확인된 최장 임신 기록. 2 위와 약 58 일 차.

이론상 이런 극단 케이스는 앱의 45 주 상한 안에 들어오지 않아 배지가
숨겨진다. 일반적인 과숙아 정의 (42 주 초과) 조차 상한의 한참 아래이므로
현재 범위 (45 주) 는 의학적 극단 사례 대응이 아니라 **오탈자 방지 용도로
유지** 하는 게 맞다.

## 코드 위치

- 계산 유틸: [`app/src/utils/pregnancy.ts`](../../app/src/utils/pregnancy.ts)
  (`calcPregnancy`)
- 피커 상한 (45 주): [`app/app/(onboarding)/welcome.tsx`](../../app/app/(onboarding)/welcome.tsx) 의 `MAX_DATE`
- 배지 렌더: [`app/src/components/QuestionCard.tsx`](../../app/src/components/QuestionCard.tsx)
- 홈 조합: [`app/app/(tabs)/index.tsx`](../../app/app/(tabs)/index.tsx)
