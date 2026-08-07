// 기록 저장 시점 공개/비공개 선택 unit test — PRD-001 AC-001-06 / TC-001-06.
//
// e2e (Maestro) 는 저장 화면에서 토글이 보이고 기본값이 비공개이며 공개로
// 전환된다는 것까지 단정한다(record-visibility-select.yaml). 저장된 값이
// 실제로 서버 payload 에 실리는지는 신규 기록의 record id 를 flow 가 알 수
// 없어(diary-list-card-<id> 로 특정 불가) e2e 밖 잔여이므로, 그 부분을 본
// jest 가 책임진다 — create{Text,Voice}Record 호출 인자를 직접 잠근다.
//
// mock 패턴은 (onboarding)/a2.test.tsx 와 동일(safe-area-context + expo-router
// + context) 하고, 음성 화면은 STT·드래프트·업로드 의존성까지 스텁한다.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = ({ children, ...rest }: any) =>
    React.createElement(View, rest, children);
  return {
    SafeAreaProvider: passthrough,
    SafeAreaView: passthrough,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => ({
    audio_path: '/tmp/e2e.m4a',
    audio_duration_ms: '1200',
  }),
}));

const mockCreateTextRecord = jest.fn();
const mockCreateVoiceRecord = jest.fn();
jest.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => ({
    createTextRecord: mockCreateTextRecord,
    createVoiceRecord: mockCreateVoiceRecord,
  }),
}));

jest.mock('../../src/context/ActiveChildContext', () => ({
  useActiveChild: () => ({ activeChild: { subjectId: 'subj-1' } }),
}));

// 음성 리뷰 화면 전용 의존성 — STT 는 즉시 성공, 드래프트/업로드는 무동작.
jest.mock('../../src/voice/whisperEngine', () => ({
  transcribe: jest.fn(async () => '오늘은 태동이 느껴졌어'),
}));
jest.mock('../../src/voice/uploadAudio', () => ({
  uploadAudio: jest.fn(async () => ({ status: 'uploaded' })),
}));
jest.mock('../../src/drafts/draftStore', () => ({
  create: jest.fn(async () => undefined),
}));
jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn(async () => undefined),
}));

import RecordAudioReviewScreen from '../record-audio-review';
import RecordTextScreen from '../record-text';

beforeEach(() => {
  mockCreateTextRecord.mockReset();
  mockCreateTextRecord.mockResolvedValue({ record: { id: 'r1' }, user: {} });
  mockCreateVoiceRecord.mockReset();
  mockCreateVoiceRecord.mockResolvedValue({ id: 'r1', created_at: '2026-08-07T00:00:00Z' });
});

describe('RecordTextScreen — 작성 시점 공개/비공개 (AC-001-06)', () => {
  it('저장 화면에 공개/비공개 토글이 표시되고 기본값은 비공개다', () => {
    const { getByTestId } = render(<RecordTextScreen />);

    // 컨테이너 testID 접미사가 현재 선택 상태다 — 두 칩은 항상 렌더되므로
    // 칩 존재만으로는 "무엇이 선택됐는지" 를 단정할 수 없다.
    expect(getByTestId('record-text-visibility-private')).toBeTruthy();
    expect(getByTestId('record-text-visibility-option-private')).toBeTruthy();
    expect(getByTestId('record-text-visibility-option-public')).toBeTruthy();
  });

  it('토글을 건드리지 않고 저장하면 visibility=private 로 전송된다', async () => {
    const { getByTestId } = render(<RecordTextScreen />);

    fireEvent.changeText(getByTestId('record-text-input'), '오늘의 기록');
    await act(async () => {
      fireEvent.press(getByTestId('record-text-save'));
    });

    await waitFor(() => expect(mockCreateTextRecord).toHaveBeenCalledTimes(1));
    expect(mockCreateTextRecord.mock.calls[0][1]).toMatchObject({
      subjectId: 'subj-1',
      visibility: 'private',
    });
  });

  it('공개를 선택하면 상태가 바뀌고 visibility=public 으로 전송된다', async () => {
    const { getByTestId, queryByTestId } = render(<RecordTextScreen />);

    fireEvent.press(getByTestId('record-text-visibility-option-public'));

    expect(getByTestId('record-text-visibility-public')).toBeTruthy();
    expect(queryByTestId('record-text-visibility-private')).toBeNull();

    fireEvent.changeText(getByTestId('record-text-input'), '오늘의 기록');
    await act(async () => {
      fireEvent.press(getByTestId('record-text-save'));
    });

    await waitFor(() => expect(mockCreateTextRecord).toHaveBeenCalledTimes(1));
    expect(mockCreateTextRecord.mock.calls[0][1]).toMatchObject({
      visibility: 'public',
    });
  });
});

describe('RecordAudioReviewScreen — 작성 시점 공개/비공개 (AC-001-06)', () => {
  it('음성 저장 화면도 같은 토글을 갖고 기본값은 비공개다', async () => {
    const { getByTestId } = render(<RecordAudioReviewScreen />);

    await waitFor(() => expect(getByTestId('record-audio-review-input')).toBeTruthy());
    expect(getByTestId('record-audio-review-visibility-private')).toBeTruthy();
  });

  it('공개 선택 후 [저장] 하면 visibility=public 으로 전송된다', async () => {
    const { getByTestId } = render(<RecordAudioReviewScreen />);

    await waitFor(() => expect(getByTestId('record-audio-review-input')).toBeTruthy());
    fireEvent.press(getByTestId('record-audio-review-visibility-option-public'));
    await act(async () => {
      fireEvent.press(getByTestId('record-audio-review-save'));
    });

    await waitFor(() => expect(mockCreateVoiceRecord).toHaveBeenCalledTimes(1));
    expect(mockCreateVoiceRecord.mock.calls[0][1]).toMatchObject({
      visibility: 'public',
    });
  });

  it('[저장 후 음성 원본 업로드] 경로도 선택값을 그대로 전달한다', async () => {
    const { getByTestId } = render(<RecordAudioReviewScreen />);

    await waitFor(() => expect(getByTestId('record-audio-review-input')).toBeTruthy());
    fireEvent.press(getByTestId('record-audio-review-visibility-option-public'));
    await act(async () => {
      fireEvent.press(getByTestId('record-audio-review-save-and-upload'));
    });

    await waitFor(() => expect(mockCreateVoiceRecord).toHaveBeenCalledTimes(1));
    expect(mockCreateVoiceRecord.mock.calls[0][1]).toMatchObject({
      visibility: 'public',
    });
  });
});
