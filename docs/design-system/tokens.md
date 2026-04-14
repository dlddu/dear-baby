# Tokens — 디자인 토큰

## Border Radius

| 토큰 | 값 | 용도 |
|------|-----|------|
| `radius-xs` | `8px` | 배지, 태그 |
| `radius-sm` | `12px` | 버튼, 입력 필드 |
| `radius-md` | `16px` | 카드, 기록 썸네일 |
| `radius-lg` | `20px` | 메인 카드, 섹션 |
| `radius-xl` | `24px` | 최상위 컨테이너 |
| `radius-full` | `9999px` | 아이콘 배경, 플로팅 버튼 |

## Spacing

| 토큰 | 값 |
|------|-----|
| `space-1` | `4px` |
| `space-2` | `8px` |
| `space-3` | `12px` |
| `space-4` | `16px` |
| `space-5` | `20px` |
| `space-6` | `24px` |
| `space-8` | `32px` |

## Elevation / Shadow

| 레벨 | 값 | 용도 |
|------|-----|------|
| **Soft** | `0 1px 4px rgba(61, 46, 30, 0.04)` | 입력 필드, 탭 바 |
| **Card** | `0 2px 12px rgba(61, 46, 30, 0.06)` | 일반 카드 |
| **Elevated** | `0 4px 20px rgba(61, 46, 30, 0.10)` | 플로팅 버튼, 모달 |

### 그림자 원칙

- 그림자 색상은 항상 **브라운 계열** `rgba(61, 46, 30, ...)` 사용 (블랙 대신)
- 따뜻한 톤을 유지하면서 깊이감을 표현
- 3단계(Soft → Card → Elevated)로 구분하여 일관된 계층 구조 유지
