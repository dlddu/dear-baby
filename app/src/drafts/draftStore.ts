// draftStore is the persistent index of LocalAudio rows. The audio file
// itself lives at `${documentDirectory}audio/{record_id}/audio.<ext>`
// (`.wav` on iOS, `.m4a` on Android — see recorder.ts for why the
// formats differ) and a copy of the metadata (for crash recovery) at
// `${documentDirectory}audio/{record_id}/meta.json`. The index of all
// known record_ids is kept in AsyncStorage so listing the archive is
// O(N) without scanning the filesystem.
//
// Why two layers (AsyncStorage index + per-record meta.json)? If
// AsyncStorage is wiped (rare, but possible on iOS app re-install in
// some situations), meta.json files are still on disk and rebuild() can
// recover the index. If meta.json is gone, the audio is orphaned and
// safe to garbage-collect — that's the known-leak case we accept.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import type { LocalAudio, UploadStatus } from './types';

const INDEX_KEY = 'db_local_audio_index';
const ROOT_DIR = `${FileSystem.documentDirectory ?? ''}audio/`;
// The recorder emits .wav on iOS and .m4a on Android — see recorder.ts.
// We mirror that on disk so the file extension reflects actual content
// (otherwise a debugger pulling the file off the device would see an
// .m4a that won't open in QuickTime).
const AUDIO_EXT = Platform.OS === 'ios' ? 'wav' : 'm4a';

function dirFor(recordID: string): string {
  return `${ROOT_DIR}${recordID}/`;
}

export function audioPathFor(recordID: string): string {
  return `${dirFor(recordID)}audio.${AUDIO_EXT}`;
}

function metaPathFor(recordID: string): string {
  return `${dirFor(recordID)}meta.json`;
}

async function readIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

async function writeIndex(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

async function readMeta(recordID: string): Promise<LocalAudio | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(metaPathFor(recordID));
    return JSON.parse(raw) as LocalAudio;
  } catch {
    return null;
  }
}

async function writeMeta(audio: LocalAudio): Promise<void> {
  await FileSystem.makeDirectoryAsync(dirFor(audio.record_id), {
    intermediates: true,
  });
  await FileSystem.writeAsStringAsync(
    metaPathFor(audio.record_id),
    JSON.stringify(audio),
  );
}

// CreateInput is what the review screen has at the moment "save" is
// tapped: a record_id from POST /records, a temp file path on disk,
// and the transcript that was just persisted server-side.
export type CreateInput = {
  record_id: string;
  created_at: string;
  // tempAudioPath is the recorder's output file. create() moves it
  // into ROOT_DIR so the recorder can clear its tmp area without
  // racing the archive.
  tempAudioPath: string;
  audio_duration_ms: number;
  transcript_preview: string;
};

// create persists a new LocalAudio. Idempotent on record_id — the
// review screen may retry on transient failures and we don't want to
// produce duplicate rows. The audio file is moved (not copied) into
// the archive's per-record dir so the recorder's tmp file disappears.
export async function create(input: CreateInput): Promise<LocalAudio> {
  await FileSystem.makeDirectoryAsync(dirFor(input.record_id), {
    intermediates: true,
  });
  const dest = audioPathFor(input.record_id);
  // If a previous attempt already moved the file, leave it; otherwise
  // pull the recorder's tmp file in.
  const existing = await FileSystem.getInfoAsync(dest);
  if (!existing.exists) {
    await FileSystem.moveAsync({ from: input.tempAudioPath, to: dest });
  }

  const audio: LocalAudio = {
    record_id: input.record_id,
    created_at: input.created_at,
    audio_path: dest,
    audio_duration_ms: input.audio_duration_ms,
    transcript_preview: previewSlice(input.transcript_preview),
    upload_status: 'local',
  };
  await writeMeta(audio);

  const index = await readIndex();
  if (!index.includes(input.record_id)) {
    index.push(input.record_id);
    await writeIndex(index);
  }
  return audio;
}

// previewSlice keeps list rows from showing tens of lines of text. We
// trim aggressively — the full transcript is on the server; the local
// copy only exists to render the row.
function previewSlice(transcript: string): string {
  const trimmed = transcript.trim().replace(/\s+/g, ' ');
  return trimmed.length > 80 ? trimmed.slice(0, 79) + '…' : trimmed;
}

export async function get(recordID: string): Promise<LocalAudio | null> {
  return readMeta(recordID);
}

// list returns drafts ordered by created_at desc — newest first, which
// matches every other list in the app. Missing meta.json (deleted
// out-of-band) is silently filtered, with the index repaired in-place.
export async function list(): Promise<LocalAudio[]> {
  const ids = await readIndex();
  const metas = await Promise.all(ids.map(readMeta));
  const out: LocalAudio[] = [];
  const survivors: string[] = [];
  metas.forEach((meta, i) => {
    if (meta) {
      out.push(meta);
      survivors.push(ids[i]);
    }
  });
  if (survivors.length !== ids.length) {
    await writeIndex(survivors);
  }
  out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return out;
}

export async function setStatus(
  recordID: string,
  status: UploadStatus,
  lastError?: string,
): Promise<LocalAudio | null> {
  const cur = await readMeta(recordID);
  if (!cur) return null;
  const next: LocalAudio = {
    ...cur,
    upload_status: status,
    last_error: status === 'failed' ? lastError : undefined,
  };
  await writeMeta(next);
  return next;
}

// remove deletes both the audio file and the metadata. The server's
// records row is untouched — this is the "user keeps the entry but
// throws away the audio" path.
export async function remove(recordID: string): Promise<void> {
  await FileSystem.deleteAsync(dirFor(recordID), { idempotent: true });
  const ids = await readIndex();
  const next = ids.filter((id) => id !== recordID);
  if (next.length !== ids.length) {
    await writeIndex(next);
  }
}

// count is the cheap path the home banner uses — it doesn't need the
// full list, just whether to show the entry point.
export async function count(): Promise<number> {
  const ids = await readIndex();
  return ids.length;
}
