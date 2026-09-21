// CommunityFeedCard — M-43 `FeedCard` 대응 컴포넌트.
//
// 이 테스트가 잠그는 것은 두 가지다:
//   (a) 목업이 요구하는 요소가 실제로 그려지는가 (표시명·아이 현황·질문/배지·미리보기)
//   (b) **목업이 요구하지만 데이터가 없어 뺀 요소가 조용히 되살아나지 않는가**
//       (공감 수 ❤️ · 댓글 수 💬). 0 이나 임의 값을 찍는 회귀를 막는다.

import { render } from '@testing-library/react-native';

import type { CommunityFeedItem } from '../../api/community';
import { CommunityFeedCard, DIARY_BADGE_LABEL } from '../CommunityFeedCard';

function entry(overrides: Partial<CommunityFeedItem> = {}): CommunityFeedItem {
  return {
    id: 'r-1',
    authorName: 'seo***1',
    childStatusText: '생후 5개월',
    subjectKind: 'child',
    source: 'text',
    questionText: '엄마, 제가 오늘 처음으로 보여준 표정이 뭐였어요?',
    preview: '옹알이를 하다가 갑자기 씨익 웃었는데…',
    createdAt: '2026-08-07T09:30:00Z',
    ...overrides,
  };
}

describe('CommunityFeedCard — 질문답변', () => {
  it('표시명·아이 현황·질문·미리보기를 그린다', () => {
    const { getByTestId } = render(<CommunityFeedCard entry={entry()} />);
    expect(getByTestId('community-feed-card-alias').props.children).toBe(
      'seo***1',
    );
    expect(getByTestId('community-feed-card-stage').props.children).toBe(
      '생후 5개월',
    );
    expect(getByTestId('community-feed-card-question').props.children).toBe(
      '엄마, 제가 오늘 처음으로 보여준 표정이 뭐였어요?',
    );
    expect(getByTestId('community-feed-card-preview')).toBeTruthy();
  });

  // M-43 은 자유일기에만 배지를 붙인다 — 질문답변은 질문 텍스트가 타입을 말한다.
  it('타입 배지를 붙이지 않는다', () => {
    const { queryByTestId } = render(<CommunityFeedCard entry={entry()} />);
    expect(queryByTestId('community-feed-card-type-badge')).toBeNull();
  });
});

describe('CommunityFeedCard — 자유일기', () => {
  it('질문 대신 자유일기 배지를 그린다', () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <CommunityFeedCard entry={entry({ questionText: null })} />,
    );
    expect(getByTestId('community-feed-card-type-badge')).toBeTruthy();
    expect(getByText(DIARY_BADGE_LABEL)).toBeTruthy();
    expect(queryByTestId('community-feed-card-question')).toBeNull();
  });

  // AC-009-06 의 필터 라벨과 같은 어휘여야 사용자가 같은 것을 두 이름으로
  // 배우지 않는다.
  it('배지 문구는 필터 라벨과 같은 "자유일기" 다', () => {
    expect(DIARY_BADGE_LABEL).toBe('자유일기');
  });
});

describe('CommunityFeedCard — 없는 값은 그리지 않는다', () => {
  it('아이 현황이 빈 문자열이면 그 줄을 아예 생략한다', () => {
    const { queryByTestId } = render(
      <CommunityFeedCard entry={entry({ childStatusText: '' })} />,
    );
    expect(queryByTestId('community-feed-card-stage')).toBeNull();
  });

  // 이탈 1·2 의 회귀 방지선. likes/comments 테이블이 없는 동안 이 카드는
  // 하트도 댓글 수도 그리지 않는다 — 0 을 찍는 것도 지어낸 값이다.
  it('공감 수·댓글 수를 그리지 않는다 (테이블 부재 — AC-009-08·09 미구현)', () => {
    const { toJSON } = render(<CommunityFeedCard entry={entry()} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain('❤️');
    expect(tree).not.toContain('💬');
    expect(tree).not.toContain('댓글');
  });
});

describe('CommunityFeedCard — 미리보기 말줄임', () => {
  it("서버가 붙인 '…' 를 muted 색 조각으로 분리한다", () => {
    const { getByTestId } = render(<CommunityFeedCard entry={entry()} />);
    const preview = getByTestId('community-feed-card-preview');
    const children = preview.props.children as {
      0: string;
      1: { props: { children: string; color: string } };
    };
    expect(children[0]).toBe('옹알이를 하다가 갑자기 씨익 웃었는데');
    expect(children[1].props.children).toBe('…');
    expect(children[1].props.color).toBe('muted');
  });

  it("'…' 가 없으면 조각을 만들지 않는다", () => {
    const { getByTestId } = render(
      <CommunityFeedCard entry={entry({ preview: '짧은 기록' })} />,
    );
    const children = getByTestId('community-feed-card-preview').props
      .children as unknown[];
    expect(children[0]).toBe('짧은 기록');
    expect(children[1]).toBeNull();
  });
});
