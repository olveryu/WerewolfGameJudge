/**
 * campVisual — camp bucket display metadata (label, emoji, tone).
 *
 * Owned by the Werewolf account and room profile extensions.
 * Tones reference the shared theme faction tones (wolf / god / villager / third),
 * keeping camp coloring consistent with the encyclopedia and seat UI.
 */
import type { WerewolfCampStats } from '@game-judge/game-engine/games/werewolf/public';

import type { ColorTone } from '@/theme';

interface CampVisual {
  /** Chinese display label */
  label: string;
  /** Camp emoji icon */
  emoji: string;
  /** Theme tone for the camp */
  tone: ColorTone;
}

export const CAMP_VISUAL: Record<keyof WerewolfCampStats['counts'], CampVisual> = {
  wolf: { label: '狼人', emoji: '🐺', tone: 'wolf' },
  god: { label: '神', emoji: '✨', tone: 'god' },
  villager: { label: '平民', emoji: '🧑', tone: 'villager' },
  third: { label: '第三方', emoji: '🎭', tone: 'third' },
};
