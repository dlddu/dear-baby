// Mock pool of daily questions shown on the Stage 2 home card. Copy follows
// the warm/emotional tone from docs/wireframes/onboarding.md — no
// functional phrasing.
//
// Placeholder only: pregnancy-week-aware selection (PRD-002 AC-002-02) is
// deferred until the question prompt engineering is finalized. See
// docs/engineering/weekly-questions-plan.md. When the real backend question
// service lands, swap `pickDailyQuestion` for a fetched value.

export const DAILY_QUESTIONS: readonly string[] = [
  '오늘 아기에게 가장 해주고 싶은 말은?',
  '오늘 아기를 생각하며 느낀 감정은 어떤가요?',
  '아기에게 불러주고 싶은 노래가 있나요?',
  '오늘 아기와 함께하고 싶은 일은 무엇인가요?',
  '아기를 처음 만나면 어떤 인사를 건네고 싶나요?',
  '아기에게 꼭 전해주고 싶은 추억이 있나요?',
  '오늘 엄마의 하루는 어땠나요, 아기야?',
  '아기가 좋아할 것 같은 장소는 어디인가요?',
  '아기에게 해주고 싶은 약속이 있다면요?',
  '오늘 본 것 중에 아기에게 보여주고 싶은 건 무엇인가요?',
  '아기를 기다리며 가장 설레는 순간은 언제인가요?',
  '오늘 아기에게 들려주고 싶은 이야기가 있나요?',
] as const;

// dayOfYear returns 1..366 in the local timezone. Used to pick the same
// question all day without needing a backend.
function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

export function pickDailyQuestion(date: Date = new Date()): string {
  const idx = dayOfYear(date) % DAILY_QUESTIONS.length;
  return DAILY_QUESTIONS[idx];
}
