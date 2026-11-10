/**
 * Werewolf encyclopedia data source: engine role specs adapted to the shared encyclopedia.
 * Groups follow `spec.faction`; the display color puts `isWolfRole` first.
 */
import {
  Faction,
  getAllRoleIds,
  isWolfRole,
  ROLE_SPECS,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';

import type {
  EncyclopediaFactionColorKey,
  EncyclopediaRoleSource,
} from '@/features/encyclopedia/encyclopediaSource';
import { getRoleAvatar } from '@/games/werewolf/assets/roleAvatars';
import { getRoleBadge } from '@/games/werewolf/assets/roleBadges';
import { getFactionName } from '@/games/werewolf/components/roleDisplayUtils';
import { toWerewolfDescriptionFields } from '@/games/werewolf/components/WerewolfRoleCardAdapter';

import { ALL_TAGS, FACTION_SECTIONS, TAG_COLOR_KEY, TAG_LABELS } from './constants';

const FACTION_GROUP_KEY: Record<Faction, string> = {
  [Faction.God]: 'god',
  [Faction.Wolf]: 'wolf',
  [Faction.Villager]: 'villager',
  [Faction.Special]: 'third',
};

function getFactionColorKey(roleId: RoleId): EncyclopediaFactionColorKey {
  if (isWolfRole(roleId)) return 'wolf';
  const faction = ROLE_SPECS[roleId].faction;
  if (faction === Faction.God) return 'god';
  if (faction === Faction.Special) return 'third';
  return 'villager';
}

/** Werewolf encyclopedia data source, built once. */
export const WEREWOLF_ENCYCLOPEDIA_SOURCE: EncyclopediaRoleSource = {
  roles: getAllRoleIds().map((roleId) => {
    const spec = ROLE_SPECS[roleId];
    return {
      id: roleId,
      displayName: spec.displayName,
      subtitle: spec.englishName,
      factionKey: FACTION_GROUP_KEY[spec.faction],
      factionLabel: getFactionName(roleId),
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
  tagCatalog: ALL_TAGS.map((tag) => ({
    key: tag,
    label: TAG_LABELS[tag],
    colorKey: TAG_COLOR_KEY[tag],
  })),
};
