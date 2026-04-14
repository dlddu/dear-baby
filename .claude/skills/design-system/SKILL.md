---
name: design-system
description: UI 작업(컴포넌트 추가/수정, 화면 구현, 스타일 변경, 레이아웃 작업 등 React Native/Expo 프론트엔드 작업)을 할 때 반드시 실행. dear-baby의 디자인 시스템 문서와 theme 토큰, 공통 컴포넌트를 참고하도록 강제해 일관된 UI를 유지합니다. UI, 스타일, 컴포넌트, 색상, 폰트, 여백, 버튼, 카드 등 시각적 요소와 관련된 모든 작업에 사용하세요.
---

# Design System 준수 가이드

dear-baby 앱의 UI 작업을 할 때는 **반드시** 아래 절차를 따릅니다. 디자인 토큰을 우회하거나 하드코딩된 스타일을 작성하지 마세요.

## 0. 작업 전 필수 체크리스트

UI 관련 변경을 시작하기 전에 다음 파일들을 **먼저 읽어서** 현재 시스템을 파악합니다.

### 디자인 문서 (docs/design-system/)
- `docs/design-system/README.md` — 디자인 원칙(Warmth, Softness, Emotional)
- `docs/design-system/colors.md` — 컬러 팔레트와 사용 규칙
- `docs/design-system/typography.md` — 타입 스케일과 폰트 패밀리
- `docs/design-system/tokens.md` — Spacing, Radius, Elevation 토큰
- `docs/design-system/components.md` — 컴포넌트 스펙
- `docs/design-system/patterns.md` — UI/UX 패턴

### 토큰 소스 코드 (app/src/theme/)
- `app/src/theme/colors.ts`
- `app/src/theme/typography.ts`
- `app/src/theme/spacing.ts`
- `app/src/theme/radius.ts`
- `app/src/theme/shadows.ts`
- `app/src/theme/fonts.ts`
- `app/src/theme/index.ts` — 통합 export

### 공통 컴포넌트 (app/src/components/)
- `Button`, `Card`, `Text`, `Badge`, `FAB`, `IconCircle`
- 새 컴포넌트를 만들기 전에 **기존 컴포넌트로 해결 가능한지** 먼저 확인합니다.

작업과 관련된 카테고리의 파일만 읽으면 됩니다. (예: 색상 작업이면 colors.md + colors.ts)

## 1. 스타일 작성 규칙

### ✅ 반드시
- 색상은 `theme/colors.ts`에서 import하여 사용 (예: `colors.primary`, `colors.text.primary`)
- 여백은 `theme/spacing.ts`의 `space.*` 토큰 사용
- 둥근 모서리는 `theme/radius.ts`의 토큰 사용
- 그림자는 `theme/shadows.ts`의 preset 사용
- 텍스트는 `<Text variant="...">` 컴포넌트로 처리 (typography 변형 사용)
- 버튼/카드/배지 등은 기존 공통 컴포넌트 재사용

### ❌ 금지
- `#FAF6F1`처럼 hex 코드를 직접 작성 (토큰에 없으면 먼저 토큰에 추가 후 사용)
- `padding: 17` 같은 임의 숫자 (spacing 토큰 사용)
- `borderRadius: 13` 같은 임의 값 (radius 토큰 사용)
- `fontFamily`, `fontSize`를 개별 스타일에서 직접 지정 (typography 토큰 사용)
- `shadowColor`, `elevation`을 직접 작성 (shadows preset 사용)

## 2. 신규 토큰이 필요할 때

디자인 문서에 없는 값이 필요하면 **임의로 추가하지 말고** 다음 순서를 따릅니다.

1. 기존 토큰으로 대체 가능한지 재검토
2. 정말 필요하다면 사용자에게 추가 이유와 제안값을 설명하고 승인 받기
3. 승인 후 `docs/design-system/*.md` 문서와 `app/src/theme/*.ts` 코드를 **함께** 업데이트
4. 관련 공통 컴포넌트가 있다면 새 토큰을 반영

## 3. 컴포넌트 작성 규칙

- 새 공통 컴포넌트는 `app/src/components/`에 추가하고 `index.ts`에 export
- 컴포넌트 API는 기존 `Button`, `Card` 패턴과 일관되게 설계 (variant, size 등)
- 스타일은 항상 토큰 기반으로, StyleSheet.create 사용
- 이모지/아이콘 사용 시 `patterns.md`의 감성 카피 규칙 확인

## 4. 디자인 원칙 점검

구현 전후로 다음을 확인합니다.

- [ ] **Warmth**: 따뜻한 톤(코랄/브라운 계열) 유지
- [ ] **Softness**: 충분한 라운드(최소 `radius.md` 이상), 부드러운 그림자
- [ ] **Emotional**: 감성적인 카피라이팅과 여백
- [ ] **Consistency**: 같은 역할에는 같은 토큰/컴포넌트

## 5. 작업 보고 템플릿

UI 작업 완료 시 사용자에게 다음을 간단히 보고합니다.

- 참고한 디자인 문서/토큰
- 재사용한 공통 컴포넌트
- 새로 추가한 토큰/컴포넌트 (있다면 이유)
- 디자인 원칙 체크 결과
