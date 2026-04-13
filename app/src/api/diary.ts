import { apiFetch } from './client';
import { API_URL } from '../config/env';
import { getAccessToken } from '../auth/tokens';
import type { DiaryEntry } from './types';

export async function createEntry(data: {
  title: string;
  content: string;
  entry_type: 'voice' | 'text';
  week?: number;
  duration?: number;
}): Promise<DiaryEntry> {
  const res = await apiFetch('/diary', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create entry failed: ${res.status}`);
  return (await res.json()) as DiaryEntry;
}

export async function listEntries(week?: number): Promise<DiaryEntry[]> {
  const q = week != null ? `?week=${week}` : '';
  const res = await apiFetch(`/diary${q}`);
  if (!res.ok) throw new Error(`list entries failed: ${res.status}`);
  return (await res.json()) as DiaryEntry[];
}

export async function getEntry(id: string): Promise<DiaryEntry> {
  const res = await apiFetch(`/diary/${id}`);
  if (!res.ok) throw new Error(`get entry failed: ${res.status}`);
  return (await res.json()) as DiaryEntry;
}

export async function updateEntry(
  id: string,
  data: { title: string; content: string },
): Promise<DiaryEntry> {
  const res = await apiFetch(`/diary/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update entry failed: ${res.status}`);
  return (await res.json()) as DiaryEntry;
}

export async function deleteEntry(id: string): Promise<void> {
  const res = await apiFetch(`/diary/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete entry failed: ${res.status}`);
}

export async function transcribeAudio(audioUri: string): Promise<string> {
  const access = await getAccessToken();
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  } as unknown as Blob);

  const res = await fetch(`${API_URL}/diary/transcribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access}`,
    },
    body: formData,
  });
  if (!res.ok) throw new Error(`transcribe failed: ${res.status}`);
  const json = (await res.json()) as { text: string };
  return json.text;
}
