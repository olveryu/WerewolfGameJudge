/**
 * rewardCatalog.contract — reward catalog and shipped assets
 *
 * Every mythic set registers six independently equippable rewards, and every hand-drawn avatar
 * ships its raw, thumbnail and WebP assets. Client renderer completeness (frames, flairs, name
 * styles, entrances, reveal companions) is the web client's own test.
 */

import fs from 'node:fs';
import path from 'node:path';

import { HAND_DRAWN_AVATAR_IDS, REWARD_POOL_BY_ID } from '@game-judge/game-engine/product/rewards';

const ASSETS_ROOT = path.resolve(import.meta.dirname, '../assets');

describe('mythic collection contracts', () => {
  it.each([
    ['fateWeaver', 'celestialLoom', 'starWeave', 'goldenScript', 'fateReweave', 'wovenArrival'],
    ['tidePriestess', 'coralTide', 'moonTides', 'pearlOath', 'oceanPearl', 'tidalArrival'],
    [
      'inkImmortal',
      'inkLandscape',
      'paintedMountains',
      'vermilionName',
      'unfoldLandscape',
      'inkArrival',
    ],
  ])('registers six independently equippable mythic rewards for %s', (...ids) => {
    const items = ids.map((id) => REWARD_POOL_BY_ID.get(id));
    expect(items.map((item) => item?.type)).toEqual([
      'avatar',
      'frame',
      'seatFlair',
      'nameStyle',
      'roleRevealEffect',
      'seatAnimation',
    ]);
    expect(items.every((item) => item?.rarity === 'mythic')).toBe(true);
  });
});

describe('hand-drawn avatar assets', () => {
  it.each(HAND_DRAWN_AVATAR_IDS)('raw PNG exists for avatar "%s"', (id) => {
    const file = path.join(ASSETS_ROOT, 'avatars/raw', `${id}.png`);
    expect(fs.existsSync(file)).toBe(true);
  });

  it.each(HAND_DRAWN_AVATAR_IDS)('512px thumbnail PNG exists for avatar "%s"', (id) => {
    const file = path.join(ASSETS_ROOT, 'badges/png/512', `role_${id}.png`);
    expect(fs.existsSync(file)).toBe(true);
  });

  it.each(HAND_DRAWN_AVATAR_IDS)('WebP avatar exists for "%s"', (id) => {
    const file = path.join(ASSETS_ROOT, 'avatars/web', `${id}.webp`);
    expect(fs.existsSync(file)).toBe(true);
  });

  it.each(HAND_DRAWN_AVATAR_IDS)('WebP badge exists for "%s"', (id) => {
    const file = path.join(ASSETS_ROOT, 'badges/web', `role_${id}.webp`);
    expect(fs.existsSync(file)).toBe(true);
  });
});
