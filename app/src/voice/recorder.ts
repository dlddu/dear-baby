// Thin wrapper around expo-audio's recording preset for PRD-001 AC-001-01.
//
// Whisper.cpp accepts 16-bit PCM, but `whisper.rn` also transcodes common
// container formats (m4a / wav) internally, so we pick the preset that
// matches the platform norms (m4a on iOS, 3gp AMR on Android) instead of
// trying to produce raw PCM. This keeps file sizes small.

import {
  RecordingPresets,
  type RecordingOptions,
} from 'expo-audio';

/**
 * The recording options we feed into `useAudioRecorder`. Exported so the
 * screen-level hooks can reuse the same configuration and so that tests
 * can introspect what we're doing.
 */
export const VOICE_DIARY_RECORDING_OPTIONS: RecordingOptions =
  RecordingPresets.HIGH_QUALITY;
