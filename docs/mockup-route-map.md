# 목업 ↔ 라우트 매핑 레지스트리

구현된 expo-router 라우트(`app/app/**`)가 어느 목업(`docs/mockups`, 화면 ID `M-NN`)을 그리는지
**기계적으로 확인 가능한 형태**로 등재한다. 시각의 단일 소스(SSOT)는 목업이고, 이 문서는 목업과
구현을 잇는 **매핑의 SSOT**다 — 매핑을 코드 주석에만 두면 어느 도구도 전수 대조를 할 수 없다.

`scripts/check-mockup-route-map.mjs` 가 이 문서를 파싱해 규칙 R1~R9 를 강제하고,
`.github/workflows/mockup-route-map.yml` 이 PR·main push 마다 그 체커를 돌린다.

- 라우트 총수(실측 기준): **28** — `app/app/**` 의 `.tsx`/`.ts` 중 `__tests__`·`__mocks__` 디렉터리와
  `_layout.*`·`+html.*`·`+native-intent.*`·`*.test.*`·`*.spec.*` 를 제외한 것(`app/scripts/check-routes.mjs` 와 동일 기준).
- 목업 총수(실측 기준): **43** — `docs/mockups/source/src/screens/GalleryScreen.tsx` 의 갤러리 인덱스 항목 수.

> **왜 숫자를 손으로 적고도 안전한가**: R9 가 이 숫자를 실측값·`docs/mockups/README.md` 일람 표
> 행 수·양쪽 README 의 선언과 4중으로 대조한다. 숫자를 고치는 것이 아니라 **측정 방법을 고정**한 것이라,
> 목업이 늘면 체커가 먼저 실패한다.

## 규칙

| 코드 | 규칙 |
|---|---|
| R0 | **마커 보존** — 아래 세 구간의 `begin/end` 마커가 살아 있어야 한다(지우면 그 구간이 통째로 검사에서 빠진다). |
| R1 | **등록 완비** — 모든 라우트가 매핑 표에 정확히 1행 있다. |
| R2 | **유령 행 금지** — 매핑 표의 모든 라우트 파일이 실재한다. |
| R3 | **목업 실재** — 매핑 표가 지목한 모든 `M-NN` 이 갤러리 인덱스에 실재한다. |
| R4 | **공백 사유 필수** — 목업 칸이 `—`(대응 목업 없음)인 행은 비고에 사유가 있어야 한다. |
| R5 | **주석 일치** — 라우트 파일이 언급한 `M-NN` 집합은 그 라우트의 매핑 표 값의 부분집합이어야 한다. |
| R6 | **참조 유효** — 라우트·컴포넌트 주석이 인용한 `docs/…` 경로가 실재하고, 줄 범위를 함께 인용하면 그 범위가 유효 구간(파일 길이 안 · 인용한 `M-NN` 블록 안)에 든다. |
| R7 | **원장 = 실제 위반** — R5·R6 위반 집합이 「미해소 위반 원장」과 정확히 일치하고, 원장 행 수가 선언된 상한 이하다. |
| R8 | **이탈 허용목록** — 허용목록 각 행에 사유가 있고, 구현 심볼이 `app/src/theme/fonts.ts` 에 실재한다. |
| R9 | **집계 고정** — 목업 총수가 실측·일람 표 행 수·`docs/README.md`·`docs/mockups/README.md` 선언과 모두 같다. |

## 1. 라우트 매핑

`상태` 는 **구현**(목업 대조 대상) · **부분**(목업의 일부만 구현) · **플레이스홀더**("곧 추가됩니다" 자리표시자)다.
플레이스홀더·미구현 화면의 부재는 이 모델의 drift 가 아니며 구현 의무는 `tbm_dear-baby-docs-impl` 에 있다.

<!-- route-map:begin -->

| 라우트 | 목업 | 상태 | 근거 · 비고 |
|---|---|---|---|
| `app/app/(landing)/index.tsx` | M-01 | 구현 | 가입 · OAuth. 파일 안에서 M-01 을 두 번 인용(로고 44px/700, Apple 버튼 자체 렌더 사유). |
| `app/app/(onboarding)/q1.tsx` | M-02 | 구현 | Q1 임신 중인가요. |
| `app/app/(onboarding)/q2.tsx` | M-03 | 구현 | Q2 양육 아이가 있나요. |
| `app/app/(onboarding)/a1.tsx` | M-04 | 구현 | A1 임신 아이 수 (Case A). |
| `app/app/(onboarding)/a2.tsx` | M-05 | 구현 | A2 태아 정보. 주석의 인용 줄 범위가 stale — 원장 L2. |
| `app/app/(onboarding)/a3.tsx` | M-06 | 구현 | A3 기록 목적. |
| `app/app/(onboarding)/b0.tsx` | M-07 | 구현 | B0 안내 ① (Case B 진입). |
| `app/app/(onboarding)/b1.tsx` | M-08 | 구현 | B1 양육 아이 수. |
| `app/app/(onboarding)/b2.tsx` | M-09 | 구현 | B2 양육 아이 정보. |
| `app/app/(onboarding)/b2-purpose.tsx` | M-35 | 구현 | B2-Purpose 양육 아이 기록 목적(1:1). **2026-05-12 에 M-35 가 이 화면 전용 목업으로 신설되면서 "추가 mockup 이 필요 없다"는 초기 결정이 뒤집혔다** — 목업 소스 `Onboarding.tsx` 의 M-35 블록이 이 화면을 그린다. 주석은 아직 M-13 을 대조군으로 인용 — 원장 L1. |
| `app/app/(onboarding)/b3.tsx` | M-10 | 구현 | B3 안내 ② (임신 단계 진입). |
| `app/app/(onboarding)/b4.tsx` | M-11 | 구현 | B4 임신 아이 수. |
| `app/app/(onboarding)/b5.tsx` | M-12 | 구현 | B5 태아 정보. |
| `app/app/(onboarding)/b6.tsx` | M-13 | 구현 | B6 태아 기록 목적. |
| `app/app/(onboarding)/c1.tsx` | M-14 | 구현 | C1 양육 아이 수 (Case C). |
| `app/app/(onboarding)/c2.tsx` | M-15 | 구현 | C2 양육 아이 정보. |
| `app/app/(onboarding)/c3.tsx` | M-16 | 구현 | C3 기록 목적. |
| `app/app/(tabs)/index.tsx` | M-17, M-18, M-26 | 구현 | 홈 탭. 한 라우트가 상태에 따라 세 목업을 그린다 — 임신 단일(M-17, 기본) · 다자녀 Case B(M-18) · 양육자 모드 첫 홈(M-26). 홈 구성 컴포넌트 4종이 M-17 소스 줄 범위를 인용한다. |
| `app/app/(tabs)/diary.tsx` | M-36, M-37, M-39, M-42 | 구현 | 일기 탭. 목록(M-36) · 다자녀 통합(M-37) · 빈 상태(M-39) · 필터 시트(M-42)가 한 라우트 안의 상태 분기다(필터 시트는 화면-로컬 state). |
| `app/app/(tabs)/community.tsx` | M-43 | 플레이스홀더 | "곧 추가됩니다" 자리표시자. 구현은 `tbm_dear-baby-docs-impl` 의 rct_20260807-0003(PR #172) 진행 중 — 이 모델의 시각 대조 대상이 아니다. |
| `app/app/(tabs)/memoir.tsx` | — | 플레이스홀더 | **대응 목업 없음**: 자서전 탭 진입 화면 목업이 아직 없다. AI 서사(M-27~M-30)·책 제작(M-31~M-34)은 탭 하위 흐름이라 진입 화면과 1:1 이 아니다. |
| `app/app/(tabs)/settings.tsx` | M-25 | 부분 | 설정 탭. M-25 는 D+14 배너 · 프로필 · 메뉴 목록을 그리지만 구현은 로그아웃만 있다. **시각 대조는 구현된 요소에 한정**하고, 나머지 요소의 구현 의무는 docs-impl 소관이다. |
| `app/app/diary/[id].tsx` | M-38, M-41 | 구현 | 기록 상세 + ⋯ 액션 시트(M-38)와 그 위에 뜨는 삭제 확인 모달(M-41, `DeleteConfirmModal`). |
| `app/app/diary/[id]/edit.tsx` | M-40 | 구현 | 기록 편집(사후). 잠금 영역 표기 포함. |
| `app/app/drafts.tsx` | — | 구현 | **대응 목업 없음**: 음성 원본 보관함(로컬 오디오 업로드·삭제)은 목업에 없다. 목업의 기록 경로는 녹음→편집→첨부→저장(M-19~M-22)까지만 그린다. |
| `app/app/record-audio.tsx` | M-19 | 구현 | 음성 녹음. |
| `app/app/record-audio-review.tsx` | M-20 | 구현 | STT 결과 편집. M-21(사진·영상·음성 첨부)은 이 화면에 아직 구현되지 않았다 — 미구현이라 대조 대상 아님. |
| `app/app/record-text.tsx` | — | 구현 | **대응 목업 없음**: 텍스트 기록 모달 전용 목업이 없다(목업은 음성 경로만 그린다). 주석이 삭제된 문서를 인용 — 원장 L3. |

<!-- route-map:end -->

### 대응 라우트가 없는 목업 (정보용 · 이 모델의 drift 아님)

미구현 화면의 부재는 이 모델의 drift 가 아니다. 구현 의무는 `tbm_dear-baby-docs-impl` 에 있고,
구현되는 순간 위 표에 행이 생기며 그때부터 시각 대조 대상이 된다.

- M-21 사진·영상·음성 첨부 / M-22 기록 저장 완료
- M-23 출산 확인 모달 / M-24 출생일 입력
- M-27 AI 서사 요청 / M-28 AI 처리 로딩 / M-29 서사 미리보기 / M-30 서사 편집
- M-31 표지·레이아웃 선택 / M-32 전체 미리보기 / M-33 결제 / M-34 제작·배송 추적

## 2. 미해소 위반 원장

R5·R6 위반 중 **아직 고치지 않은 것**을 사유·해소 조건과 함께 등재한다. 원장은 면제 장치가 아니라
래칫이다 — R7 이 (a) 원장에 없는 새 위반을 막고, (b) 이미 고쳐진 행이 원장에 남아 있는 것도 실패로
처리해 "고쳤으면 지워라"를 강제하며, (c) 행 수가 아래 상한을 넘지 못하게 한다. 상한은 내릴 때만 고친다.

<!-- ledger-cap: 4 -->

**네 건 모두 `app/**` 파일의 주석 한두 줄 수정이면 끝나지만, 이 레포는 PR 이 `app/**` 를 건드리는
순간 `ci.yml` 의 `deploy-testflight`·`deploy-play-internal` 이 발화해 내부 테스터에게 빌드가 배포된다**
(`changes` job 의 `app: - 'app/**'` 필터 → `prechecks-passed` → 두 deploy 잡, `github.event_name == 'pull_request'`).
주석 네 줄 때문에 배포를 트리거하지 않는다. **다음에 `app/**` 를 건드리는 PR 에 편승해 함께 고치고
이 원장에서 지운다.**

<!-- ledger:begin -->

| # | 대상 | 규칙 | 위반 내용 | 해소 조건 |
|---|---|---|---|---|
| L1 | `app/app/(onboarding)/b2-purpose.tsx` | R5 | 헤더 주석이 스스로를 "mockup 외 신설"로 선언하고 M-13(B6)을 대조군으로만 인용한다. 레지스트리의 매핑은 M-35 다. | 헤더 주석을 M-35 매핑 선언으로 갱신하고 "추가 mockup 이 필요 없다"는 문장을 제거한다. |
| L2 | `app/app/(onboarding)/a2.tsx` | R6 | 인용 범위 `Onboarding.tsx:263-278` 이 M-05 블록(268–315) 밖에서 시작한다 — 목업 수정으로 줄이 밀렸다. | 인용 범위를 현재 M-05 블록 안으로 갱신한다. |
| L3 | `app/app/record-text.tsx` | R6 | `docs/wireframes/onboarding.md L104-106` 을 인용하는데 그 폴더는 #92 "remove deprecated wireframes folder and all references" 에서 삭제됐다(그 PR 이 놓친 잔여 참조). | 인용을 제거하거나 현행 문서(`docs/journeys/daily-recording-journey.md` 등)로 교체한다. |
| L4 | `app/src/utils/date.ts` | R6 | 같은 `docs/wireframes/onboarding.md` 를 인용한다 — #92 가 놓친 두 번째 잔여 참조. | L3 과 같다. |

<!-- ledger:end -->

## 3. 이탈 허용목록

플랫폼상 불가피한 시각 차이는 **사유가 명시된 허용목록으로만** 존재한다(모델 정의 to-be 5항).
`구현 심볼` 은 `app/src/theme/fonts.ts` 의 실제 export 값이라 R8 이 실재를 검증한다.

<!-- deviations:begin -->

| 항목 | 목업/문서 | 구현 심볼 | 사유 |
|---|---|---|---|
| 한글 UI 기본 (sans) | 목업 `tailwind.config.js` 의 `fontFamily.sans` 1순위 **Pretendard** | `NotoSansKR_400Regular` | Pretendard 는 npm 에 배포되지 않아 expo-font 로 로드할 수 없다. `docs/design-system/typography.md` 가 "Pretendard **또는** Noto Sans KR" 를 허용하고, 목업의 폴백 사슬에도 Noto Sans KR 이 들어 있어 웹 렌더와도 어긋나지 않는다. |
| 감성 세리프 | 목업 `fontFamily.serif` = **Noto Serif KR**, `typography.md` 는 **마루 부리** 를 1순위로 든다 | `GowunBatang_400Regular` | 마루 부리는 Google Fonts 에 없어 `@expo-google-fonts/*` 로 받을 수 없다. `typography.md` 가 "마루 부리 **또는 커스텀**" 을 허용하므로 같은 계열의 Gowun Batang 을 커스텀 선택으로 쓴다. |
| 손글씨 (hand) | 목업 `fontFamily.hand` = **Nanum Pen Script** (M-01 의 "기록을 책으로" 등) | `GowunBatang_400Regular` | 손글씨 전용 패밀리를 따로 싣지 않고 감성 세리프로 대체한다. `typography.md` 가 감성 카피에 "손글씨 **또는** 세리프 계열" 을 모두 허용한다. 대체 사유는 `app/app/(landing)/index.tsx` 의 tagline 주석에도 적혀 있다. |

<!-- deviations:end -->

## 4. 이 레지스트리가 아직 하지 않는 것

- **카피·구조·수치 전수 대조** — 매핑이 생겼으니 이제 가능해졌지만 이번 슬라이스 범위 밖이다.
  (등록 시점 확인된 후보: M-02 는 하단 `PrimaryButton`("다음")을 갖지만 `q1.tsx` 는 선택 즉시 전환하고,
  제목 굵기가 목업 700 대 구현 600.)
- **그림자 토큰의 to-be 내부 모순** — 구현 `app/src/theme/shadows.ts` 는 `docs/design-system/tokens.md`
  (Soft `0 1px 4px .04` · Card `0 2px 12px .06` · Elevated `0 4px 20px .10`)와 **완전히 일치**하지만,
  목업 `tailwind.config.js` 의 `db-sm 0 2px 8px .06` · `db-md 0 4px 16px .08` · `db-lg 0 8px 24px .12` 는
  그 문서와 이름도 값도 다르다. **어긋난 두 소스가 모두 to-be 쪽**이므로 구현을 목업에 맞추는 기본
  방향을 그대로 적용하면 이미 정합인 구현 토큰 3개를 깨게 된다. 토큰 SSOT(`design-system/tokens.md`)에
  목업 config 를 맞추는 것이 기본 방향이며, 목업 소스를 고치면 `docs/index.html` 재빌드가 같은 커밋에
  따라와야 하고 목업의 시각 자체가 바뀌므로 별도 슬라이스로 둔다.
- **실행 스크린샷 픽셀 비교** — 모델 정의상 범위 밖(정적 대조로 확정).
