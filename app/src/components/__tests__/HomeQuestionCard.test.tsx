// PRD-007 AC-007-04·05·06 — 1인칭 질문 카드의 표시·회전·CTA 잠금.
// TC-007-04 (카드 표시), TC-007-05 (회전 인덱스 1/3 → 3/3, 양 끝에서 비활성),
// AC-006 (CTA 가 부모에 콜백을 전달) 을 단위 레벨에서 고정한다.

import { fireEvent, render } from '@testing-library/react-native';

import { HomeQuestionCard } from '../HomeQuestionCard';

const baseProps = {
  displayName: '콩이',
  contextLabel: 'D-36',
  questions: ['질문 1', '질문 2', '질문 3'] as const,
  currentIndex: 0,
  onPrev: jest.fn(),
  onNext: jest.fn(),
  onPressVoice: jest.fn(),
  onPressText: jest.fn(),
};

beforeEach(() => {
  baseProps.onPrev.mockClear();
  baseProps.onNext.mockClear();
  baseProps.onPressVoice.mockClear();
  baseProps.onPressText.mockClear();
});

describe('HomeQuestionCard', () => {
  describe('TC-007-04 — 카드 표시', () => {
    it('renders the active child name, context label, and current question', () => {
      const { getByTestId } = render(<HomeQuestionCard {...baseProps} />);
      expect(getByTestId('home-question-card-name').props.children).toBe('콩이');
      expect(getByTestId('home-question-card-context').props.children).toBe('D-36');
      expect(getByTestId('home-question-card-question').props.children).toBe('질문 1');
    });

    it('hides the context label when null', () => {
      const { queryByTestId } = render(
        <HomeQuestionCard {...baseProps} contextLabel={null} />,
      );
      expect(queryByTestId('home-question-card-context')).toBeNull();
    });

    it('renders both voice and text CTAs', () => {
      const { getByTestId } = render(<HomeQuestionCard {...baseProps} />);
      expect(getByTestId('home-voice-cta')).toBeTruthy();
      expect(getByTestId('home-text-cta')).toBeTruthy();
    });
  });

  describe('TC-007-05 — 회전 한도 3', () => {
    it('shows 1/3 with the left arrow disabled at index 0', () => {
      const { getByTestId } = render(
        <HomeQuestionCard {...baseProps} currentIndex={0} />,
      );
      expect(getByTestId('home-question-card-index').props.children).toBe('1/3');
      const prev = getByTestId('home-question-card-prev');
      expect(prev.props.accessibilityState.disabled).toBe(true);
      fireEvent.press(prev);
      expect(baseProps.onPrev).not.toHaveBeenCalled();
    });

    it('shows 2/3 with both arrows enabled at index 1', () => {
      const { getByTestId } = render(
        <HomeQuestionCard {...baseProps} currentIndex={1} />,
      );
      expect(getByTestId('home-question-card-index').props.children).toBe('2/3');
      expect(getByTestId('home-question-card-prev').props.accessibilityState.disabled).toBe(false);
      expect(getByTestId('home-question-card-next').props.accessibilityState.disabled).toBe(false);
    });

    it('shows 3/3 with the right arrow disabled at the last index', () => {
      const { getByTestId } = render(
        <HomeQuestionCard {...baseProps} currentIndex={2} />,
      );
      expect(getByTestId('home-question-card-index').props.children).toBe('3/3');
      const next = getByTestId('home-question-card-next');
      expect(next.props.accessibilityState.disabled).toBe(true);
      fireEvent.press(next);
      expect(baseProps.onNext).not.toHaveBeenCalled();
    });

    it('forwards taps on the active arrows', () => {
      const { getByTestId, rerender } = render(
        <HomeQuestionCard {...baseProps} currentIndex={1} />,
      );
      fireEvent.press(getByTestId('home-question-card-next'));
      expect(baseProps.onNext).toHaveBeenCalledTimes(1);
      rerender(<HomeQuestionCard {...baseProps} currentIndex={1} />);
      fireEvent.press(getByTestId('home-question-card-prev'));
      expect(baseProps.onPrev).toHaveBeenCalledTimes(1);
    });
  });

  describe('TC-007-06 — CTA 콜백', () => {
    it('invokes onPressVoice when the voice CTA is tapped', () => {
      const { getByTestId } = render(<HomeQuestionCard {...baseProps} />);
      fireEvent.press(getByTestId('home-voice-cta'));
      expect(baseProps.onPressVoice).toHaveBeenCalledTimes(1);
    });

    it('invokes onPressText when the text CTA is tapped', () => {
      const { getByTestId } = render(<HomeQuestionCard {...baseProps} />);
      fireEvent.press(getByTestId('home-text-cta'));
      expect(baseProps.onPressText).toHaveBeenCalledTimes(1);
    });
  });
});
