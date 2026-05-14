// recordChild — 기록 화면이 라우팅 params 로 받은 (kind, ordinal) 을 해석하고
// AuthContext.user 에서 displayName 을 찾아 돌려주는 헬퍼. 본 모듈은 iOS
// 스와이프 백 함정 회피를 위한 단일 진입점이라, 잘못된 / 누락된 params 처리와
// 다자녀 매칭 동작을 단단히 잠가둔다.

import {
  parseChildKindParam,
  parseChildOrdinalParam,
  resolveRecordChildDisplayName,
} from '../recordChild';
import type { User } from '../../api/types';

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'u1',
    email: 'a@b.com',
    name: '',
    picture_url: '',
    due_date: null,
    onboarded_at: null,
    voice_coachmark_dismissed_at: null,
    first_record_at: null,
    ai_preview: null,
    fetuses: [],
    children: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('parseChildKindParam', () => {
  it('passes through known kinds', () => {
    expect(parseChildKindParam('fetus')).toBe('fetus');
    expect(parseChildKindParam('child')).toBe('child');
  });

  it('rejects unknown values, arrays, and undefined', () => {
    expect(parseChildKindParam('sibling')).toBeNull();
    expect(parseChildKindParam('')).toBeNull();
    expect(parseChildKindParam(undefined)).toBeNull();
    expect(parseChildKindParam(['fetus'])).toBeNull();
  });
});

describe('parseChildOrdinalParam', () => {
  it('parses positive integers', () => {
    expect(parseChildOrdinalParam('1')).toBe(1);
    expect(parseChildOrdinalParam('42')).toBe(42);
  });

  it('rejects zero, negatives, decimals, and non-numeric input', () => {
    expect(parseChildOrdinalParam('0')).toBeNull();
    expect(parseChildOrdinalParam('-3')).toBeNull();
    expect(parseChildOrdinalParam('nope')).toBeNull();
    expect(parseChildOrdinalParam('')).toBeNull();
    expect(parseChildOrdinalParam(undefined)).toBeNull();
    expect(parseChildOrdinalParam(['1'])).toBeNull();
  });
});

describe('resolveRecordChildDisplayName', () => {
  it('returns null when user, kind, or ordinal is missing', () => {
    expect(resolveRecordChildDisplayName(null, 'fetus', 1)).toBeNull();
    const user = makeUser({});
    expect(resolveRecordChildDisplayName(user, null, 1)).toBeNull();
    expect(resolveRecordChildDisplayName(user, 'fetus', null)).toBeNull();
  });

  it('looks up the fetus nickname when kind=fetus matches ordinal', () => {
    const user = makeUser({
      fetuses: [
        {
          ordinal: 1,
          nickname: '봄이',
          gender: null,
          pregnancy_week: null,
          due_date: '2025-09-15',
          purposes: [],
        },
        {
          ordinal: 2,
          nickname: '여름이',
          gender: null,
          pregnancy_week: null,
          due_date: '2025-09-15',
          purposes: [],
        },
      ],
    });
    expect(resolveRecordChildDisplayName(user, 'fetus', 2)).toBe('여름이');
  });

  it('looks up the child name when kind=child matches ordinal', () => {
    const user = makeUser({
      children: [
        {
          ordinal: 1,
          name: '하늘',
          gender: null,
          birth_date: '2023-01-01',
          bio: null,
          purposes: [],
        },
      ],
    });
    expect(resolveRecordChildDisplayName(user, 'child', 1)).toBe('하늘');
  });

  it('does not cross over between fetus and child tables (same ordinal)', () => {
    // user has BOTH a fetus and a child with ordinal=1.
    // resolving with kind=fetus must return the fetus nickname, not the child.
    const user = makeUser({
      fetuses: [
        {
          ordinal: 1,
          nickname: '태아',
          gender: null,
          pregnancy_week: null,
          due_date: '2025-09-15',
          purposes: [],
        },
      ],
      children: [
        {
          ordinal: 1,
          name: '양육 아이',
          gender: null,
          birth_date: '2022-01-01',
          bio: null,
          purposes: [],
        },
      ],
    });
    expect(resolveRecordChildDisplayName(user, 'fetus', 1)).toBe('태아');
    expect(resolveRecordChildDisplayName(user, 'child', 1)).toBe('양육 아이');
  });

  it('falls back to 우리 아이 when the row exists but the name is empty', () => {
    const user = makeUser({
      fetuses: [
        {
          ordinal: 1,
          nickname: '',
          gender: null,
          pregnancy_week: null,
          due_date: null,
          purposes: [],
        },
      ],
    });
    expect(resolveRecordChildDisplayName(user, 'fetus', 1)).toBe('우리 아이');
  });

  it('falls back to 우리 아이 when no row matches the ordinal', () => {
    const user = makeUser({
      fetuses: [
        {
          ordinal: 1,
          nickname: '봄이',
          gender: null,
          pregnancy_week: null,
          due_date: null,
          purposes: [],
        },
      ],
    });
    // 9 doesn't exist; we still render something rather than blanking the banner.
    expect(resolveRecordChildDisplayName(user, 'fetus', 9)).toBe('우리 아이');
  });
});
