// PRD-009 AC-009-14 — 홈 커뮤니티 피드 카드의 필드 노출·탭 라우팅 잠금.
// (구 PRD-007 AC-007-08 에서 이관.) TC-009-14-A 의 카드 부분을 단위 레벨에서
// 고정한다. 공감 수(♥)는 AC-009-08 슬라이스까지 카드에 없으므로 검증 대상이
// 아니며, "없어야 한다" 를 명시적으로 잠근다.

import { fireEvent, render } from '@testing-library/react-native';

import type { CommunityFeedItem } from '../../api/community';
import { OtherEntryCard } from '../OtherEntryCard';

const baseEntry: CommunityFeedItem = {
  id: 'rec-1',
  authorName: 'cho***3',
  childStatusText: '임신 3주차',
  subjectKind: 'fetus',
  source: 'text',
  questionText: '엄마, 오늘 저를 처음 알게 된 기분은 어땠어요?',
  preview: '두 줄짜리 임테기를 보고 한참을 멍하니 앉아 있었어. 손이 떨려서…',
  createdAt: '2026-08-07T09:30:00Z',
};

describe('OtherEntryCard', () => {
  describe('AC-009-14 — 카드 필드 노출', () => {
    it('renders the masked display name, child status, and question', () => {
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
    });

    it('renders the preview body and the ellipsis marker', () => {
      const { getByTestId } = render(<OtherEntryCard entry={baseEntry} />);
      const answer = getByTestId('other-entry-card-answer');
      // body + 마커가 별도 children 으로 들어간다 (마커는 muted 색을 위한 분리).
      const [body, marker] = answer.props.children as [string, unknown];
      expect(body).toBe('두 줄짜리 임테기를 보고 한참을 멍하니 앉아 있었어. 손이 떨려서');
      expect(marker).toBeTruthy();
    });

    it('omits the ellipsis marker when the preview was not truncated', () => {
      const short = { ...baseEntry, preview: '짧은 답변.' };
      const { getByTestId } = render(<OtherEntryCard entry={short} />);
      const answer = getByTestId('other-entry-card-answer');
      const [body, marker] = answer.props.children as [string, unknown];
      expect(body).toBe('짧은 답변.');
      expect(marker).toBeNull();
    });

    it('omits the child status line when the server could not derive it', () => {
      const { queryByTestId } = render(
        <OtherEntryCard entry={{ ...baseEntry, childStatusText: '' }} />,
      );
      expect(queryByTestId('other-entry-card-context')).toBeNull();
    });

    it('omits the question line for a free diary entry (question_text=null)', () => {
      const { queryByTestId, getByTestId } = render(
        <OtherEntryCard entry={{ ...baseEntry, questionText: null }} />,
      );
      expect(queryByTestId('other-entry-card-question')).toBeNull();
      // 미리보기는 여전히 보인다 — 자유 일기도 본문은 노출된다.
      expect(getByTestId('other-entry-card-answer')).toBeTruthy();
    });

    it('does not render a 공감 수 yet (AC-009-08 슬라이스 대기)', () => {
      const { queryByTestId } = render(<OtherEntryCard entry={baseEntry} />);
      expect(queryByTestId('other-entry-card-hearts')).toBeNull();
    });

    it('applies a custom testID to all subtree nodes', () => {
      const { getByTestId } = render(
        <OtherEntryCard entry={baseEntry} testID="custom-card" />,
      );
      expect(getByTestId('custom-card')).toBeTruthy();
      expect(getByTestId('custom-card-alias')).toBeTruthy();
      expect(getByTestId('custom-card-question')).toBeTruthy();
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
