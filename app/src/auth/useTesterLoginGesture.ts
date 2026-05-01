import { useCallback, useRef } from 'react';

// Secret tap pattern that unlocks the tester login modal. Validated
// strictly because the same code runs in production:
//   1. Tap the top-left corner between MIN_LEFT and MAX_LEFT times
//      (inclusive). Going below MIN_LEFT before crossing to the right
//      corner does nothing; going above MAX_LEFT resets.
//   2. Then tap the top-right corner at least MIN_RIGHT times.
//   3. The N-th right tap (where N == MIN_RIGHT) fires onUnlock.
// Tapping the wrong corner at any phase, or letting the inter-tap gap
// exceed RESET_AFTER_MS, resets state. This prevents an end user from
// stumbling into the tester flow by random taps and prevents stale
// progress (e.g., a user tapping the corner once an hour ago) from
// counting toward a later sequence.
export const TESTER_LOGIN_GESTURE = {
  MIN_LEFT: 5,
  MAX_LEFT: 7,
  MIN_RIGHT: 10,
  RESET_AFTER_MS: 5000,
} as const;

type Phase = 'idle' | 'left' | 'right';

type State = {
  phase: Phase;
  leftCount: number;
  rightCount: number;
  lastTapAt: number;
};

function freshState(): State {
  return { phase: 'idle', leftCount: 0, rightCount: 0, lastTapAt: 0 };
}

export type TesterLoginGesture = {
  onLeftPress: () => void;
  onRightPress: () => void;
};

// useTesterLoginGesture wires Pressable handlers for the two corner hot
// zones. The state lives in a ref so a stuck reset timer or a re-render
// cannot race the count.
export function useTesterLoginGesture(onUnlock: () => void): TesterLoginGesture {
  const stateRef = useRef<State>(freshState());

  const reset = useCallback(() => {
    stateRef.current = freshState();
  }, []);

  const expireIfStale = useCallback((now: number) => {
    const s = stateRef.current;
    if (s.phase !== 'idle' && now - s.lastTapAt > TESTER_LOGIN_GESTURE.RESET_AFTER_MS) {
      reset();
    }
  }, [reset]);

  const onLeftPress = useCallback(() => {
    const now = Date.now();
    expireIfStale(now);
    const s = stateRef.current;
    // Right-corner taps lead the sequence — a left tap during the
    // right phase aborts the attempt rather than silently accumulating.
    if (s.phase === 'right') {
      reset();
      return;
    }
    const next = s.leftCount + 1;
    if (next > TESTER_LOGIN_GESTURE.MAX_LEFT) {
      // Overshooting the upper bound is a deliberate reset — without
      // it, a user could tap left arbitrarily many times and still
      // succeed by going to the right corner.
      reset();
      return;
    }
    stateRef.current = {
      phase: 'left',
      leftCount: next,
      rightCount: 0,
      lastTapAt: now,
    };
  }, [expireIfStale, reset]);

  const onRightPress = useCallback(() => {
    const now = Date.now();
    expireIfStale(now);
    const s = stateRef.current;
    if (s.phase === 'right') {
      const next = s.rightCount + 1;
      stateRef.current = { ...s, rightCount: next, lastTapAt: now };
      if (next >= TESTER_LOGIN_GESTURE.MIN_RIGHT) {
        reset();
        onUnlock();
      }
      return;
    }
    if (
      s.phase === 'left' &&
      s.leftCount >= TESTER_LOGIN_GESTURE.MIN_LEFT &&
      s.leftCount <= TESTER_LOGIN_GESTURE.MAX_LEFT
    ) {
      stateRef.current = {
        phase: 'right',
        leftCount: s.leftCount,
        rightCount: 1,
        lastTapAt: now,
      };
      return;
    }
    // Right tap at the wrong time — undercount on the left, no left
    // taps at all, etc.
    reset();
  }, [expireIfStale, onUnlock, reset]);

  return { onLeftPress, onRightPress };
}
