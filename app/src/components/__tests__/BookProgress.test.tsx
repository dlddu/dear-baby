// PRD-007 AC-007-07 — 책 진행도 컴포넌트의 두 상태 분기.
// TC-007-07-A: `n < 50` — 진행 텍스트 + (?) 안내 버튼 + n/50 + 진행 바
// TC-007-07-B: `n = 50` (또는 그 이상) — "책 만들기" CTA 전환
// 추가: (?) 탭 시 onPressHelp 콜백 호출, CTA 탭 시 onPressCta 호출

import { fireEvent, render } from '@testing-library/react-native';

import { BookProgress } from '../BookProgress';

const baseProps = {
  onPressHelp: jest.fn(),
  onPressCta: jest.fn(),
};

beforeEach(() => {
  baseProps.onPressHelp.mockClear();
  baseProps.onPressCta.mockClear();
});

describe('BookProgress', () => {
  describe('TC-007-07-A — n < 50', () => {
    it('renders progress copy, fraction, and bar at n=12', () => {
      const { getByTestId, queryByTestId } = render(
        <BookProgress {...baseProps} count={12} />,
      );
      expect(getByTestId('book-progress-progress-wrap')).toBeTruthy();
      expect(getByTestId('book-progress-copy')).toBeTruthy();
      expect(getByTestId('book-progress-fraction').props.children).toBe('12/50');
      expect(getByTestId('book-progress-fill')).toBeTruthy();
      // CTA 영역은 아예 마운트되지 않아야 한다 (전환 아니라 분기).
      expect(queryByTestId('book-progress-cta-wrap')).toBeNull();
      expect(queryByTestId('book-progress-cta')).toBeNull();
    });

    it('renders 49/50 at n=49 (still below threshold)', () => {
      const { getByTestId, queryByTestId } = render(
        <BookProgress {...baseProps} count={49} />,
      );
      expect(getByTestId('book-progress-fraction').props.children).toBe('49/50');
      expect(queryByTestId('book-progress-cta')).toBeNull();
    });

    it('invokes onPressHelp when the (?) is tapped', () => {
      const { getByTestId } = render(
        <BookProgress {...baseProps} count={12} />,
      );
      fireEvent.press(getByTestId('book-progress-help'));
      expect(baseProps.onPressHelp).toHaveBeenCalledTimes(1);
    });

    it('clamps negative count to 0', () => {
      const { getByTestId } = render(
        <BookProgress {...baseProps} count={-5} />,
      );
      expect(getByTestId('book-progress-fraction').props.children).toBe('0/50');
    });
  });

  describe('TC-007-07-B — n >= 50 (CTA 전환)', () => {
    it('renders the "책 만들기" CTA at n=50', () => {
      const { getByTestId, queryByTestId } = render(
        <BookProgress {...baseProps} count={50} />,
      );
      expect(getByTestId('book-progress-cta-wrap')).toBeTruthy();
      expect(getByTestId('book-progress-cta')).toBeTruthy();
      // 진행 영역은 마운트되지 않아야 한다.
      expect(queryByTestId('book-progress-progress-wrap')).toBeNull();
      expect(queryByTestId('book-progress-fraction')).toBeNull();
    });

    it('renders the CTA at n=51 (cap above threshold)', () => {
      const { getByTestId, queryByTestId } = render(
        <BookProgress {...baseProps} count={51} />,
      );
      expect(getByTestId('book-progress-cta')).toBeTruthy();
      expect(queryByTestId('book-progress-progress-wrap')).toBeNull();
    });

    it('invokes onPressCta when the CTA is tapped', () => {
      const { getByTestId } = render(
        <BookProgress {...baseProps} count={50} />,
      );
      fireEvent.press(getByTestId('book-progress-cta'));
      expect(baseProps.onPressCta).toHaveBeenCalledTimes(1);
    });
  });

  describe('threshold override', () => {
    it('switches to CTA when count >= custom threshold', () => {
      const { getByTestId, queryByTestId, rerender } = render(
        <BookProgress {...baseProps} count={9} threshold={10} />,
      );
      expect(getByTestId('book-progress-fraction').props.children).toBe('9/10');
      rerender(<BookProgress {...baseProps} count={10} threshold={10} />);
      expect(getByTestId('book-progress-cta')).toBeTruthy();
      expect(queryByTestId('book-progress-fraction')).toBeNull();
    });
  });
});
