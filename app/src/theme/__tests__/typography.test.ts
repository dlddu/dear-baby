// Typography token unit test — 슬롯 추가 후 매직 fontSize/lineHeight 가
// 다시 화면 코드에 흩어지는 회귀를 막기 위해, 본 PR 에서 신설한 슬롯의
// 정확한 fontSize·lineHeight 값을 잠가둔다.

import { typography } from '../typography';

describe('typography slots', () => {
  it('exposes the iconHero slot at 48/64 for onboarding hero icons', () => {
    expect(typography.iconHero.fontSize).toBe(48);
    expect(typography.iconHero.lineHeight).toBe(64);
  });

  it('exposes the emoji slot at 16/20 for inline helper emoji', () => {
    expect(typography.emoji.fontSize).toBe(16);
    expect(typography.emoji.lineHeight).toBe(20);
  });

  it('exposes the tagline slot at 15/22 for soft multi-line taglines', () => {
    expect(typography.tagline.fontSize).toBe(15);
    expect(typography.tagline.lineHeight).toBe(22);
  });

  it('keeps body fontSize=15 so TextInput screens can reference it without a magic number', () => {
    // a2 / b2 / b5 / c2 의 TextInput 이 typography.body.fontSize 를 참조한다.
    expect(typography.body.fontSize).toBe(15);
  });
});
