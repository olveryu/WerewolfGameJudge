/**
 * EncyclopediaScreen constants — 共享常量
 *
 * 能力标签中文映射、阵营显示配置。
 * 不含业务逻辑、副作用、平台依赖。
 */
import type { RoleAbilityTag } from '@werewolf/game-engine/models/roles';
import { Faction } from '@werewolf/game-engine/models/roles/spec/types';

import type { ThemeColors } from '@/theme';

/** 能力标签中文映射（百科筛选 + 卡片展示用） */
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
  none: '无能力',
};

/** 能力标签语义色（引用 ThemeColors key） */
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
  none: 'textMuted',
};

/** 所有能力标签有序列表 */
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

/** 阵营显示配置 */
export interface FactionConfig {
  faction: Faction;
  label: string;
  colorKey: 'god' | 'wolf' | 'villager' | 'third';
}

/** SectionList 阵营分组顺序 */
export const FACTION_SECTIONS: readonly FactionConfig[] = [
  { faction: Faction.God, label: '神职', colorKey: 'god' },
  { faction: Faction.Wolf, label: '狼人', colorKey: 'wolf' },
  { faction: Faction.Villager, label: '村民', colorKey: 'villager' },
  { faction: Faction.Special, label: '第三方', colorKey: 'third' },
] as const;
