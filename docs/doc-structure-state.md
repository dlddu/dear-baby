# 디어베이비 디자인 문서 구조 상태 추적

`design-doc-structure-validator` 스킬의 상태 추적 산출물. 가치 → 사용자 여정 → 여정 mockup ↔
디자인 시스템의 프론트엔드 사슬이 끊긴 데 없이 이어져 있는지, 그리고 그 전부가 실제로 공개되어
읽히는지를 추적한다. 가치 → PRD → AC → 테스트의 백엔드 사슬은 [`doc-tracker.md`](doc-tracker.md) 소관.

- **마지막 검증**: 2026-08-29
- **공개 URL**: <https://dlddu.github.io/dear-baby/> (Pages: `Deploy from a branch` · `main` · `/docs`)
- **레포 공개 범위**: public — `docs/` 아래 문서는 전 세계에 공개된다. 비공개 유지 문서 없음.

## 배포 골격

| 항목 | 위치 | 상태 |
|---|---|---|
| 허브 | `docs/index.html` | ✅ 문서 포털 (제품 문서 / 여정 / 디자인 시스템 / mockup) |
| 리더 | `docs/reader.html` | ✅ 마크다운 뷰어 (단일 파일, 외부 네트워크 의존 없음) |
| Jekyll 우회 | `docs/.nojekyll` | ✅ |
| 여정 mockup | `docs/journeys/<journey-id>/index.html` | 🟡 6개 중 1개 |
| 화면 갤러리 | `docs/mockups/index.html` | ✅ 43화면 단일 번들 (전환 완료 후 색인 역할) |

## 여정 ↔ mockup 연결

| 여정 | 여정 식별자 | 문서 | 단계 | 여정 mockup | 화면 |
|---|---|---|---|---|---|
| 일기 열람 | `diary-browse` | ✅ | 4 (`STP-*`) | ✅ [`journeys/diary-browse/`](journeys/diary-browse/index.html) | M-36·37·38·39·40·41·42 |
| 온보딩 | — | ✅ | 4 (Stage N) | ⬜ 미전환 | M-01~M-16, M-35 |
| 일상 기록 | — | ✅ | 2 (Stage N) | ⬜ 미전환 | M-17~M-22 |
| 출산 전환 | — | ✅ | 5 (Stage N) | ⬜ 미전환 | M-23~M-26 |
| AI 서사 | — | ✅ | 4 (Stage N) | ⬜ 미전환 | M-27~M-30 |
| 책 제작 | — | ✅ | 6 (Stage N) | ⬜ 미전환 | M-31~M-34 |
| (커뮤니티) | — | ❌ 없음 | — | — | M-43 |

## 마이그레이션 진행 상황 (화면 단위 → 여정 단위)

**옮긴 여정 1 / 6 · 남은 화면 36 / 43.**

여정 단위 mockup은 `docs/mockups/source`의 React 소스에서 parcel multi-page 빌드로 생성한다.
여정 하나 = 진입 HTML 하나(`journeys/<id>.html`) + 단계 정의 하나(`src/journey/<id>.tsx`) +
공통 셸(`src/journey/JourneyShell.tsx`). 빌드 후 `html-inline`으로 단일 파일로 만들어
`docs/journeys/<journey-id>/index.html`에 놓는다.

| 순서 | 여정 | 상태 | 메모 |
|---|---|---|---|
| 1 | 일기 열람 | ✅ 완료 | 파일럿. 문서 단계와 인덱스 번호가 유일하게 일치해 배선 검증에 사용 |
| 2 | 온보딩 | ⬜ | 화면 17개로 가장 큼. Case A/B/C 분기를 요건 6으로 표현해야 함 |
| 3 | 일상 기록 | ⬜ | 문서 2단계 vs 화면 6개 — 단계 매핑 확정 필요 |
| 4 | 출산 전환 | ⬜ | **누락 단계 2건** (아래) |
| 5 | AI 서사 | ⬜ | 인덱스 번호가 문서보다 한 칸 밀려 있음 (8-x vs 9-x) |
| 6 | 책 제작 | ⬜ | **누락 단계 2건** (아래) · 인덱스 번호 밀림 (9-x vs 10-x) |

원본 화면은 삭제하지 않는다. 갤러리(`docs/mockups/index.html`)가 43화면 전부를 계속 담고,
여정 mockup은 그 화면들을 여정 맥락으로 다시 배열한 것이다.

## 위험 진단

| 위험 | 대상 | 상태 |
|---|---|---|
| 누락 단계 | 출산 전환 `Stage 7-1`(D-7 푸시 알림) · `Stage 8`(양육자 모드 첫 기록) | 🟡 화면 신규 작성 필요 |
| 누락 단계 | 책 제작 `Stage 12-1`(책 수령) · `Stage 12-2`(아이에게 선물) | 🟡 가치 사슬 완결부라 우선순위 높음 |
| 고아 mockup | M-43 커뮤니티 메인 — 여정 문서 없음 (PRD-009는 draft) | 🟡 아래 수용된 위험 참조 |
| 단계 식별자 불일치 | 미전환 5개 여정의 여정 문서 Stage 번호 ↔ `mockups/README.md` 번호 | 🟡 전환 시 여정별로 해소 |
| 흐름 체험 불가 (부분) | 여정 mockup 요건 4 — 화면 내 개별 CTA 미배선 | 🟡 아래 수용된 위험 참조 |

## 수용된 위험

- **요건 4(화면 안에서의 전진) 부분 충족** — 여정 mockup에서 폰 화면을 누르면 다음 단계로
  넘어가지만, 화면 안의 개별 버튼(예: "저장", "다음")이 각자 대응 단계로 연결되지는 않는다.
  화면 컴포넌트 43개에 `onAdvance`를 배선하는 작업이라 전환 6개가 끝난 뒤로 미룬다.
  단계 전환·현재 위치·딥링크·분기·문서 복귀(요건 2·3·5·6·8)는 충족한다.
- **M-43 커뮤니티는 갤러리에만 존재** — PRD-009가 draft라 여정 문서를 쓰지 않았다. draft가
  풀릴 때 여정 문서를 만들고(`user-journey-writer`) 여정 mockup으로 옮긴다. 그때까지 고아로 둔다.
- **여정 문서 5개는 아직 Stage 번호 체계** — 단계 식별자를 `STP-<슬러그>`로 바꾸는 것은 여정
  문서 수정이라 `user-journey-writer` 영역이다. 전환하는 여정만 그때그때 바꾼다(일괄 개정 안 함).

## 변경 이력

| 날짜 | 변경 | 이전 | 이후 |
|---|---|---|---|
| 2026-08-29 | 배포 골격 도입 + 여정 단위 전환 착수. ① `docs/reader.html`·`docs/.nojekyll` 추가 ② 여정 문서를 `docs/journeys/` → `docs/user-journeys/`로 이동해 `docs/journeys/`를 여정 mockup 자리로 비움 ③ 갤러리 번들을 `docs/index.html` → `docs/mockups/index.html`로 이동하고 그 자리에 문서 포털 허브 신설 ④ 일기 열람 여정을 여정 단위 mockup으로 전환(파일럿) | 허브 없음 · 리더 없음 · 여정 mockup 0/6 · 문서 51개 raw 다운로드 | 허브·리더 있음 · 여정 mockup 1/6 · 문서 51개 열람 가능 |
