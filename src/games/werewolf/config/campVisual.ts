/**
 * campVisual — camp bucket display metadata (label, emoji, color).
 *
 * Owned by the Werewolf account and room profile extensions.
 * Colors reference the shared theme camp palette (colors.wolf / god / villager / third),
 * keeping camp coloring consistent with the encyclopedia and seat UI.
 */
import type { WerewolfCampStats } from '@werewolf/game-engine/games/werewolf/public';

import { colors } from '@/theme';

interface CampVisual {
  /** Chinese display label */
  label: string;
  /** Camp emoji icon */
  emoji: string;
  /** Theme color for the camp */
  color: string;
}

export const CAMP_VISUAL: Record<keyof WerewolfCampStats['counts'], CampVisual> = {
  wolf: { label: '狼人', emoji: '🐺', color: colors.wolf },
  god: { label: '神', emoji: '✨', color: colors.god },
  villager: { label: '平民', emoji: '🧑', color: colors.villager },
  third: { label: '第三方', emoji: '🎭', color: colors.third },
};
