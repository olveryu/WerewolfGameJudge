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

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  AVATAR_IDS,
  FRAME_IDS,
  HAND_DRAWN_AVATAR_IDS,
  NAME_STYLE_IDS,
  SEAT_FLAIR_IDS,
} from '@game-judge/game-engine/product/rewards';

import { AVATAR_FRAMES, getFrameById } from '@/components/avatarFrames';
import { isGeneratedAvatar } from '@/components/GeneratedAvatar';
import { getNameStyleById, NAME_STYLES } from '@/components/nameStyles';
import { getFlairById, SEAT_FLAIRS } from '@/components/seatFlairs';
import { AVATAR_IMAGES, AVATAR_KEYS } from '@/utils/avatar';

const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const SPARSE_CHECKOUT_FILE = path.join(REPOSITORY_ROOT, '.git/info/sparse-checkout');
const IS_SPARSE_CHECKOUT = fs.existsSync(SPARSE_CHECKOUT_FILE);
const TRACKED_ASSETS = IS_SPARSE_CHECKOUT
  ? new Set(
      execFileSync('git', ['ls-files', 'assets'], {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
      })
        .split('\n')
        .filter(Boolean),
    )
  : new Set<string>();

function expectAssetPresent(relativePath: string): void {
  const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
  if (fs.existsSync(absolutePath)) return;

  if (IS_SPARSE_CHECKOUT) {
    expect(TRACKED_ASSETS.has(relativePath)).toBe(true);
    return;
  }

  expect(fs.existsSync(absolutePath)).toBe(true);
}

// ─── Avatars ────────────────────────────────────────────────────────────────

describe('avatar registry completeness', () => {
  it('AVATAR_KEYS re-exports every AVATAR_IDS entry', () => {
    expect(AVATAR_KEYS).toEqual(AVATAR_IDS);
  });

  it('AVATAR_IMAGES has exactly one entry per hand-drawn avatar', () => {
    expect(AVATAR_IMAGES).toHaveLength(HAND_DRAWN_AVATAR_IDS.length);
  });

  it('generated avatars are correctly identified', () => {
    const generatedIds = AVATAR_IDS.filter(isGeneratedAvatar);
    const handDrawnIds = AVATAR_IDS.filter((id) => !isGeneratedAvatar(id));
    expect(handDrawnIds).toHaveLength(HAND_DRAWN_AVATAR_IDS.length);
    expect(generatedIds.length + handDrawnIds.length).toBe(AVATAR_IDS.length);
  });

  it.each(HAND_DRAWN_AVATAR_IDS)('raw PNG exists for avatar "%s"', (id) => {
    expectAssetPresent(`assets/avatars/raw/${id}.png`);
  });

  it.each(HAND_DRAWN_AVATAR_IDS)('512px thumbnail PNG exists for avatar "%s"', (id) => {
    expectAssetPresent(`assets/badges/png/512/role_${id}.png`);
  });

  it.each(HAND_DRAWN_AVATAR_IDS)('WebP avatar exists for "%s"', (id) => {
    expectAssetPresent(`assets/avatars/web/${id}.webp`);
  });

  it.each(HAND_DRAWN_AVATAR_IDS)('WebP badge exists for "%s"', (id) => {
    expectAssetPresent(`assets/badges/web/role_${id}.webp`);
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

// ─── Name Styles ────────────────────────────────────────────────────────────

describe('nameStyle registry completeness', () => {
  it('NAME_STYLES has exactly one entry per NAME_STYLE_IDS', () => {
    expect(NAME_STYLES).toHaveLength(NAME_STYLE_IDS.length);
  });

  it.each(NAME_STYLE_IDS)('getNameStyleById returns a config for "%s"', (id) => {
    const config = getNameStyleById(id);
    expect(config).toBeDefined();
    expect(config!.name).toBeTruthy();
    expect(config!.tier).toBeTruthy();
  });
});
