// recordChild — 기록 작성 화면이 라우팅 params 로 받은
// (child_kind, child_ordinal) 을 안전하게 파싱하고, AuthContext.user 의
// fetuses/children 에서 displayName 을 조회한다.
//
// CLAUDE.md: 기록 화면은 useActiveChild 를 직접 구독하지 않고 params 만
// 으로 동작해야 한다 (iOS 스와이프 백 함정 회피). 이 모듈은 그 약속을
// 강제하는 단일 진입점이다.

import type { ChildKind } from '../api/records';
import type { User } from '../api/types';

const FALLBACK_DISPLAY_NAME = '우리 아이';

/** child_kind route param 을 ChildKind | null 로 파싱. 알 수 없는 값은 null. */
export function parseChildKindParam(
  raw: string | string[] | undefined,
): ChildKind | null {
  const value = typeof raw === 'string' ? raw : null;
  if (value === 'fetus' || value === 'child') return value;
  return null;
}

/** child_ordinal route param 을 1 이상의 정수로 파싱. 실패시 null. */
export function parseChildOrdinalParam(
  raw: string | string[] | undefined,
): number | null {
  const value = typeof raw === 'string' ? raw : null;
  if (value === null) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/**
 * (kind, ordinal) 에 해당하는 아이의 표시 이름을 user 의 fetuses/children
 * 에서 찾아 반환한다. 찾지 못한 경우 (예: stale 라우팅, race) 에는
 * `우리 아이` 폴백 — 화면 자체가 자식 정보 없이 렌더링되지는 않도록.
 * `user`/`kind`/`ordinal` 중 하나라도 비어 있으면 null 을 반환해 호출 측이
 * 배너를 숨길 수 있게 한다.
 */
export function resolveRecordChildDisplayName(
  user: User | null,
  kind: ChildKind | null,
  ordinal: number | null,
): string | null {
  if (!user || kind === null || ordinal === null) return null;
  if (kind === 'fetus') {
    const match = (user.fetuses ?? []).find((f) => f.ordinal === ordinal);
    if (match) {
      const trimmed = match.nickname?.trim() ?? '';
      return trimmed.length > 0 ? trimmed : FALLBACK_DISPLAY_NAME;
    }
  } else {
    const match = (user.children ?? []).find((c) => c.ordinal === ordinal);
    if (match) {
      const trimmed = match.name?.trim() ?? '';
      return trimmed.length > 0 ? trimmed : FALLBACK_DISPLAY_NAME;
    }
  }
  return FALLBACK_DISPLAY_NAME;
}
