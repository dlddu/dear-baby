// CommunityTypeFilter — AC-009-06 콘텐츠 타입 필터 (M-43 세그먼티드 컨트롤).
//
// AC 표가 정한 것은 세 가지다: 항목 3종 · 순서 · 기본 선택값. 라벨과 순서를
// 상수에서가 아니라 **렌더 결과에서** 확인해 카피가 바뀌면 실패하게 한다.

import { fireEvent, render } from '@testing-library/react-native';

import {
  COMMUNITY_TYPE_FILTERS,
  CommunityTypeFilter,
} from '../CommunityTypeFilter';

describe('CommunityTypeFilter', () => {
  it('AC-009-06 표의 항목과 순서 그대로 그린다', () => {
    expect(COMMUNITY_TYPE_FILTERS.map((f) => f.label)).toEqual([
      '전체',
      '질문답변',
      '자유일기',
    ]);
    expect(COMMUNITY_TYPE_FILTERS.map((f) => f.value)).toEqual([
      'all',
      'question',
      'diary',
    ]);

    const { getByText } = render(
      <CommunityTypeFilter value="all" onChange={jest.fn()} />,
    );
    for (const label of ['전체', '질문답변', '자유일기']) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('선택된 항목만 selected 상태를 갖는다', () => {
    const { getByTestId } = render(
      <CommunityTypeFilter value="question" onChange={jest.fn()} />,
    );
    expect(
      getByTestId('community-filter-question').props.accessibilityState
        .selected,
    ).toBe(true);
    expect(
      getByTestId('community-filter-all').props.accessibilityState.selected,
    ).toBe(false);
    expect(
      getByTestId('community-filter-diary').props.accessibilityState.selected,
    ).toBe(false);
  });

  it('항목을 누르면 그 값으로 onChange 한다', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <CommunityTypeFilter value="all" onChange={onChange} />,
    );
    fireEvent.press(getByTestId('community-filter-diary'));
    expect(onChange).toHaveBeenCalledWith('diary');
  });
});
