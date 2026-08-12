---
doc_id: ENG-008
doc_type: engineering-note
product: dear_baby
created: 2026-08-05
updated: 2026-08-05
status: draft
---

# 커뮤니티 피드 — 노출 풀 범위 (초안)

## 지위

**미확정 초안이다.** PRD-009 확정 과정(2026-08-05)에서 노출 로직을 AC 밖으로
분리하며 신설했다. 제품 결정 시 확정하고 구현을 재개발한다.

## 범위

피드 조회 쿼리의 **모수(어떤 기록이 후보에 드는가)** 만 다룬다. 순서는
[ENG-007](ENG-007-community-feed-default-sort.md), 유사 시기 가중치는
[ENG-011](ENG-011-community-similar-stage-recommendation.md) 소관.

## 확정된 제약 (상위 문서에서 내려온 것)

초안이어도 아래는 이미 제품 결정이 끝났으므로 어떤 안이든 준수해야 한다.

- 공개(`visibility = public`) 상태의 기록만 포함한다. 재비공개 즉시 제외
  (PRD-008 AC-008-07).
- 삭제된 기록은 delete marker 기준으로 전 조회 경로에서 제외
  ([ENG-012](ENG-012-record-delete-marker.md)).
- 케이스(임신/양육) 간 혼합 금지 — **작성 당시** 케이스 기준
  ([ENG-011](ENG-011-community-similar-stage-recommendation.md) 확정).
- 사진은 노출하지 않고 텍스트 본문만 공개 대상 (PRD-009 AC-009-10).

## 초안

- 풀 = 위 제약을 통과한 **전체 공개 기록** (기간 제한 없음).
- 작성 시점 주차 스냅샷이 없는 레거시 기록은 작성일과 아이의 예정일/생일로
  소급 계산해 포함한다 (ENG-001 계산 정책 준용).

## 열린 질문

- 오래된 기록(예: 1년+)을 풀에서 감쇠/제외할지.
- 신고 누적 기록의 잠정 제외 기준 (신고 운영 정책 확정 후).
