/**
 * gameBanners — Game key-art registry for hero placements.
 *
 * Bundled via Metro static imports (works on native + web).
 * Games without an entry fall back to their gradient hero.
 */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import werewolfBanner from '../../assets/images/game-banners/werewolf-banner.jpg';

export const gameBanners: Partial<Record<GameType, number>> = {
  werewolf: werewolfBanner,
};
