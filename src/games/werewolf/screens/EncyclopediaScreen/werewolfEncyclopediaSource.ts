/**
 * 狼人杀图鉴数据源：把引擎 role spec 适配成共享图鉴的注入接口。
 *
 * 阵营分组/颜色/标签文案全部来自本目录 constants 与引擎 spec，
 * 共享图鉴机器不感知狼人杀概念。分组键按 spec.faction（与原分组逻辑一致），
 * 展示色按 isWolfRole 优先（与原 getFactionColor 一致）。
 */
import {
  Faction,
  getAllRoleIds,
  isWolfRole,
  ROLE_SPECS,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';

import type {
  EncyclopediaRoleSource,
  EncyclopediaRoleTag,
} from '@/features/encyclopedia/encyclopediaSource';
import { getRoleAvatar } from '@/games/werewolf/assets/roleAvatars';
import { getRoleBadge } from '@/games/werewolf/assets/roleBadges';
import { toWerewolfDescriptionFields } from '@/games/werewolf/components/WerewolfRoleCardAdapter';
import type { ThemeColors } from '@/theme';

import { ALL_TAGS, FACTION_SECTIONS, TAG_COLOR_KEY, TAG_LABELS } from './constants';

const FACTION_GROUP_KEY: Record<Faction, string> = {
  [Faction.God]: 'god',
  [Faction.Wolf]: 'wolf',
  [Faction.Villager]: 'villager',
  [Faction.Special]: 'third',
};

function getFactionColorKey(roleId: RoleId): keyof ThemeColors {
  if (isWolfRole(roleId)) return 'wolf';
  const spec = ROLE_SPECS[roleId];
  if (spec.faction === Faction.God) return 'god';
  if (spec.faction === Faction.Special) return 'third';
  return 'villager';
}

function getFactionLabel(roleId: RoleId): string {
  if (isWolfRole(roleId)) return '狼人阵营';
  const spec = ROLE_SPECS[roleId];
  if (spec.faction === Faction.God) return '神职阵营';
  if (spec.faction === Faction.Special) return '第三方阵营';
  return '好人阵营';
}

function buildTagCatalog(): readonly EncyclopediaRoleTag[] {
  return ALL_TAGS.map((tag) => ({
    key: tag,
    label: TAG_LABELS[tag],
    colorKey: TAG_COLOR_KEY[tag],
  }));
}

/** 狼人杀图鉴数据源（静态构建一次）。 */
export const WEREWOLF_ENCYCLOPEDIA_SOURCE: EncyclopediaRoleSource = {
  roles: getAllRoleIds().map((roleId) => {
    const spec = ROLE_SPECS[roleId];
    return {
      id: roleId,
      displayName: spec.displayName,
      subtitle: spec.englishName,
      factionKey: FACTION_GROUP_KEY[spec.faction],
      factionLabel: getFactionLabel(roleId),
      factionColorKey: getFactionColorKey(roleId),
      description: spec.description,
      searchText: `${spec.displayName}${spec.shortName}${spec.description}`,
      structuredFields: toWerewolfDescriptionFields(roleId),
      tags: spec.tags?.map((tag) => ({
        key: tag,
        label: TAG_LABELS[tag],
        colorKey: TAG_COLOR_KEY[tag],
      })),
      listImage: getRoleBadge(roleId),
      detailImage: getRoleAvatar(roleId),
    };
  }),
  factionGroups: FACTION_SECTIONS.map((config) => ({
    key: FACTION_GROUP_KEY[config.faction],
    label: config.label,
    colorKey: config.colorKey,
  })),
  tagCatalog: buildTagCatalog(),
};
