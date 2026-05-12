# dear-baby — Claude 작업 메모

이 파일은 dear-baby 코드베이스에서 Claude 가 작업할 때 다시 안 밟아야 할
함정과 프로젝트 관례를 기록한다. 새 함정을 발견하면 짧게 1개 항목을 추가한다.

---

## 온보딩 다인스턴스 화면 (다태아 / 다자녀) 패턴

다태아·다자녀 입력 화면처럼 **같은 라우트를 stack 에 여러 번 push** 하는 화면은
**자기 인덱스를 `useLocalSearchParams` 로 받아야 한다.** context (`useOnboarding`) 의
`currentFetusIndex` / `currentChildIndex` 를 직접 구독해서 화면을 그리면 안 된다.

### 왜
- `router.push({ pathname, params: { index } })` 로 새 인스턴스를 stack 에 쌓는
  구조에서, **forward 시 context.currentIndex 가 증가** → stack 의 이전 인스턴스도
  모두 그 컨텍스트 값으로 re-render 됨.
- iOS 네이티브 스와이프 백 제스처는 우리 `onBack` 핸들러를 호출하지 않고
  라우트만 pop 한다. 그래서 `setCurrent...Index(prev - 1)` 동기화가 일어나지
  않음 → stack 의 모든 인스턴스가 마지막 인덱스 값으로 잘못 표시.
- 라우트 매개변수는 push 시점에 고정되므로 인스턴스마다 독립적인 식별자가
  유지된다.

### 규칙
- a2 / b2 / b2-purpose / b5 / c2 / c3 같은 **다인스턴스 화면 한 쌍은 둘 다**
  `params.index` 로 식별해야 한다 (한쪽만 params 쓰면 비대칭 버그 재발).
- 이전 화면에서 push 할 때 항상 `params: { index: String(nextIndex) }` 를 함께
  넘긴다. b2 → b2-purpose, b2-purpose → b2 양쪽 모두.
- `setCurrent...Index(...)` 는 **영속화(drafts cache) 용으로만** 호출한다.
  UI 식별의 단일 소스는 라우트 매개변수다.
- `onBack` 의 setCurrent...Index 호출도 영속화 목적. 실제로 iOS 스와이프 백이
  들어오면 핸들러가 안 돌아도 UI 는 params 기반이라 정상 동작해야 한다.

### 참고 커밋
- `2ed464b` Case B 8화면 신규 (b2-purpose 가 context 구독으로 만들어진 버그의 시작)
- `dd6047c` OnboardingTopRow 추출 (b2 만 params 로 옮긴 절반 통일)
- `6e835ca` b2-purpose 도 params.index 로 옮겨 대칭 완성 + 스와이프 백 버그 수정
