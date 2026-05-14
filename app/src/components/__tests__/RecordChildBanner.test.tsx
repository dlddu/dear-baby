// RecordChildBanner — 기록 화면 상단의 "지금 [이름]에게 기록하고 있어요"
// 라인. 단일·다자녀 사용자 모두에게 동일하게 노출되는 PRD-008 AC-008-01
// 일관성 원칙을 따른다. 테스트는 그 카피와 displayName 반영, 빈 이름 처리만
// 잠근다 — 스타일은 디자인 토큰 변경 시 회귀 노이즈가 너무 크므로 검증 X.

import { render } from '@testing-library/react-native';

import { RecordChildBanner } from '../RecordChildBanner';

describe('RecordChildBanner', () => {
  it('renders the supplied displayName inside the caption', () => {
    const { getByTestId } = render(
      <RecordChildBanner displayName="봄이" testID="banner" />,
    );
    const banner = getByTestId('banner');
    // 자식 트리 안 어디든 displayName 토큰이 등장하면 통과 — 카피는
    // PRD-008 후속 디자인 검토에서 조정될 수 있으므로 풀-문자열 매칭은 피한다.
    const flat = flatten(banner);
    expect(flat).toContain('봄이');
    expect(flat).toMatch(/기록하고 있어요/);
  });

  it('returns null when displayName is blank or whitespace-only', () => {
    const { queryByTestId, rerender } = render(
      <RecordChildBanner displayName="" testID="banner" />,
    );
    expect(queryByTestId('banner')).toBeNull();
    rerender(<RecordChildBanner displayName="   " testID="banner" />);
    expect(queryByTestId('banner')).toBeNull();
  });
});

// flatten walks the rendered React tree and joins every string leaf into a
// single string. Lets the test assert on the visible copy without caring
// about how the component breaks the text up across <Text> children.
function flatten(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(flatten).join('');
  }
  if (typeof node === 'object') {
    const children = (node as { props?: { children?: unknown } }).props?.children;
    return flatten(children);
  }
  return '';
}
