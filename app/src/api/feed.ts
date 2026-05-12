// Feed mock — PRD-007 AC-007-08·09 의 타인 기록 피드.
//
// 백엔드 피드 API 가 아직 없으므로 결정적 mock 풀을 둔다. 시그니처는 백엔드
// 도착 시 그대로 유지하여 export 만 교체 가능하도록 좁게 잡았다 (홈 화면이
// 의존하는 표면적은 `getTopThreeForHome(): Promise<FeedEntry[]>` 한 줄뿐).
//
// 정렬·필터·비식별화·답변 컷은 모두 본 모듈에서 수행한다 — 호출자는 결과만
// 카드로 렌더한다.

// PRD-007 AC-007-08 — 카드 한 장에 들어가는 모든 필드. `isPublic`/`isMine`
// 은 셀렉터(getTopThreeForHome) 내부 필터에만 쓰이고 카드 컴포넌트에는 노출
// 되지 않는다. UI 단에서 그 두 필드를 분기로 쓸 일이 없도록 의도적으로
// FeedEntry 에 남겨 두었다.
export type FeedEntry = {
  id: string;
  // 비식별화된 노출용 alias (예: 'cho***3'). 같은 author 는 같은 alias 로
  // 매핑되어야 한다 — 본 mock 풀에서는 미리 계산된 값을 사용한다.
  authorAlias: string;
  // 작성자의 아이 컨텍스트 (예: '임신 3주차', '생후 5개월', '4살').
  childContext: string;
  question: string;
  // 50자 컷 + '…' 처리는 셀렉터가 담당한다. mock 풀에는 원문을 그대로 둔다.
  answer: string;
  heartCount: number;
  isPublic: boolean;
  isMine: boolean;
};

// PRD-007 AC-007-08 — 답변 노출 글자 수. 디자인 단계에서 카드 폭과 함께
// 재조정될 예정 (PRD-007 후속 검토 항목).
export const FEED_ANSWER_SNIPPET_LIMIT = 50;

// 홈 피드에 노출되는 최대 카드 수. PRD-007 AC-007-08 — 상위 3개.
export const FEED_HOME_LIMIT = 3;

// 결정적 mock 풀. 시각 출처 카피: docs/mockups/source/src/screens/
// HomePregnancyScreen.tsx L109-112. 필터 검증을 위해 비공개 1건, 자기
// 기록 1건도 포함한다 (`isPublic=false`, `isMine=true`).
const MOCK_FEED_POOL: readonly FeedEntry[] = [
  {
    id: 'feed-1',
    authorAlias: 'cho***3',
    childContext: '임신 3주차',
    question: '엄마, 오늘 저를 처음 알게 된 기분은 어땠어요?',
    answer:
      '두 줄짜리 임테기를 보고 한참을 멍하니 앉아 있었어. 손이 떨려서 한참 동안 화장실을 못 나왔어.',
    heartCount: 50,
    isPublic: true,
    isMine: false,
  },
  {
    id: 'feed-2',
    authorAlias: 'seo***1',
    childContext: '생후 5개월',
    question: '엄마, 제가 오늘 처음으로 보여준 표정이 뭐였어요?',
    answer:
      '옹알이를 하다가 갑자기 씨익 웃었는데, 그 순간 시간이 멈춘 것 같았어.',
    heartCount: 365,
    isPublic: true,
    isMine: false,
  },
  {
    id: 'feed-3',
    authorAlias: 'abc***9',
    childContext: '4살',
    question: '엄마, 제가 오늘 했던 말 중에 어떤 게 가장 웃겼어요?',
    answer:
      '"엄마 나는 어른 되면 공룡이 될 거야"라고 말해서 한참을 웃었어. 무슨 공룡이 되고 싶냐고 물어보니 \"티라노\" 라고.',
    heartCount: 12,
    isPublic: true,
    isMine: false,
  },
  {
    id: 'feed-4',
    authorAlias: 'pak***7',
    childContext: '임신 20주차',
    question: '엄마, 오늘은 제가 어떤 노래를 듣고 싶어 했을까요?',
    answer:
      '내가 좋아하는 옛날 발라드를 한 곡 틀어 줬어. 배가 살짝 움직이는 것 같았는데, 너도 같이 듣고 있었던 거지?',
    heartCount: 88,
    isPublic: true,
    isMine: false,
  },
  // 비공개 — 필터링되어야 한다 (heartCount 가 가장 높지만 노출 X).
  {
    id: 'feed-private',
    authorAlias: 'kim***5',
    childContext: '생후 8개월',
    question: '엄마, 오늘 처음으로 잡고 일어선 게 어떤 기분이었어요?',
    answer: '거실 소파 끝을 잡고 휘청거리며 일어섰는데, 눈물이 핑 돌더라.',
    heartCount: 999,
    isPublic: false,
    isMine: false,
  },
  // 자기 기록 — 필터링되어야 한다 (heartCount 가 두 번째로 높지만 노출 X).
  {
    id: 'feed-mine',
    authorAlias: 'me***0',
    childContext: '임신 28주차',
    question: '엄마, 오늘은 제가 엄마에게 어떤 말을 건네고 싶었을까요?',
    answer: '오늘은 아빠가 네 이름을 처음 불러 봤어. 어색해 하면서도 좋아했지.',
    heartCount: 500,
    isPublic: true,
    isMine: true,
  },
];

// 50자 컷 + '…' 마커. 원문이 limit 이하면 그대로 반환, 초과면 잘라낸 뒤
// 'snippet…' 형태로 반환한다. 카드 UI 단에서 '…' 을 다른 색(text.muted) 으로
// 칠하려면 컴포넌트 쪽에서 다시 마커를 분리해 처리한다.
export function truncateAnswer(
  text: string,
  limit: number = FEED_ANSWER_SNIPPET_LIMIT,
): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
}

// PRD-007 AC-007-08·09 — 홈 피드에 노출되는 상위 3개.
//   1) 비공개·자기 기록 제외
//   2) ♥ 내림차순 정렬 (동률은 풀 등장 순서를 유지하기 위한 안정적 정렬)
//   3) 상위 FEED_HOME_LIMIT 개
//   4) answer 를 FEED_ANSWER_SNIPPET_LIMIT 자로 컷
//
// 동기 구현으로 충분하지만, 백엔드 호출로 교체될 자리이므로 Promise 시그니처
// 를 유지한다.
export async function getTopThreeForHome(
  pool: readonly FeedEntry[] = MOCK_FEED_POOL,
): Promise<FeedEntry[]> {
  const visible = pool.filter((e) => e.isPublic && !e.isMine);
  // pool 내 등장 순서를 보존하기 위해 안정 정렬 — Array.prototype.sort 는
  // ECMAScript 2019 부터 안정 정렬이 보장된다 (RN 의 Hermes·JSC 모두 충족).
  const sorted = [...visible].sort((a, b) => b.heartCount - a.heartCount);
  const top = sorted.slice(0, FEED_HOME_LIMIT);
  return top.map((e) => ({ ...e, answer: truncateAnswer(e.answer) }));
}
