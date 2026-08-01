/** Runtime request schemas for account-owned endpoints. */

import {
  FRAME_IDS,
  NAME_STYLE_IDS,
  ROLE_REVEAL_EFFECT_IDS,
  SEAT_ANIMATION_IDS,
  SEAT_FLAIR_IDS,
} from '@game-judge/game-engine/product/rewards';
import { z } from 'zod';

/** Profile update request validation. */
export const updateProfileSchema = z.strictObject({
  displayName: z.string().max(30).optional(),
  avatarUrl: z.string().max(500).optional(),
  customAvatarUrl: z.string().max(500).optional(),
  avatarFrame: z.enum(['', ...FRAME_IDS]).optional(),
  seatFlair: z.enum(['', ...SEAT_FLAIR_IDS]).optional(),
  nameStyle: z.enum(['', ...NAME_STYLE_IDS]).optional(),
  equippedEffect: z.enum(['', 'random', ...ROLE_REVEAL_EFFECT_IDS]).optional(),
  seatAnimation: z.enum(['', ...SEAT_ANIMATION_IDS]).optional(),
});
