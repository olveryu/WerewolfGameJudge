/**
 * campVisual — camp bucket display metadata (label, emoji, color).
 *
 * Shared by CampDistributionBar (SettingsScreen growth section + room PlayerProfileCard).
 * Colors reference the shared theme camp palette (colors.wolf / god / villager / third),
 * keeping camp coloring consistent with the encyclopedia and seat UI.
 */
import type { CampBucket } from '@werewolf/game-engine/werewolf/models/roles';

import { colors } from '@/theme';

interface CampVisual {
  /** Chinese display label */
  label: string;
  /** Camp emoji icon */
  emoji: string;
  /** Theme color for the camp */
  color: string;
}

export const CAMP_VISUAL: Record<CampBucket, CampVisual> = {
  wolf: { label: '狼人', emoji: '🐺', color: colors.wolf },
  god: { label: '神', emoji: '✨', color: colors.god },
  villager: { label: '平民', emoji: '🧑', color: colors.villager },
  third: { label: '第三方', emoji: '🎭', color: colors.third },
};
