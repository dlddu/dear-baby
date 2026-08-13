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

  // M-43 (커뮤니티 탭 메인) 을 옮기며 추가한 슬롯 — 목업의 Tailwind 값을 px 로
  // 환원한 수치를 그대로 잠근다.
  it('exposes the h3Bold slot at 17/700 for tab headers and section titles', () => {
    expect(typography.h3Bold.fontSize).toBe(17);
    expect(typography.h3Bold.fontWeight).toBe('700');
    // h3(17/600)와 굵기만 다르다 — 둘을 섞어 쓰지 않도록 값으로 구분해 둔다.
    expect(typography.h3.fontWeight).toBe('600');
  });

  it('exposes the segmentLabel slot at 14/600 for segmented controls', () => {
    expect(typography.segmentLabel.fontSize).toBe(14);
    expect(typography.segmentLabel.fontWeight).toBe('600');
  });

  it('exposes the feedTitle slot at 15/700/22 (leading-[1.45])', () => {
    expect(typography.feedTitle.fontSize).toBe(15);
    expect(typography.feedTitle.fontWeight).toBe('700');
    expect(typography.feedTitle.lineHeight).toBe(22);
  });

  it('exposes the feedBody slot at 13/22 (leading-[1.7]) — caption 보다 넓은 행간', () => {
    expect(typography.feedBody.fontSize).toBe(13);
    expect(typography.feedBody.lineHeight).toBe(22);
    expect(typography.caption.lineHeight).toBe(18);
  });

  it('keeps body fontSize=15 so TextInput screens can reference it without a magic number', () => {
    // a2 / b2 / b5 / c2 의 TextInput 이 typography.body.fontSize 를 참조한다.
    expect(typography.body.fontSize).toBe(15);
  });
});
