// Local persistence for Records.
//
// PRD-001's acceptance criteria only require that entries be retrievable in
// the list view (AC-001-05). Until a server-side store exists we keep the
// records in AsyncStorage so they survive restart without depending on the
// network. Callers should not assume these helpers do validation — upstream
// code is responsible for producing valid `Record` objects.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Record } from './types';

const STORAGE_KEY = 'db_records_v1';

async function readAll(): Promise<Record[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Record[]) : [];
  } catch {
    // Corrupt payload — drop it rather than crash the app.
    return [];
  }
}

async function writeAll(records: Record[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Returns every record, newest first. */
export async function listRecords(): Promise<Record[]> {
  const all = await readAll();
  return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Returns a single record by id, or `null` if it does not exist. */
export async function getRecord(id: string): Promise<Record | null> {
  const all = await readAll();
  return all.find((r) => r.id === id) ?? null;
}

/** Inserts a record at the head of the list. */
export async function saveRecord(record: Record): Promise<void> {
  const all = await readAll();
  all.unshift(record);
  await writeAll(all);
}

/** Replaces an existing record (matched by id). No-op if not found. */
export async function updateRecord(record: Record): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((r) => r.id === record.id);
  if (idx === -1) return;
  all[idx] = record;
  await writeAll(all);
}

/** Deletes a record by id. No-op if not found. */
export async function deleteRecord(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((r) => r.id !== id));
}
