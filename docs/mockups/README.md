# DearBaby — Mockups

페이지 단위 mockup 42개. **React + Vite + Tailwind + shadcn/ui** 기반 단일 HTML 번들로 빌드된다. 모든 mockup 은 `docs/journeys/`, `docs/design-system/`, `docs/values/product-values.md` 에서 도출되었다.

## 빠른 보기

최신 `main`의 목업은 GitHub Pages에서 바로 확인할 수 있다.

- **[GitHub Pages에서 보기](https://dlddu.github.io/dear-baby/)**

로컬 진입점도 Pages가 사용하는 단일 파일이다.

- **[`docs/index.html`](../index.html)** — 빌드된 단일 HTML (브라우저로 열기)

이 파일 하나에 42개 화면 + 갤러리가 모두 인라인 번들된다. CDN 의존성 없음 (폰트만 Google Fonts CDN 사용).

## 디렉토리 구조

```
docs/
├── index.html          ← Pages 진입점 + 빌드된 번들
└── mockups/
    ├── README.md       ← 이 파일
    └── source/         ← React 소스 (재빌드 가능)
        ├── src/
        │   ├── App.tsx
        │   ├── components/  (PhoneFrame, Common 프리미티브)
        │   └── screens/     (6개 여정별 화면 모듈)
        ├── package.json
        ├── tailwind.config.js
        └── ...
```

## 재빌드 방법

소스 수정 후 단일 HTML 로 다시 번들하려면:

```bash
cd docs/mockups/source
pnpm install
# Anthropic web-artifacts-builder 스킬의 bundle 스크립트 사용
bash /path/to/web-artifacts-builder/scripts/bundle-artifact.sh
cp bundle.html ../../index.html
```

또는 개발 모드:

```bash
cd docs/mockups/source
pnpm install
pnpm dev    # http://localhost:5173 에서 hot reload
```

## GitHub Pages 배포

저장소 **Settings → Pages → Build and deployment**에서 다음과 같이 설정한다.

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/docs**

`main`에 병합된 `docs/index.html`이 별도 GitHub Actions workflow 없이 게시된다.

## 42개 페이지 일람

| ID | 화면 | 여정 / Stage |
|----|------|--------------|
| M-01 | 가입 · OAuth | Onboarding · 1-1 |
| M-02 | Q1 — 임신 중인가요? | Onboarding · 2-1 |
| M-03 | Q2 — 양육 아이가 있나요? | Onboarding · 2-2 |
| M-04 | A1 — 임신 아이 수 | Onboarding · 3-A1 (Case A) |
| M-05 | A2 — 태아 정보 (예정일·태명·성별·임신 주차) | Onboarding · 3-A2 (Case A) |
| M-06 | A3 — 기록 목적 | Onboarding · 3-A3 (Case A) |
| M-07 | B0 — 안내 ① | Onboarding · 4-B0 (Case B) |
| M-08 | B1 — 양육 아이 수 | Onboarding · 4-B1 (Case B) |
| M-09 | B2 — 양육 아이 정보 | Onboarding · 4-B2 (Case B) |
| **M-35** | **B2-Purpose — 양육 아이 기록 목적 (1:1, AC-006-03 준수)** | **Onboarding · 4-B2-Purpose (Case B)** |
| M-10 | B3 — 안내 ② | Onboarding · 4-B3 (Case B) |
| M-11 | B4 — 임신 아이 수 | Onboarding · 4-B4 (Case B) |
| M-12 | B5 — 태아 정보 | Onboarding · 4-B5 (Case B) |
| M-13 | B6 — 기록 목적 (아이별) | Onboarding · 4-B6 (Case B) |
| M-14 | C1 — 양육 아이 수 | Onboarding · 5-C1 (Case C) |
| M-15 | C2 — 아이 정보 | Onboarding · 5-C2 (Case C) |
| M-16 | C3 — 기록 목적 | Onboarding · 5-C3 (Case C) |
| M-17 | 홈 — 임신 모드 (단일) — **PRD-007 준수** | Daily Recording · 6-1 |
| M-18 | 홈 — 다자녀 (Case B) — **PRD-007 준수** | Daily Recording · 6-1 |
| M-19 | 음성 녹음 | Daily Recording · 6-2 |
| M-20 | AI STT 결과 편집 | Daily Recording · 6-3 |
| M-21 | 사진·영상·음성 첨부 | Daily Recording · 6-4 |
| M-22 | 기록 저장 완료 | Daily Recording · 6-5 |
| M-23 | 출산 확인 모달 | Birth Conversion · 7-2 |
| **M-24 ★** | **출생일 입력** | **Birth Conversion · 7-3 (감정 봉우리)** |
| M-25 | 설정 + D+14 배너 | Birth Conversion · 7-2 alt |
| M-26 | 양육자 모드 첫 홈 — **PRD-007 준수 + 환영 리본** | Birth Conversion · 7-4 |
| M-27 | AI 서사 요청 | AI Narrative · 8-1 |
| M-28 | AI 처리 로딩 | AI Narrative · 8-2 |
| **M-29 ★** | **서사 미리보기** | **AI Narrative · 8-3 (감정 봉우리)** |
| M-30 | 서사 편집 | AI Narrative · 8-3 alt |
| M-31 | 표지·레이아웃 선택 | Book Production · 9-1 |
| M-32 | 전체 미리보기 | Book Production · 9-2 |
| M-33 | 결제 | Book Production · 9-3 |
| M-34 | 제작·배송 추적 | Book Production · 9-4 |
| M-36 | 일기 탭 — 목록 (단일 아이 통합) | Diary Browsing · 6½-1·2 |
| M-37 | 일기 탭 — 다자녀 통합 (콩이+하준) + 필터 | Diary Browsing · 6½-2 |
| M-38 | 기록 상세 + ⋯ 액션 시트 | Diary Browsing · 6½-3·4 |
| M-39 | 일기 탭 — 빈 상태 (기록 0건) | Diary Browsing · 6½-1 |
| M-40 | 기록 편집 (사후) | Diary Browsing · 6½-4 |
| M-41 | 삭제 확인 모달 | Diary Browsing · 6½-4 |
| M-42 | 필터 시트 (다자녀) | Diary Browsing · 6½-2 |

## ★ 감정 봉우리 페이지

사용자 여정의 정서적 정점에 위치하는 두 화면:

- **M-24 출생일 입력** · "드디어 만났어요" — 임신 → 양육 전환 모먼트
- **M-29 서사 미리보기** · "한 권의 이야기가 완성됐어요" — 기록이 책이 된 순간

이 두 화면은 cream → peach → coral 그라디언트 배경, 손글씨 폰트 (Nanum Pen Script), 풀-블리드 카피로 다른 페이지와 차별된다.

## Mockup ↔ 가치 매핑

| 가치 | 핵심 mockup |
|------|-------------|
| V-001 감정 보존 | M-01, M-22, M-24 ★, M-29 ★, M-36, M-38 |
| V-002 기록의 부담 제거 | M-17, M-18, M-19, M-22, M-35, M-39, M-40, M-41, M-42 |
| V-003 서사적 의미 부여 | M-29 ★, M-30, M-32, M-36, M-37 |
| V-004 음성-텍스트 자동 변환 | M-19, M-20, M-27 |
| V-005 아이 단계별 맞춤 질문 | M-17, M-26 |
| V-006 실물 책 완성품 | M-31, M-32 |
| V-007 멀티미디어 감정 표현 | M-21, M-32, M-33, M-38 |

## 디자인 시스템 매핑

모든 mockup 은 `docs/design-system/` 의 토큰만 사용한다 (Tailwind config 에 1:1 매핑됨).

**색상 토큰** — `docs/design-system/colors.md`
- Primary: Coral `#D4836B`, Peach `#F5C6A8`
- Background: Cream `#FAF6F1`, Beige `#F0E6D8`, Ivory `#fff`
- Accent: Sage `#A8C5A0`, Teal `#7BACA3`, Gold `#D4B896`
- Text: Ink `#3D2E1E`, Ink-sub `#8C7B6B`, Ink-muted `#B5A898`

Tailwind 사용:
```tsx
<div className="bg-coral text-white">
<div className="text-ink-sub">
<div className="rounded-db-md shadow-db-sm">
```

**타이포그래피** — `docs/design-system/typography.md`
- UI 한글: `font-sans` (Pretendard + 시스템 fallback)
- 감성 카피: `font-serif` (Noto Serif KR)
- 손글씨 (감정 봉우리): `font-hand` (Nanum Pen Script)
- 로고 / 제목: `font-display` (Playfair Display)

**컴포넌트** — `source/src/components/Common.tsx`

| 컴포넌트 | 용도 |
|----------|------|
| `<PhoneFrame>` | 393×852 모바일 모형 + status bar |
| `<TopBar>` | 화면 상단 바 (back · title · right action) |
| `<PrimaryButton>` / `<SecondaryButton>` | CTA |
| `<Badge>` | 상태 라벨 (코랄 / 세이지 / 골드 등) |
| `<FrameCard>` | 정보 카드 (ivory + soft shadow) |
| `<Chip>` / `<Pill>` | 선택 칩 / 탭형 선택 |
| `<Row>` | 리스트 행 (icon + title + sub + chev) |
| `<CalloutWarm>` | 안전감 알림 (M-25, M-27) |
| `<BookPage>` | 책 페이지 (M-29, M-32) |
| `<FAB>` | 음성 녹음 진입 (M-17, M-18, M-26) |
| `<Tabbar>` | 하단 탭바 |
| `<StepIndicator>` | 책 제작 단계 표시 (M-31, M-32, M-33) |
| `<ProgressDots>` | 온보딩 진행 (M-02 ~ M-16) |
| `<QuestionHeader>` | 질문 화면 헤더 (eyebrow + title + helper) |

## 정합성 검증 (design-doc-structure-validator)

- ✅ 모든 mockup 이 5개 사용자 여정 stage 와 1:1 매핑
- ✅ 모든 mockup 이 1개 이상 가치(V-001~V-007)와 연결
- ✅ Tailwind config 에 정의된 디자인 시스템 토큰만 사용 (raw hex 색상은 dear-baby palette 만 등장)
- ✅ ★ 감정 봉우리 (M-24, M-29) 가 사용자 여정 문서가 명시한 정서적 정점에 위치
- ⚠️ 다음은 임시 값이며 비즈니스/디자인 결정 후 갱신 필요:
  - M-31 표지 큐레이션 4종 — 디자인 본 작업 시 재정의
  - M-33 가격 (₩42,000 / ₩28,000) — 비즈니스 결정 사항
  - M-34 단계 소요시간 (1~2일 등) — 운영 합의 후 재확정

## 개발 메모

- **이전 정적 HTML 버전** (2026-05-06 작성, vanilla HTML + 외부 styles.css) 은 sandbox 에서 외부 CSS 가 로드되지 않는 문제로 폐기되었다. 2026-05-06 같은 날 React 기반으로 재작성됨.
