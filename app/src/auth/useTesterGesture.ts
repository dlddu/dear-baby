// useTesterGesture exposes a hidden two-stage tap sequence that QA can use
// to surface the tester login modal without a visible button. The
// sequence is: tap the top-left corner 5–7 times, then tap the
// top-right corner 10 times. Either side resets if the user pauses for
// too long, and the right-side counter is gated on the left-side count
// landing inside the [5, 7] window so accidental tapping does not
// trigger the modal.
//
// State is held in refs rather than React state so that rapid taps don't
// race against the React render cycle — every tap reads and updates the
// authoritative counter synchronously, and the callback identity stays
// stable for the lifetime of the hook.

import { useCallback, useEffect, useRef } from 'react';

export type TesterGestureState = {
  tapLeft: () => void;
  tapRight: () => void;
};

type Options = {
  // Called when the full sequence completes. The hook resets internal
  // state immediately so a second sequence can start fresh.
  onTrigger: () => void;
  leftMin?: number;
  leftMax?: number;
  rightTarget?: number;
  // resetMs is how long the hook waits between taps before forgetting
  // the in-progress sequence. Long enough to let a careful user finish,
  // short enough that a phantom tap won't carry over for minutes.
  resetMs?: number;
};

type Phase = 'left' | 'right';

export function useTesterGesture({
  onTrigger,
  leftMin = 5,
  leftMax = 7,
  rightTarget = 10,
  resetMs = 4000,
}: Options): TesterGestureState {
  const leftCountRef = useRef(0);
  const rightCountRef = useRef(0);
  const phaseRef = useRef<Phase>('left');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pin the latest onTrigger in a ref so the callbacks can stay
  // referentially stable while still calling the freshest handler.
  const onTriggerRef = useRef(onTrigger);
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const reset = useCallback(() => {
    leftCountRef.current = 0;
    rightCountRef.current = 0;
    phaseRef.current = 'left';
    clearTimer();
  }, []);

  const scheduleReset = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(reset, resetMs);
  }, [reset, resetMs]);

  useEffect(() => {
    return clearTimer;
  }, []);

  const tapLeft = useCallback(() => {
    if (phaseRef.current === 'right') {
      // A left tap during the right phase means the user broke the
      // pattern — discard everything so a fresh sequence has to start
      // from zero on the left side.
      reset();
      return;
    }
    leftCountRef.current += 1;
    if (leftCountRef.current > leftMax) {
      // Going past the upper bound disqualifies the sequence — reset to
      // zero so the user can try again. We do not preserve overflow taps
      // because counting "tapped 9 times, treat as 2" would let an
      // attacker brute-force the gesture by mashing the corner.
      leftCountRef.current = 0;
    }
    scheduleReset();
  }, [leftMax, reset, scheduleReset]);

  const tapRight = useCallback(() => {
    if (phaseRef.current === 'left') {
      // Transition only if left landed inside the acceptance window.
      if (
        leftCountRef.current < leftMin ||
        leftCountRef.current > leftMax
      ) {
        reset();
        return;
      }
      phaseRef.current = 'right';
    }
    rightCountRef.current += 1;
    if (rightCountRef.current >= rightTarget) {
      // Reset before firing so onTrigger sees a clean state when it
      // re-renders, and so a re-entrant tap during the trigger callback
      // doesn't double-fire.
      reset();
      onTriggerRef.current();
      return;
    }
    scheduleReset();
  }, [leftMax, leftMin, reset, rightTarget, scheduleReset]);

  return { tapLeft, tapRight };
}
