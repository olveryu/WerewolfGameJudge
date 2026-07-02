/**
 * EncyclopediaScreen constants — shared constants
 *
 * Ability tag Chinese label mapping, faction display config.
 * No business logic, side effects, or platform dependencies.
 */
import type { RoleAbilityTag } from '@werewolf/game-engine/werewolf/models/roles';
import { Faction } from '@werewolf/game-engine/werewolf/models/roles/spec/types';

import type { ThemeColors } from '@/theme';

/** Ability tag Chinese labels (used for encyclopedia filtering and card display) */
export const TAG_LABELS: Record<RoleAbilityTag, string> = {
  check: '查验',
  protect: '保护',
  kill: '杀伤',
  control: '控制',
  link: '连带',
  immune: '免疫',
  transform: '变身',
  survive: '免死',
  follow: '跟随',
  confirm: '确认',
  none: '无能力',
};

/** Ability tag semantic colors (references ThemeColors keys) */
export const TAG_COLOR_KEY: Record<RoleAbilityTag, keyof ThemeColors> = {
  check: 'info',
  protect: 'success',
  kill: 'error',
  control: 'god',
  link: 'warning',
  immune: 'villager',
  transform: 'third',
  survive: 'primaryLight',
  follow: 'textSecondary',
  confirm: 'info',
  none: 'textMuted',
};

/** Ordered list of all ability tags */
export const ALL_TAGS: readonly RoleAbilityTag[] = [
  'check',
  'protect',
  'kill',
  'control',
  'link',
  'immune',
  'transform',
  'survive',
  'follow',
  'none',
] as const;

/** Faction display config */
interface FactionConfig {
  faction: Faction;
  label: string;
  colorKey: 'god' | 'wolf' | 'villager' | 'third';
}

/** SectionList faction group order */
export const FACTION_SECTIONS: readonly FactionConfig[] = [
  { faction: Faction.God, label: '神职', colorKey: 'god' },
  { faction: Faction.Wolf, label: '狼人', colorKey: 'wolf' },
  { faction: Faction.Villager, label: '村民', colorKey: 'villager' },
  { faction: Faction.Special, label: '第三方', colorKey: 'third' },
] as const;
