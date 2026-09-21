// 커뮤니티 피드 클라이언트 — PRD-009 (커뮤니티 탭).
//
// `GET /v1/community/feed` 를 감싼다. 노출 풀·정렬·페이지네이션·표시명 마스킹·
// 미리보기 50자 컷은 **전부 서버가 끝내서** 내려주므로 (ENG-007·008·009·010,
// AC-009-10) 이 모듈은 필터링도 정렬도 자르기도 하지 않는다 — 같은 규칙을
// 클라이언트가 다시 구현하면 두 벌의 진실이 생기고, 예전 mock 셀렉터가 바로
// 그 상태였다.
//
// 홈 화면(AC-009-14)이 의존하는 표면은 `getTopThreeForHome(subjectId)` 하나다.
// 커뮤니티 탭(AC-009-02)은 같은 모듈의 `getCommunityFeed` 를 커서·`type` 과
// 함께 쓴다.

import { apiFetch } from './client';

// CommunityFeedItem — 카드 한 장이 쓰는 필드. 서버 `FeedItem` 의 1:1 대응이며
// 이름만 camelCase 로 옮긴다.
export type CommunityFeedItem = {
  id: string;
  /** AC-009-10 마스킹 표시명 (예: 'seo***1'). 서버가 마스킹해 내려준다. */
  authorName: string;
  /**
   * 작성 당시 작성자의 아이 현황 (예: '임신 20주차', '생후 5개월', '2살').
   * ENG-011 의 "기준 시점 = 작성 당시" 규칙이라 작성자의 현재 상태가 아니다.
   * 산출 불가(예정일/생일 미설정 등)면 빈 문자열 — 카드가 줄을 생략한다.
   */
  childStatusText: string;
  subjectKind: 'fetus' | 'child';
  source: 'text' | 'voice';
  /** AI 질문 답변이면 질문 원문, 자유 일기면 null. */
  questionText: string | null;
  /** 본문 미리보기. 서버가 50자로 자르고 초과 시 '…' 를 붙여 보낸다. */
  preview: string;
  createdAt: string;
};

// CommunityFeedType — AC-009-06 콘텐츠 타입 필터. 값은 서버 enum 과 같은
// 문자열이라 그대로 쿼리에 실린다. 어떤 기록이 어느 타입인지의 판정
// (question_text 유무)은 전적으로 서버 몫이다 — 클라이언트가 페이지 안에서
// 다시 거르면 커서 페이지네이션과 어긋나 "다음 페이지엔 있는데 빈 화면"이
// 나온다.
export type CommunityFeedType = 'all' | 'question' | 'diary';

// AC-009-06 기본 선택값.
export const DEFAULT_FEED_TYPE: CommunityFeedType = 'all';

// 홈 "다른 엄마들의 기록" 섹션에 노출되는 최대 카드 수 (AC-009-14 — 최대 3개).
export const HOME_FEED_LIMIT = 3;

type FeedItemPayload = {
  id: string;
  author_name: string;
  child_status_text: string;
  subject_kind: 'fetus' | 'child';
  source: 'text' | 'voice';
  question_text: string | null;
  preview: string;
  created_at: string;
};

type CommunityFeedPayload = {
  items: FeedItemPayload[] | null;
  next_cursor: string;
};

export type CommunityFeedPage = {
  items: CommunityFeedItem[];
  /** 빈 문자열이면 다음 페이지 없음. */
  nextCursor: string;
};

function toItem(raw: FeedItemPayload): CommunityFeedItem {
  return {
    id: raw.id,
    authorName: raw.author_name,
    childStatusText: raw.child_status_text ?? '',
    subjectKind: raw.subject_kind,
    source: raw.source,
    questionText: raw.question_text,
    preview: raw.preview,
    createdAt: raw.created_at,
  };
}

export type CommunityFeedOptions = {
  /**
   * 열람자의 활성 아이 `record_subjects.id`. 서버가 이 subject 의 kind 로
   * 노출 풀을 고르므로(임신 case → 태아 기록, 육아 case → 아이 기록) 필수다.
   */
  subjectId: string;
  cursor?: string;
  limit?: number;
  /** AC-009-06 콘텐츠 타입 필터. 생략 = `all`(전체) — 서버 기본값과 같다. */
  type?: CommunityFeedType;
};

// getCommunityFeed — 피드 한 페이지. 비200 응답은 throw 해서 호출자가 오류
// 상태(AC-009-13 '기록을 불러오지 못했어요')를 그리게 한다. 네트워크 예외는
// fetch 가 그대로 reject 하므로 별도 변환 없이 전파된다.
export async function getCommunityFeed(
  options: CommunityFeedOptions,
): Promise<CommunityFeedPage> {
  if (!options.subjectId) {
    throw new Error('getCommunityFeed requires subjectId');
  }
  const params = new URLSearchParams();
  params.set('subject_id', options.subjectId);
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.limit != null) params.set('limit', String(options.limit));
  // `all` 은 서버 기본값이라 굳이 싣지 않는다 — 홈(AC-009-14)이 보내는
  // 요청이 이 슬라이스 전후로 바이트 동일하게 유지된다.
  if (options.type && options.type !== DEFAULT_FEED_TYPE) {
    params.set('type', options.type);
  }
  const res = await apiFetch(`/community/feed?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    throw new Error(`getCommunityFeed failed: ${res.status}`);
  }
  const body = (await res.json()) as CommunityFeedPage & CommunityFeedPayload;
  return {
    items: (body.items ?? []).map(toItem),
    nextCursor: body.next_cursor ?? '',
  };
}

// getTopThreeForHome — 홈 섹션용 상위 3건 (AC-009-14). 서버가 이미 최신순으로
// 정렬해 내려주므로 limit 만 걸어 첫 페이지를 받는다.
export async function getTopThreeForHome(
  subjectId: string,
): Promise<CommunityFeedItem[]> {
  const page = await getCommunityFeed({ subjectId, limit: HOME_FEED_LIMIT });
  return page.items.slice(0, HOME_FEED_LIMIT);
}
