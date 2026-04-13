/**
 * rewardCatalog.contract — Reward item registry completeness guard
 *
 * Ensures every ID in the shared catalog (AVATAR_IDS, FRAME_IDS, SEAT_FLAIR_IDS)
 * has a corresponding renderable asset registered on the client side:
 *   - Avatar: require()'d image in AVATAR_IMAGES + thumbnail in AVATAR_THUMBS
 *   - Frame: Component entry in avatarFrames registry
 *   - Flair: Component entry in seatFlairs registry
 *
 * Also verifies PNG assets exist on disk for every avatar ID.
 */

import fs from 'node:fs';
import path from 'node:path';

import { AVATAR_IDS, FRAME_IDS, SEAT_FLAIR_IDS } from '@werewolf/game-engine/growth/rewardCatalog';

import { AVATAR_FRAMES, getFrameById } from '@/components/avatarFrames';
import { getFlairById, SEAT_FLAIRS } from '@/components/seatFlairs';
import { AVATAR_IMAGES, AVATAR_KEYS } from '@/utils/avatar';

const ASSETS_ROOT = path.resolve(__dirname, '../../assets');

// ─── Avatars ────────────────────────────────────────────────────────────────

describe('avatar registry completeness', () => {
  it('AVATAR_KEYS re-exports every AVATAR_IDS entry', () => {
    expect(AVATAR_KEYS).toEqual(AVATAR_IDS);
  });

  it('AVATAR_IMAGES has exactly one entry per AVATAR_IDS', () => {
    expect(AVATAR_IMAGES).toHaveLength(AVATAR_IDS.length);
  });

  it.each(AVATAR_IDS)('raw PNG exists for avatar "%s"', (id) => {
    const file = path.join(ASSETS_ROOT, 'avatars/raw', `${id}.png`);
    expect(fs.existsSync(file)).toBe(true);
  });

  it.each(AVATAR_IDS)('512px thumbnail PNG exists for avatar "%s"', (id) => {
    const file = path.join(ASSETS_ROOT, 'badges/png/512', `role_${id}.png`);
    expect(fs.existsSync(file)).toBe(true);
  });
});

// ─── Frames ─────────────────────────────────────────────────────────────────

describe('frame registry completeness', () => {
  it('AVATAR_FRAMES has exactly one entry per FRAME_IDS', () => {
    expect(AVATAR_FRAMES).toHaveLength(FRAME_IDS.length);
  });

  it.each(FRAME_IDS)('getFrameById returns a config for "%s"', (id) => {
    const config = getFrameById(id);
    expect(config).toBeDefined();
    expect(config!.Component).toBeDefined();
  });
});

// ─── Seat Flairs ────────────────────────────────────────────────────────────

describe('flair registry completeness', () => {
  it('SEAT_FLAIRS has exactly one entry per SEAT_FLAIR_IDS', () => {
    expect(SEAT_FLAIRS).toHaveLength(SEAT_FLAIR_IDS.length);
  });

  it.each(SEAT_FLAIR_IDS)('getFlairById returns a config for "%s"', (id) => {
    const config = getFlairById(id);
    expect(config).toBeDefined();
    expect(config!.Component).toBeDefined();
  });
});
