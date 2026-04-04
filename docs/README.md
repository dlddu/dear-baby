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

## 문서 목록

### 가치 문서
- [제품 가치 정의서](values/product-values.md) (VDOC-001)

### PRD 문서
- [PRD-001: 음성 일기 기록](prd/PRD-001-voice-diary.md)
- [PRD-002: 매일 다른 질문 알림](prd/PRD-002-daily-questions.md)
- [PRD-003: AI 편집 & 서사 구성](prd/PRD-003-ai-editing.md)
- [PRD-004: 실물 책 제작](prd/PRD-004-book-production.md)

### 테스트 문서
- [TEST-001: 음성 일기 기록 테스트](tests/TEST-001-voice-diary.md)
- [TEST-002: 매일 다른 질문 알림 테스트](tests/TEST-002-daily-questions.md)
- [TEST-003: AI 편집 & 서사 구성 테스트](tests/TEST-003-ai-editing.md)
- [TEST-004: 실물 책 제작 테스트](tests/TEST-004-book-production.md)
