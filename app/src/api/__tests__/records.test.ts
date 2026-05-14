// records.ts — POST /records 페이로드가 child_kind/child_ordinal 을 항상
// 동봉하도록 잠근다. 백엔드(0009 마이그레이션)가 두 필드를 NOT NULL 로
// 요구하기 때문에 누락은 즉시 400. 단위 테스트는 그 전조 (잘못된 payload
// 송신) 가 절대 일어나지 않도록 한다.

import { apiFetch } from '../client';
import { createTextRecord, createVoiceRecord } from '../records';

jest.mock('../client', () => ({
  apiFetch: jest.fn(),
}));

jest.mock('../../analytics/client', () => ({
  posthogClient: null,
}));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

function okResponse(): Response {
  return new Response(
    JSON.stringify({
      record: {
        id: 'rec-1',
        user_id: 'u1',
        source: 'text',
        content: 'ok',
        question_text: null,
        audio_s3_key: null,
        child_kind: 'fetus',
        child_ordinal: 1,
        created_at: '2026-05-14T00:00:00Z',
      },
      user: {
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
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function bodyOfLastCall(): Record<string, unknown> {
  const init = apiFetchMock.mock.calls[apiFetchMock.mock.calls.length - 1][1];
  if (!init || typeof init.body !== 'string') {
    throw new Error('expected JSON-string body');
  }
  return JSON.parse(init.body);
}

describe('createTextRecord', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('attaches child_kind and child_ordinal to the payload', async () => {
    apiFetchMock.mockResolvedValueOnce(okResponse());
    await createTextRecord('첫 기록', '오늘 어땠어요?', 'fetus', 2);
    const body = bodyOfLastCall();
    expect(body).toMatchObject({
      content: '첫 기록',
      question_text: '오늘 어땠어요?',
      child_kind: 'fetus',
      child_ordinal: 2,
    });
    expect(body).not.toHaveProperty('source');
  });

  it('omits question_text when no question is supplied', async () => {
    apiFetchMock.mockResolvedValueOnce(okResponse());
    await createTextRecord('짧은 기록', undefined, 'child', 1);
    const body = bodyOfLastCall();
    expect(body).toMatchObject({
      content: '짧은 기록',
      child_kind: 'child',
      child_ordinal: 1,
    });
    expect(body).not.toHaveProperty('question_text');
  });

  it('throws when the server rejects (e.g. 400 from child not found)', async () => {
    apiFetchMock.mockResolvedValueOnce(new Response('{}', { status: 400 }));
    await expect(
      createTextRecord('x', undefined, 'fetus', 9),
    ).rejects.toThrow(/createTextRecord failed/);
  });
});

describe('createVoiceRecord', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('sends source=voice plus child_kind/child_ordinal', async () => {
    apiFetchMock.mockResolvedValueOnce(okResponse());
    await createVoiceRecord('음성 transcript', undefined, 'child', 3);
    const body = bodyOfLastCall();
    expect(body).toMatchObject({
      content: '음성 transcript',
      source: 'voice',
      child_kind: 'child',
      child_ordinal: 3,
    });
  });

  it('includes question_text when supplied', async () => {
    apiFetchMock.mockResolvedValueOnce(okResponse());
    await createVoiceRecord('음성', '어떤 노래?', 'fetus', 1);
    const body = bodyOfLastCall();
    expect(body).toMatchObject({
      question_text: '어떤 노래?',
      child_kind: 'fetus',
      child_ordinal: 1,
      source: 'voice',
    });
  });
});
