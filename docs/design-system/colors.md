# Colors — 컬러 팔레트

## Color Palette

### Primary

| 이름 | HEX | 용도 |
|------|-----|------|
| **Warm Coral** | `#D4836B` | CTA 버튼, 플로팅 버튼, 활성 탭 |
| **Soft Peach** | `#F5C6A8` | 앱 아이콘 그라디언트, 강조 배경 |

### Background & Surface

| 이름 | HEX | 용도 |
|------|-----|------|
| **Warm Beige** | `#F0E6D8` | 카드 배경, 입력 필드 배경 |
| **Cream White** | `#FAF6F1` | 앱 전체 배경 |
| **Ivory** | `#FFFFFF` | 카드, 모달 표면 |

### Accent

| 이름 | HEX | 용도 |
|------|-----|------|
| **Sage Green** | `#A8C5A0` | 임신 주차 배지, 보조 강조 |
| **Muted Teal** | `#7BACA3` | 질문 알림 아이콘 |
| **Soft Gold** | `#D4B896` | AI 편집 아이콘, 별/스파클 |

### Text

| 이름 | HEX | 용도 |
|------|-----|------|
| **Dark Brown** | `#3D2E1E` | 헤딩, 본문 텍스트 |
| **Warm Gray** | `#8C7B6B` | 보조 텍스트, 캡션 |
| **Light Gray-Brown** | `#B5A898` | 플레이스홀더, 비활성 탭 |

### Case Accent (온보딩 케이스 분기)

진행 바 / 케이스 라벨 텍스트 / 활성 탭 surface 에만 사용. 본문/CTA 의 톤은
케이스가 바뀌어도 일관되게 Warm Coral 을 유지한다. 자세한 사용법은
`docs/wireframes/onboarding.md` 의 "케이스 시각 구분" 섹션 참고.

| 케이스 | bar | text | surface |
|---|---|---|---|
| Case A | `#D85A30` | `#993C1D` | `#FCEAE2` |
| Case B | `#EF9F27` | `#854F0B` | `#FAEEDA` |
| Case C | `#378ADD` | `#0C447C` | `#DEEBF8` |
| Neutral (Q1·Q2) | `#888780` | `#5F5E5A` | `#F1EFE8` |

## Gradient

| 이름 | 값 | 용도 |
|------|-----|------|
| **Primary Gradient** | `135deg, #F5C6A8 → #D4836B` | 앱 아이콘, CTA 강조 |
| **Background Gradient** | `180deg, #FAF6F1 → #F0E6D8` | 카드 배경, 섹션 구분 |

## 사용 원칙

- 그레이 계열 대신 **브라운 계열**을 사용하여 따뜻한 톤을 유지한다
- 텍스트 색상은 `#3D2E1E`(기본), `#8C7B6B`(보조), `#B5A898`(비활성)의 3단계를 사용한다
- Primary Coral(`#D4836B`)은 CTA와 활성 상태에만 한정하여 시선을 집중시킨다
- 배경은 항상 Cream White(`#FAF6F1`)을 기본으로 하고, 카드 표면은 White(`#FFFFFF`)를 사용한다
