---
doc_id: GLOSSARY-001
doc_type: glossary
product: dear_baby
created: 2026-04-15
updated: 2026-04-15
---

# 용어집 (Glossary)

코드에서 사용되는 식별자(영문)와 문서·UI에서 사용되는 용어(한국어)의 싱크를 맞추기 위한 단일 참조 문서다. 새로운 도메인 개념을 구현하기 전에 이 용어집을 먼저 확인하고, 본 용어집에 없는 새로운 개념을 도입할 때는 이 문서를 함께 갱신한다.

## 사용 원칙

1. **단일 소스**: 한국어 도메인 용어 → 영문 식별자 번역은 항상 이 문서를 기준으로 한다
2. **제안 이름 존중**: 아직 구현되지 않은 개념도 "제안" 이름을 미리 정해두었다. 구현 시 이 이름을 그대로 사용한다
3. **문서 ↔ 코드 동기화**: PRD에 새 도메인 개념이 추가되면 본 용어집에도 행을 추가한다. 코드에서 새 도메인 식별자를 도입하면 본 용어집에 번역을 추가한다

## 명명 규칙 (Naming Conventions)

| 맥락 | 규칙 | 예시 |
|---|---|---|
| TypeScript 타입/인터페이스 | `PascalCase` | `User`, `Session`, `Record` |
| TypeScript 변수/함수/훅 | `camelCase` | `currentPregnancyWeek`, `useDailyQuestion` |
| Go 공개 심볼 | `PascalCase` | `User`, `RefreshStore`, `Claims` |
| Go 비공개 심볼 | `camelCase` | `newUser`, `parseToken` |
| DB 테이블·컬럼 | `snake_case` | `oauth_accounts`, `picture_url` |
| REST JSON 필드 | `snake_case` | `access_token`, `refresh_token` |
| React Native 컴포넌트 파일 | `PascalCase.tsx` | `Button.tsx`, `IconCircle.tsx` |
| Theme 토큰 키 | `camelCase` (중첩) | `colors.primary.coral`, `colors.icon.voice` |

> **경계 변환**: API에서 받은 snake_case JSON은 프론트에서 camelCase로 매핑한다. 현재는 `app/src/api/types.ts` 의 `SessionResponse` → `Session` 에서 수동 변환.

## 도메인 엔티티 (Domain Entities)

"제안" 표시는 아직 코드로 구현되지 않은 개념이다. 구현 시 이 이름을 그대로 사용할 것.

| 한국어 용어 | 타입명 (TS/Go) | 변수명 | API/DB 필드 | 정의 | 참조 |
|---|---|---|---|---|---|
| 사용자 | `User` | `user` | `users` / `user_id` | 계정 소유자. OAuth로 인증된 임산부 사용자 | `backend/internal/users/model.go`, `app/src/api/types.ts:1` |
| 세션 | `Session` | `session` | — (JWT) | 인증 상태. `accessToken` + `refreshToken` + `user` 로 구성 | `app/src/api/types.ts:10` |
| 기록 | `Record` | `record`, `records` | 로컬 `db_records_v1` (AsyncStorage) / `id` | 사용자가 작성한 일기 단위. 음성 또는 텍스트로 작성되며 미디어 첨부 가능. 현재는 로컬 저장소에만 존재하며 백엔드 동기화는 후속 PRD에서 도입 | `app/src/records/types.ts`, PRD-001, PRD-005 |
| 음성 일기 | `Record` (subtype: `type: 'voice'`) | `voiceRecord` | `records.type = 'voice'` | 음성 녹음에서 시작된 기록. 별도 타입이 아닌 `Record` 의 하위 분류 | `app/src/records/types.ts`, PRD-001, V-004 |
| 오늘의 질문 *(제안)* | `DailyQuestion` | `dailyQuestion`, `todaysQuestion` | `daily_questions` / `question_id` | 임신 주차 기반으로 매일 제공되는 프롬프트 | PRD-002, V-005 |
| 서사 *(제안)* | `Narrative` | `narrative` | `narratives` / `narrative_id` | AI가 여러 기록을 엮어 생성한 편지 형식의 이야기 | PRD-003, V-003 |
| 실물 책 *(제안)* | `Book` | `book` | `books` / `book_id` | 서사와 미디어로 제작된 물리적 책 제품 | PRD-004, V-006 |
| 미디어 *(제안)* | `Media` | `media`, `mediaItem` | `media` / `media_id`, `media_type` | 기록에 첨부된 사진/영상/음성 메모 | PRD-005, V-007 |
| 임신 주차 *(제안)* | `PregnancyWeek` (number) | `pregnancyWeek`, `currentWeek` | `pregnancy_week` | 출산 예정일 기반으로 계산된 현재 주차 | PRD-002, AC-002-02 |
| 출산 예정일 *(제안)* | `DueDate` (ISO 8601 date string) | `dueDate` | `due_date` | EDD. 사용자가 입력하며 임신 주차 계산의 기준 | PRD-002, AC-002-02 |
| OAuth 계정 연결 | — (DB only) | — | `oauth_accounts` / `provider`, `provider_user_id` | 사용자와 외부 OAuth 제공자(예: Google)의 연결 | `backend/internal/migrations/0001_users.up.sql` |
| 리프레시 토큰 저장소 | `RefreshStore` | `refreshStore` | `refresh_tokens` | 서버에 영속되는 리프레시 토큰 레코드 | `backend/internal/auth/store.go` |

## 문서 ID 체계

`docs/README.md` 의 ID 체계를 코드/도메인과 함께 한자리에서 조회할 수 있도록 재게시한다.

| ID 패턴 | 의미 | 예시 |
|---|---|---|
| `dear_baby` | 제품 식별자 | (front matter `product` 필드) |
| `V-NNN` | 제품 가치 (V-001~V-007) | `V-001` |
| `VDOC-NNN` | 가치 문서 | `VDOC-001` |
| `PRD-NNN` | 제품 요구 문서 | `PRD-001` |
| `AC-PRD-NN` | 인수 조건 | `AC-001-01` |
| `TEST-NNN` | 테스트 문서 | `TEST-001` |
| `GLOSSARY-NNN` | 용어집 (본 문서) | `GLOSSARY-001` |

## 디자인 토큰 매핑 (Design Tokens)

디자인 문서에 쓰이는 한국어/영문 라벨과 `app/src/theme/*.ts` 의 코드 식별자를 매핑한다. Border Radius / Spacing / Elevation 토큰은 `docs/design-system/tokens.md` 에 표로 정의되어 있으므로 여기서는 중복하지 않는다.

### Color Tokens

| 디자인 문서 표기 | 코드 식별자 | 값 |
|---|---|---|
| Warm Coral | `colors.primary.coral` | `#D4836B` |
| Soft Peach | `colors.primary.peach` | `#F5C6A8` |
| Cream White | `colors.bg.cream` | `#FAF6F1` |
| Warm Beige | `colors.bg.beige` | `#F0E6D8` |
| Ivory | `colors.surface.ivory` | `#FFFFFF` |
| Sage Green | `colors.accent.sage` | `#A8C5A0` |
| Muted Teal | `colors.accent.teal` | `#7BACA3` |
| Soft Gold | `colors.accent.gold` | `#D4B896` |
| Dark Brown | `colors.text.primary` | `#3D2E1E` |
| Warm Gray | `colors.text.secondary` | `#8C7B6B` |
| Light Gray-Brown | `colors.text.muted` | `#B5A898` |
| 흰색 (on primary) | `colors.text.onPrimary` | `#FFFFFF` |
| 음성 아이콘 배경 | `colors.icon.voice` | `#F5C6A8` |
| 질문 아이콘 배경 | `colors.icon.question` | `#FDDDD5` |
| 질문 아이콘 배경 (대체) | `colors.icon.questionAlt` | `#C8E0E0` |
| 책 아이콘 배경 | `colors.icon.book` | `#D8E8D4` |
| 책 아이콘 배경 (대체) | `colors.icon.bookAlt` | `#D8E0D4` |
| AI 아이콘 배경 | `colors.icon.ai` | `#E0D4C4` |
| AI 아이콘 배경 (대체) | `colors.icon.aiAlt` | `#E8DCC8` |
| 그림자 기준색 | `colors.shadow` | `#3D2E1E` |

> 아이콘 배경 키(`voice`, `question`, `book`, `ai`)는 PRD-001~004 각 기능의 대표 색을 뜻한다. 새로운 도메인 카테고리를 추가할 때는 본 명명 규칙(도메인 의미 기반 키)을 따른다.

## 탭 / 화면 용어

UI에 노출되는 한국어 라벨과 라우트 파일 매핑.

| UI 라벨 | 라우트/파일 | 탭 `title` |
|---|---|---|
| 홈 | `app/app/(tabs)/index.tsx` | `'홈'` |
| 기록 | `app/app/(tabs)/records.tsx` | `'기록'` |
| 마이 | `app/app/(tabs)/settings.tsx` | `'마이'` |
| 음성으로 기록 | `app/app/record/voice.tsx` | `'음성으로 기록'` |
| 텍스트로 작성 | `app/app/record/text.tsx` | `'텍스트로 작성'` |
| 기록 상세 | `app/app/record/[id].tsx` | `'기록'` |

> "마이" 탭의 파일명은 `settings.tsx` 이지만 UI 라벨은 `'마이'` 다. `app/app/(tabs)/_layout.tsx` 의 `Tabs.Screen name="settings" options={{ title: '마이' }}` 참조.

## 인증 / 토큰 필드 표기

API 경계에서 발생하는 `snake_case` ↔ `camelCase` 변환을 명시한다.

| 개념 | 백엔드·API (snake_case) | 프론트 (camelCase) |
|---|---|---|
| 액세스 토큰 | `access_token` | `accessToken` |
| 리프레시 토큰 | `refresh_token` | `refreshToken` |
| 프로필 사진 URL | `picture_url` | `pictureUrl` (변환 시) |
| 생성 시각 | `created_at` | `createdAt` (변환 시) |
| 수정 시각 | `updated_at` | `updatedAt` (변환 시) |

변환 지점: `app/src/api/types.ts` — `SessionResponse` 를 프론트에서 `Session` 으로 매핑할 때.

## 유지보수

- **새 도메인 개념 도입 시**: PRD 작성 → 본 용어집에 행 추가 → 구현 시 본 용어집의 이름 사용
- **기존 용어 변경 시**: 문서(PRD/디자인)와 코드(타입/변수) 를 함께 수정하고, 본 용어집을 최종 권위로 갱신
- **리뷰 체크리스트**: PR에서 새 도메인 타입·테이블·API 필드를 도입했다면 용어집이 갱신되었는지 확인
