// Notifications mock — PRD-007 AC-007-03 의 종 아이콘 red dot 카운트.
//
// 백엔드 알림 API 가 아직 없으므로 결정적 stub 을 둔다. 시그니처는 백엔드
// 도착 시 그대로 유지하여 export 만 교체 가능하도록 맞췄다 (홈 화면이 의존하는
// 표면적은 `getUnreadCount(): Promise<number>` 한 줄뿐).
//
// 시드는 1 — red dot 이 "있는" 상태가 기본이라야 시각 검증/E2E 가 의미를
// 가진다. 0 을 보고 싶다면 호출자 쪽에서 ?override=0 같은 dev knob 을 도입할
// 수 있겠지만, 현 단계에서는 단순 상수로 충분하다.

const STUB_UNREAD_COUNT = 1;

export async function getUnreadCount(): Promise<number> {
  return STUB_UNREAD_COUNT;
}
