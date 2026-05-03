# Onboarding Cases — Data Model Decision

PRD-006 의 **케이스 분기 온보딩(AC-006-01\~04)** 을 백엔드 스키마로 푼 결정 기록.

## 결정

1. `onboarding` 테이블에 케이스 플래그 3개를 추가한다 — `is_pregnant`, `has_children`, `multiple_pregnancy`.
2. 통합 `children` 테이블 1개로 양육 중 아이와 임신 중 아이를 모두 표현하고, `status` enum (`'parenting' | 'pregnancy'`) 으로 구분한다.
3. 기록 목적은 `child_purposes(child_id, purpose, position)` 별도 테이블에 저장한다 — Case B 가 아이별로 다른 목적 셋을 가질 수 있기 때문.

## 통합 vs 분리 트레이드오프

분리(`children` + `fetuses` 두 테이블) 안과 비교:

| 축 | 통합 (`children` + status) | 분리 (`children` + `fetuses`) |
|---|---|---|
| 출산 전환 (AC-006-06) | `UPDATE status='parenting', birth_date=..., due_date=NULL` 한 줄 | `INSERT INTO children` + `DELETE FROM fetuses` (행 ID 변경 → 외래키 정리 필요) |
| 다자녀 컨텍스트 순회 (AC-006-08) | `SELECT ... FROM children ORDER BY display_order` 한 쿼리 | UNION 쿼리, 또는 N+1 |
| 아이별 기록 외래키 (PRD-001 records → children) | 단일 FK | 두 FK + nullable, 조인 깊이 ↑ |
| 컬럼 중 nullable 비율 | 약 절반 (`birth_date`, `due_date` 등 모두 nullable) | 양쪽 모두 컬럼 수 ↓ |
| 마이그레이션 (출산 → 양육) 데이터 손실 위험 | 같은 행 갱신 → 무손실 | 행 이전 + 자식 행 (records / 일기) 의 FK 갱신 필요 |

**채택**: 통합. 출산 전환 빈도(거의 모든 임신 사용자가 한 번씩 통과)와 외래키 단순성이 nullable 비율 손실을 압도한다. CHECK 제약으로 status 별 필수 필드를 강제해 schema-level integrity 를 유지한다.

## Schema 요약

```sql
-- onboarding 신규 컬럼
ALTER TABLE onboarding ADD COLUMN is_pregnant         BOOLEAN; -- AC-006-01 ① 답변
ALTER TABLE onboarding ADD COLUMN has_children        BOOLEAN; -- AC-006-01 ② 답변
ALTER TABLE onboarding ADD COLUMN multiple_pregnancy  BOOLEAN; -- 단태/다태. NULL = 미응답

CREATE TABLE children (
  id                      TEXT PRIMARY KEY,
  user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                  TEXT NOT NULL CHECK (status IN ('parenting','pregnancy')),
  name                    TEXT,
  gender                  TEXT NOT NULL CHECK (gender IN ('female','male','unknown')),
  birth_date              TEXT,        -- 'parenting' 일 때 NOT NULL
  due_date                TEXT,        -- 'pregnancy' 이고 미정이 아니면 NOT NULL
  pregnancy_week          INTEGER,
  bio                     TEXT,
  photo_s3_key            TEXT,
  is_due_date_undecided   INTEGER NOT NULL DEFAULT 0,
  display_order           INTEGER NOT NULL DEFAULT 0,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (status = 'parenting' AND birth_date IS NOT NULL)
    OR
    (status = 'pregnancy' AND (due_date IS NOT NULL OR is_due_date_undecided = 1))
  )
);

CREATE TABLE child_purposes (
  child_id  TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  purpose   TEXT NOT NULL,
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (child_id, purpose)
);
```

## 결과 / 후속 영향

* `users.due_date` 는 PRD-006 이전부터 이미 onboarding 으로 옮겨졌으나, 본 PR 은 `onboarding.due_date` 도 죽은 컬럼으로 남겨둔다 (마이그레이션 0008 에서 삭제하지 않음). `children.due_date` 가 진짜 데이터 출처가 되며, `Profile.due_date` 는 deprecated 표시 후 항상 null 을 반환한다.
* 홈 화면(`(tabs)/index.tsx:60`) 의 임신주차 표시는 `user.due_date` 를 직접 읽고 있으므로 본 PR 후 동작하지 않는다 — 후속 작업으로 `children` 에서 직접 읽도록 변경해야 한다.
* SQLite 의 ALTER 제약: CHECK 제약은 ALTER TABLE 로 추가/변경 불가. 본 마이그레이션은 CREATE TABLE 만 사용하므로 OK. 추후 enum 확장이 필요하면 새 테이블 + 데이터 복사 + DROP 패턴을 사용한다.
