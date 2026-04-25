// Local audio store — the on-device source of truth for "this record's
// audio is here, not on the server yet."
//
// Why two layers (AsyncStorage + FileSystem):
//  - AsyncStorage holds a small JSON index (`record_id` → metadata) so
//    the drafts screen renders in one read without scanning the disk.
//  - FileSystem holds the actual m4a + meta.json under
//    `documentDirectory/audio/{record_id}/`. The directory is the
//    cleanup unit: removing a draft deletes the whole folder, so a
//    botched cleanup never leaves orphan audio behind.
//
// The server `records` row is the long-term authority. A LocalAudio
// entry only ever describes "this record's audio is here" — when an
// upload succeeds, we delete the entry and the folder immediately.

import AsyncStorage from '@react-native-async-storage/async-storage';
// expo-file-system v19 split into a new modular File/Directory API and a
// legacy procedural one. We use the legacy entry because it's a 1:1 fit
// for our index-on-AsyncStorage + folder-per-record layout.
import * as FileSystem from 'expo-file-system/legacy';

import type { LocalAudio, LocalAudioStatus } from './types';

const INDEX_KEY = 'drafts.audio.index.v1';
const AUDIO_BASE = `${FileSystem.documentDirectory}audio/`;

function folderFor(recordID: string): string {
  return `${AUDIO_BASE}${recordID}/`;
}

function metaPath(recordID: string): string {
  return `${folderFor(recordID)}meta.json`;
}

export function audioPathFor(recordID: string): string {
  return `${folderFor(recordID)}audio.m4a`;
}

async function readIndex(): Promise<Record<string, LocalAudio>> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, LocalAudio>;
  } catch {
    // Corrupt index: discard and rebuild on next write. Logging
    // intentionally omitted — the index is rebuildable from disk.
    return {};
  }
}

async function writeIndex(idx: Record<string, LocalAudio>): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(idx));
}

export type CreateInput = {
  record_id: string;
  /** Source path of the recorded m4a (typically a temp file). */
  audio_source_path: string;
  audio_duration_ms: number;
  transcript_preview: string;
};

/**
 * Persists an audio file under `documentDirectory/audio/{record_id}/`,
 * indexes the metadata, and returns the resulting LocalAudio. The
 * source file is moved (not copied) so the caller does not need to
 * separately clean up the temp recording.
 */
export async function create(input: CreateInput): Promise<LocalAudio> {
  await FileSystem.makeDirectoryAsync(folderFor(input.record_id), {
    intermediates: true,
  });
  const dest = audioPathFor(input.record_id);
  await FileSystem.moveAsync({ from: input.audio_source_path, to: dest });

  const entry: LocalAudio = {
    record_id: input.record_id,
    created_at: new Date().toISOString(),
    audio_path: dest,
    audio_duration_ms: input.audio_duration_ms,
    transcript_preview: input.transcript_preview,
    upload_status: 'local',
  };

  await FileSystem.writeAsStringAsync(metaPath(input.record_id), JSON.stringify(entry));

  const idx = await readIndex();
  idx[input.record_id] = entry;
  await writeIndex(idx);
  return entry;
}

export async function list(): Promise<LocalAudio[]> {
  const idx = await readIndex();
  return Object.values(idx).sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  );
}

export async function get(recordID: string): Promise<LocalAudio | null> {
  const idx = await readIndex();
  return idx[recordID] ?? null;
}

/** Removes the audio file *and* the index entry. Used when the user
 * picks "삭제" from the drafts screen, or when an upload succeeds and
 * the audio is no longer needed locally. The server `records` row is
 * never touched here — this only removes the local copy. */
export async function remove(recordID: string): Promise<void> {
  await FileSystem.deleteAsync(folderFor(recordID), { idempotent: true });
  const idx = await readIndex();
  delete idx[recordID];
  await writeIndex(idx);
}

async function patch(
  recordID: string,
  partial: Partial<LocalAudio>,
): Promise<LocalAudio | null> {
  const idx = await readIndex();
  const current = idx[recordID];
  if (!current) return null;
  const next = { ...current, ...partial };
  idx[recordID] = next;
  await writeIndex(idx);
  await FileSystem.writeAsStringAsync(metaPath(recordID), JSON.stringify(next));
  return next;
}

export function markUploading(recordID: string): Promise<LocalAudio | null> {
  return patch(recordID, { upload_status: 'uploading', last_error: undefined });
}

export function markFailed(
  recordID: string,
  reason: string,
): Promise<LocalAudio | null> {
  return patch(recordID, { upload_status: 'failed', last_error: reason });
}

export function setStatus(
  recordID: string,
  status: LocalAudioStatus,
): Promise<LocalAudio | null> {
  return patch(recordID, { upload_status: status });
}
