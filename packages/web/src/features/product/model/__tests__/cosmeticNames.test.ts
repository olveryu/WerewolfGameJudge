import {
  FRAME_IDS,
  NAME_STYLE_IDS,
  SEAT_ANIMATION_IDS,
  SEAT_FLAIR_IDS,
} from '@game-judge/game-engine/product/rewards';

import {
  FLAIR_NAMES,
  FRAME_NAMES,
  NAME_STYLE_NAMES,
  SEAT_ANIMATION_NAMES,
} from '@/features/product/model/cosmeticNames';

describe('cosmeticNames', () => {
  it.each([
    ['frames', FRAME_IDS, FRAME_NAMES],
    ['flairs', SEAT_FLAIR_IDS, FLAIR_NAMES],
    ['seat animations', SEAT_ANIMATION_IDS, SEAT_ANIMATION_NAMES],
    ['name styles', NAME_STYLE_IDS, NAME_STYLE_NAMES],
  ])('names exactly the catalog %s', (_kind, ids, names) => {
    expect(Object.keys(names).sort()).toEqual([...ids].sort());
    expect(Object.values(names).every((name) => name.length > 0)).toBe(true);
  });
});
