// Domain types for the "기록" (Record) entity — see docs/glossary.md.
//
// A Record is a single diary entry authored by the pregnant user. Per PRD-001
// it may originate from voice (AC-001-02) or text direct input (AC-001-04);
// both share the same shape so the list view (AC-001-05) can render them
// uniformly.

/** Origin of the record. `voice` entries were dictated and transcribed by
 * Whisper (GGML). `text` entries were typed directly. */
export type RecordType = 'voice' | 'text';

export type Record = {
  /** Stable client-generated id (uuid-ish). */
  id: string;
  type: RecordType;
  /** Final user-facing body. For voice records this is the (optionally
   *  edited) transcript; for text records this is the typed content. */
  text: string;
  /** Local file:// URI of the original audio, when the user chose to keep
   *  it (PRD-001 AC-001-02 / PRD-005 AC-005-05). */
  audioPath?: string;
  /** ISO 8601 timestamp (device local time). */
  createdAt: string;
};
