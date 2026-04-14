# Components — 컴포넌트

## Buttons

### Primary Button (CTA)

- 배경: `#D4836B` (Warm Coral)
- 텍스트: `#FFFFFF`, 15px, font-weight 600
- Border Radius: 12px
- Shadow: `0 4px 12px rgba(212,131,107,0.3)`
- 예시: `🎙 음성으로 기록`

### Secondary Button (보조 액션)

- 배경: `#FAF6F1` (Cream White)
- 테두리: `1px solid #F0E6D8`
- 텍스트: `#3D2E1E`, 15px, font-weight 600
- Border Radius: 12px
- 예시: `✏️ 텍스트로 작성`

### FAB (플로팅 액션 버튼)

- 크기: 56×56px
- 배경: `#D4836B`
- 텍스트: `#FFFFFF`, 24px, font-weight 300
- Border Radius: 9999px (완전 원형)
- Shadow: `0 4px 20px rgba(212,131,107,0.35)`
- 아이콘: `+`

## Cards

### 오늘의 질문 카드

```
┌─────────────────────────────────────────┐
│  오늘의 질문              [임신 17주 3일] │  ← 배지: Sage Green 배경
│                                         │
│  요즘 아기가 가장 활발하게 움직인          │  ← H3: 17px/600
│  순간은 언제였나요?                       │
│                                         │
│  아기의 작은 움직임도 소중한 추억이 돼요 ✨ │  ← Caption: 13px/400 Muted
└─────────────────────────────────────────┘
```

- 배경: `#FAF6F1`
- Border Radius: 16px
- 구조: 상단(라벨 + 배지) → 중단(질문 텍스트) → 하단(격려 텍스트)

### 기록 썸네일 카드

- 썸네일: 정사각형, Border Radius 16px
- 타이틀: 13px/600, `#3D2E1E`
- 날짜: 13px/400, `#B5A898`
- 가로 3개 그리드로 나열

## Navigation

### Bottom Tab Bar

- 탭 4개: 홈 / 기록 / 질문 / 마이
- 활성 탭: `#D4836B` (Warm Coral)
- 비활성 탭: `#B5A898` (Muted)
- FAB이 탭 바 위에 겹쳐 배치

## Badges & Tags

| 유형 | 배경 | 텍스트 | 예시 |
|------|------|--------|------|
| 임신 주차 | `#A8C5A0` | `#FFFFFF` | 임신 17주 3일 |
| 보조 액션 | `#F0E6D8` | `#8C7B6B` | 더보기 > |
| 카테고리 | `#D4836B` | `#FFFFFF` | 음성 기록 |

- Border Radius: 8px
- Font: 12px/600

## Icon Style

아이콘은 **원형 배경 + 중앙 아이콘** 패턴을 사용합니다. 배경색으로 카테고리를 구분합니다.

| 카테고리 | 아이콘 배경색 | 아이콘 |
|----------|--------------|--------|
| 음성 기록 | `#F5C6A8` | 🎙 |
| 질문 알림 | `#FDDDD5` | ❤️ |
| 책 제작 | `#D8E8D4` | 📖 |
| AI 편집 | `#E0D4C4` | ✨ |

- 아이콘 컨테이너: 48×48px, 완전 원형
- 항상 원형 배경 위에 배치하여 일관성 유지
