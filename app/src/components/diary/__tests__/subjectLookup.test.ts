import type { Record, User } from '../../../api/types';
import {
  describeSubject,
  formatCardDate,
  formatDetailDate,
  groupRecordsByMonth,
} from '../subjectLookup';

const baseUser: User = {
  id: 'u1',
  email: 'a@b.com',
  name: '엄마',
  picture_url: '',
  onboarded_at: '2026-01-01T00:00:00Z',
  first_record_at: null,
  fetuses: [],
  children: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const fetus = {
  subject_id: 'subj-fetus-1',
  ordinal: 0,
  nickname: '콩이',
  gender: null,
  pregnancy_week: null,
  due_date: '2026-08-15',
  purposes: [],
};
const child = {
  subject_id: 'subj-child-1',
  ordinal: 0,
  name: '하준',
  gender: null,
  birth_date: '2025-11-12',
  bio: null,
  purposes: [],
};

const newRec = (overrides: Partial<Record> = {}): Record => ({
  id: 'r',
  user_id: 'u1',
  subject_id: 'subj-fetus-1',
  source: 'text',
  content: 'hi',
  question_text: null,
  audio_s3_key: null,
  visibility: 'private',
  created_at: '2026-05-15T09:30:00Z',
  ...overrides,
});

describe('describeSubject', () => {
  it('returns a fetus chip with 임신 주차 prefix when within weeks mode', () => {
    const user: User = { ...baseUser, fetuses: [fetus] };
    const subj = describeSubject(user, fetus.subject_id, '2026-04-15T00:00:00Z');
    expect(subj.emoji).toBe('🌱');
    expect(subj.name).toBe('콩이');
    // 4월 15일 → 예정일까지 122일 → 22주차쯤. 주차 모드 ("주차" 으로 끝나는
    // 라벨) 이면 "임신 …" 접두사가 붙는다.
    expect(subj.contextLabel?.startsWith('임신 ')).toBe(true);
    expect(subj.contextLabel?.endsWith('주차')).toBe(true);
  });

  it('returns a child chip with age label', () => {
    const user: User = { ...baseUser, children: [child] };
    const subj = describeSubject(user, child.subject_id, '2026-05-15T00:00:00Z');
    expect(subj.emoji).toBe('👶');
    expect(subj.name).toBe('하준');
    expect(subj.contextLabel).not.toBeNull();
  });

  it('falls back when no matching subject is found', () => {
    const user: User = { ...baseUser, fetuses: [fetus] };
    const subj = describeSubject(user, 'nonexistent-subject');
    expect(subj).toEqual({ emoji: '🌱', name: '우리 아이', contextLabel: null });
  });

  it('returns fallback when user is null', () => {
    expect(describeSubject(null, 'anything')).toEqual({
      emoji: '🌱',
      name: '우리 아이',
      contextLabel: null,
    });
  });
});

describe('groupRecordsByMonth', () => {
  it('groups records into newest-month-first buckets', () => {
    const groups = groupRecordsByMonth([
      newRec({ id: 'r1', created_at: '2026-05-15T09:30:00Z' }),
      newRec({ id: 'r2', created_at: '2026-05-10T08:15:00Z' }),
      newRec({ id: 'r3', created_at: '2026-04-20T22:10:00Z' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].title).toContain('5월');
    expect(groups[0].data.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(groups[1].title).toContain('4월');
    expect(groups[1].data.map((r) => r.id)).toEqual(['r3']);
  });

  it('returns empty array for empty input', () => {
    expect(groupRecordsByMonth([])).toEqual([]);
  });
});

describe('date formatters', () => {
  it('formatCardDate produces MM/DD (요일)', () => {
    // 2026-05-15 is a Friday.
    expect(formatCardDate('2026-05-15T09:30:00Z')).toMatch(/^\d{2}\/\d{2} \([일월화수목금토]\)$/);
  });

  it('formatDetailDate produces 한국어 long form', () => {
    expect(formatDetailDate('2026-05-15T09:30:00Z')).toMatch(/^\d{4}년 \d{1,2}월 \d{1,2}일 \([일월화수목금토]\)$/);
  });
});
