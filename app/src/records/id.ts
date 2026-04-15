// Generate a random id for local records. We don't need cryptographic
// strength — these ids are only used for client-side list keying until a
// server-side store exists — so we intentionally keep the implementation
// tiny rather than depending on `expo-crypto`.

export function newRecordId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `rec_${Date.now().toString(36)}_${rand}`;
}
