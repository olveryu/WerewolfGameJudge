/** Werewolf encyclopedia constants: ability tag labels and palette keys, faction group order. */
import { Faction, type RoleAbilityTag } from '@game-judge/game-engine/games/werewolf/public';

import type {
  EncyclopediaFactionColorKey,
  EncyclopediaTagColorKey,
} from '@/features/encyclopedia/encyclopediaSource';

/** Ability tag Chinese labels (encyclopedia filter and card chips). */
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

/** Ability tag semantic colors. */
export const TAG_COLOR_KEY: Record<RoleAbilityTag, EncyclopediaTagColorKey> = {
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

/** Ability tags offered by the filter, in order. */
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
];

interface FactionConfig {
  readonly faction: Faction;
  readonly label: string;
  readonly colorKey: EncyclopediaFactionColorKey;
}

/** Faction group order. */
export const FACTION_SECTIONS: readonly FactionConfig[] = [
  { faction: Faction.God, label: '神职', colorKey: 'god' },
  { faction: Faction.Wolf, label: '狼人', colorKey: 'wolf' },
  { faction: Faction.Villager, label: '村民', colorKey: 'villager' },
  { faction: Faction.Special, label: '第三方', colorKey: 'third' },
];
