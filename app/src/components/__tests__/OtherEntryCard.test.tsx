// PRD-007 AC-007-08 — 타인 기록 피드 카드의 필드 노출·탭 라우팅 잠금.
// TC-007-08 (모든 필드 렌더 + 탭 가능) 을 단위 레벨에서 고정한다.

import { fireEvent, render } from '@testing-library/react-native';

import type { FeedEntry } from '../../api/feed';
import { OtherEntryCard } from '../OtherEntryCard';

const baseEntry: FeedEntry = {
  id: 'feed-1',
  authorAlias: 'cho***3',
  childContext: '임신 3주차',
  question: '엄마, 오늘 저를 처음 알게 된 기분은 어땠어요?',
  answer: '두 줄짜리 임테기를 보고 한참을 멍하니 앉아 있었어. 손이 떨려서…',
  heartCount: 50,
  isPublic: true,
  isMine: false,
};

describe('OtherEntryCard', () => {
  describe('TC-007-08 — 카드 필드 노출', () => {
    it('renders alias, child context, question, and heart count', () => {
      const { getByTestId } = render(<OtherEntryCard entry={baseEntry} />);
      expect(getByTestId('other-entry-card-alias').props.children).toBe(
        'cho***3',
      );
      expect(getByTestId('other-entry-card-context').props.children).toBe(
        '임신 3주차',
      );
      expect(getByTestId('other-entry-card-question').props.children).toBe(
        '엄마, 오늘 저를 처음 알게 된 기분은 어땠어요?',
      );
      expect(getByTestId('other-entry-card-hearts').props.children).toBe(50);
    });

    it('renders the answer snippet body and the ellipsis marker', () => {
      const { getByTestId } = render(<OtherEntryCard entry={baseEntry} />);
      const answer = getByTestId('other-entry-card-answer');
      // body + 마커가 별도 children 으로 들어간다 (마커는 muted 색을 위한 분리).
      const [body, marker] = answer.props.children as [string, unknown];
      expect(body).toBe('두 줄짜리 임테기를 보고 한참을 멍하니 앉아 있었어. 손이 떨려서');
      expect(marker).toBeTruthy();
    });

    it('omits the ellipsis marker when the answer is not truncated', () => {
      const short = { ...baseEntry, answer: '짧은 답변.' };
      const { getByTestId } = render(<OtherEntryCard entry={short} />);
      const answer = getByTestId('other-entry-card-answer');
      const [body, marker] = answer.props.children as [string, unknown];
      expect(body).toBe('짧은 답변.');
      expect(marker).toBeNull();
    });

    it('applies a custom testID to all subtree nodes', () => {
      const { getByTestId } = render(
        <OtherEntryCard entry={baseEntry} testID="custom-card" />,
      );
      expect(getByTestId('custom-card')).toBeTruthy();
      expect(getByTestId('custom-card-alias')).toBeTruthy();
      expect(getByTestId('custom-card-question')).toBeTruthy();
      expect(getByTestId('custom-card-hearts')).toBeTruthy();
    });

    it('invokes onPress when the card is tapped', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <OtherEntryCard entry={baseEntry} onPress={onPress} />,
      );
      fireEvent.press(getByTestId('other-entry-card'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
