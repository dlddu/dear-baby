// Daily question pool used by the home-screen 1인칭 카드 (PRD-007 AC-007-04·05).
// 본격적인 주차별·모드별 질문 풀과 회전 알고리즘은 PRD-002 후속 작업에서
// 다룬다 — 본 모듈은 12개의 1인칭 임시 풀과, 그 풀에서 같은 날 동일한 3개를
// 결정적으로 골라내는 헬퍼만 제공한다.

// 12개 모두 아이 1인칭 시점("엄마, 오늘은 제가 …") 으로 작성. 카피 결정의
// 시각 출처: docs/mockups/source/src/screens/HomePregnancyScreen.tsx L58-60.
export const DAILY_QUESTIONS: readonly string[] = [
  '엄마, 오늘은 제가 엄마 배 속에서 어떤 꿈을 꿨을까요?',
  '엄마, 오늘은 제가 어떤 모습으로 자라고 있을까요?',
  '엄마, 오늘은 제가 어떤 노래를 듣고 싶어 했을까요?',
  '엄마, 오늘은 제가 엄마에게 어떤 말을 건네고 싶었을까요?',
  '엄마, 오늘은 제가 가장 좋아한 순간이 언제였을까요?',
  '엄마, 오늘은 제가 어떤 음식을 함께 먹고 싶어 했을까요?',
  '엄마, 오늘은 제가 엄마의 어떤 표정을 보고 싶었을까요?',
  '엄마, 오늘은 제가 엄마와 함께 가고 싶은 곳이 있었을까요?',
  '엄마, 오늘은 제가 처음으로 느낀 감정이 무엇이었을까요?',
  '엄마, 오늘은 제가 엄마에게 가장 고마웠던 일이 무엇이었을까요?',
  '엄마, 오늘은 제가 엄마와 함께 만들고 싶은 추억이 있었을까요?',
  '엄마, 오늘은 제가 엄마에게 어떤 약속을 받고 싶었을까요?',
] as const;

// 하루에 사용자에게 보여줄 회전 슬롯 수. PRD-007 AC-007-05 — 사용자는 하루
// 최대 3개 까지 회전.
export const DAILY_QUESTION_SLOTS = 3;

// dayOfYear returns 1..366 in the local timezone. Used to pick a stable seed
// that flips at midnight without needing a backend.
function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

// getDailyQuestionTriplet — 결정적 3개 선택.
// 같은 날에는 항상 같은 3개, 다른 날에는 시작 인덱스가 한 칸씩 밀린 3개를
// 돌려준다. 풀 길이를 넘어가면 wrap-around 한다 — 12 % 3 == 0 이라 매일
// 새로운 3개가 보이지 않고 4일마다 같은 묶음이 반복되긴 하지만, 본격 풀이
// 들어올 때까지의 임시 동작으로 충분하다.
export function getDailyQuestionTriplet(
  date: Date = new Date(),
  pool: readonly string[] = DAILY_QUESTIONS,
): readonly string[] {
  if (pool.length === 0) return [];
  const slots = Math.min(DAILY_QUESTION_SLOTS, pool.length);
  const start = dayOfYear(date) % pool.length;
  const out: string[] = [];
  for (let i = 0; i < slots; i += 1) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}
