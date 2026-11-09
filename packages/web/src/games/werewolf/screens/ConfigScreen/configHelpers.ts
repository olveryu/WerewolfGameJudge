/**
 * configHelpers — Pure helper functions for ConfigScreen
 *
 * Module-level data transformations used by useConfigScreenState and the board picker.
 * No React dependencies — pure functions and static data only.
 */

import {
  Faction,
  findMatchingPresetName,
  getPlayerCount,
  isValidRoleId,
  type PresetTemplate,
  ROLE_SPECS,
  type RoleId,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
} from '@game-judge/game-engine/games/werewolf/public';

import { buildInitialSelection, FACTION_GROUPS, slotSelectionKey } from './configData';

export type VariantOverrides = Partial<Record<RoleId, RoleId>>;

/** Faction color key: the `data-faction` value of faction-tinted surfaces (faction.css). */
export type FactionColorKey = 'wolf' | 'god' | 'villager' | 'third';

/** Map Faction enum to FactionColorKey for chip coloring */
export const FACTION_COLOR_MAP: Readonly<Record<Faction, FactionColorKey>> = {
  [Faction.Wolf]: 'wolf',
  [Faction.God]: 'god',
  [Faction.Villager]: 'villager',
  [Faction.Special]: 'third',
};

// ─────────────────────────────────────────────────────────────────────────────
// Selection helpers
// ─────────────────────────────────────────────────────────────────────────────

/** All roles off — used when entering ConfigScreen via "从零开始自定义". */
export const getEmptySelection = (): Record<string, boolean> => buildInitialSelection([]);

/** Base role of a selection key (`wolf2` → `wolf`). */
export function selectionKeyToRoleId(key: string): RoleId {
  const baseRoleId = key.replace(/\d+$/, '');
  if (!isValidRoleId(baseRoleId)) {
    throw new Error(`[FAIL-FAST] Invalid role selection key: ${key}`);
  }
  return baseRoleId;
}

/** Convert selection to a RoleId array. */
export const selectionToRoles = (
  selection: Readonly<Record<string, boolean>>,
  variantOverrides?: VariantOverrides,
): RoleId[] => {
  const roles: RoleId[] = [];
  for (const [key, selected] of Object.entries(selection)) {
    if (!selected) continue;
    const baseRoleId = selectionKeyToRoleId(key);
    roles.push(variantOverrides?.[baseRoleId] ?? baseRoleId);
  }
  return roles;
};

// ─────────────────────────────────────────────────────────────────────────────
// Slot lookup
// ─────────────────────────────────────────────────────────────────────────────

type RoleSlot = (typeof FACTION_GROUPS)[number]['sections'][number]['roles'][number];

/** The config slot of a base role; every base role appears in exactly one slot. */
export function findRoleSlot(roleId: RoleId): RoleSlot {
  for (const group of FACTION_GROUPS) {
    for (const section of group.sections) {
      for (const slot of section.roles) {
        if (slot.roleId === roleId) return slot;
      }
    }
  }
  throw new Error(`[FAIL-FAST] ${roleId} has no config slot`);
}

/**
 * Reverse lookup: variantId → base slot roleId.
 * Built once from FACTION_GROUPS at module level.
 */
const VARIANT_TO_BASE: ReadonlyMap<RoleId, RoleId> = (() => {
  const map = new Map<RoleId, RoleId>();
  for (const group of FACTION_GROUPS) {
    for (const section of group.sections) {
      for (const slot of section.roles) {
        for (const variant of slot.variants ?? []) {
          map.set(variant, slot.roleId);
        }
      }
    }
  }
  return map;
})();

/**
 * Reconstruct selection + variantOverrides from stored templateRoles.
 *
 * Variant roleIds (e.g. drunkSeer) are mapped back to their base slot (mirrorSeer)
 * for selection keys, and stored in variantOverrides for display.
 */
export const restoreFromTemplateRoles = (
  templateRoles: readonly RoleId[],
): {
  selection: Record<string, boolean>;
  variantOverrides: VariantOverrides;
  matchedPreset: string | undefined;
} => {
  const selection = getEmptySelection();
  const overrides: VariantOverrides = {};
  const baseCounts = new Map<RoleId, number>();
  for (const role of templateRoles) {
    const baseId = VARIANT_TO_BASE.get(role) ?? role;
    if (VARIANT_TO_BASE.has(role)) {
      overrides[baseId] = role;
    }
    baseCounts.set(baseId, (baseCounts.get(baseId) ?? 0) + 1);
  }
  baseCounts.forEach((count, baseRole) => {
    for (let i = 0; i < count; i++) {
      const key = slotSelectionKey(baseRole, i);
      if (key in selection) selection[key] = true;
    }
  });
  const matchedPreset = findMatchingPresetName(templateRoles) ?? undefined;
  return { selection, variantOverrides: overrides, matchedPreset };
};

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Compute total player count (accounts for treasureMaster bottom cards) */
export const computeTotalCount = (
  selection: Readonly<Record<string, boolean>>,
  variantOverrides?: VariantOverrides,
): number => getPlayerCount(selectionToRoles(selection, variantOverrides));

/** Expand a RoleSlot into an array of {key, label} for rendering chips */
export const expandSlotToChipEntries = (
  slot: RoleSlot,
  variantOverrides?: VariantOverrides,
): { key: string; label: string; hasVariants: boolean }[] => {
  const count = slot.count ?? 1;
  const activeRoleId = variantOverrides?.[slot.roleId] ?? slot.roleId;
  const label = ROLE_SPECS[activeRoleId].displayName;
  const hasVariants = slot.variants !== undefined && slot.variants.length > 0;

  return Array.from({ length: count }, (_, i) => ({
    key: slotSelectionKey(slot.roleId, i),
    label,
    hasVariants,
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// Template picker helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Faction statistics for a template */
interface FactionStats {
  wolfCount: number;
  godCount: number;
  villagerCount: number;
  thirdCount: number;
}

/** Role display item (roleId + displayName + count) */
interface TemplateRoleItem {
  roleId: RoleId;
  displayName: string;
  count: number;
  faction: Faction;
}

/** Prioritize distinctive roles: third-party > wolf variants > god > villager */
const FACTION_PRIORITY: Readonly<Record<Faction, number>> = {
  [Faction.Special]: 0,
  [Faction.Wolf]: 1,
  [Faction.God]: 2,
  [Faction.Villager]: 3,
};

function byFactionPriority(a: TemplateRoleItem, b: TemplateRoleItem): number {
  return FACTION_PRIORITY[a.faction] - FACTION_PRIORITY[b.faction];
}

function toRoleItem(roleId: RoleId, count: number): TemplateRoleItem {
  const spec = ROLE_SPECS[roleId];
  return { roleId, displayName: spec.displayName, count, faction: spec.faction };
}

function countRoles(roles: readonly RoleId[], skipGeneric: boolean): Map<RoleId, number> {
  const countMap = new Map<RoleId, number>();
  for (const roleId of roles) {
    if (skipGeneric && (roleId === 'wolf' || roleId === 'villager')) continue;
    countMap.set(roleId, (countMap.get(roleId) ?? 0) + 1);
  }
  return countMap;
}

/** Compute faction statistics from a roles array */
export const computeFactionStats = (roles: readonly RoleId[]): FactionStats => {
  const stats: FactionStats = { wolfCount: 0, godCount: 0, villagerCount: 0, thirdCount: 0 };
  for (const roleId of roles) {
    switch (ROLE_SPECS[roleId].faction) {
      case Faction.Wolf:
        stats.wolfCount++;
        break;
      case Faction.God:
        stats.godCount++;
        break;
      case Faction.Villager:
        stats.villagerCount++;
        break;
      case Faction.Special:
        stats.thirdCount++;
        break;
    }
  }
  return stats;
};

/**
 * Get "key roles" — non-generic roles that distinguish this template.
 * Excludes plain 'wolf' and 'villager'. Returns up to `max` unique display items.
 */
export const getKeyRoles = (roles: readonly RoleId[], max: number = 3): TemplateRoleItem[] => {
  const items = [...countRoles(roles, true)].map(([roleId, count]) => toRoleItem(roleId, count));
  items.sort(byFactionPriority);
  return items.slice(0, max);
};

/**
 * Collect all distinctive roles across ALL preset templates.
 * Excludes generic 'wolf' and 'villager'. De-duplicated, sorted by faction
 * priority (third > wolf variants > god).
 */
export const getDistinctiveRoles = (templates: readonly PresetTemplate[]): TemplateRoleItem[] => {
  const seen = new Set<RoleId>();
  const items: TemplateRoleItem[] = [];
  for (const template of templates) {
    for (const roleId of template.roles) {
      if (roleId === 'wolf' || roleId === 'villager' || seen.has(roleId)) continue;
      seen.add(roleId);
      items.push(toRoleItem(roleId, 1));
    }
  }
  items.sort(byFactionPriority);
  return items;
};

/**
 * Group roles by faction for detailed display.
 * Returns four arrays: wolf, god, villager, third.
 */
export const groupRolesByFaction = (
  roles: readonly RoleId[],
): {
  wolfItems: TemplateRoleItem[];
  godItems: TemplateRoleItem[];
  villagerItems: TemplateRoleItem[];
  thirdItems: TemplateRoleItem[];
} => {
  const wolfItems: TemplateRoleItem[] = [];
  const godItems: TemplateRoleItem[] = [];
  const villagerItems: TemplateRoleItem[] = [];
  const thirdItems: TemplateRoleItem[] = [];

  for (const [roleId, count] of countRoles(roles, false)) {
    const item = toRoleItem(roleId, count);
    switch (item.faction) {
      case Faction.Wolf:
        wolfItems.push(item);
        break;
      case Faction.God:
        godItems.push(item);
        break;
      case Faction.Villager:
        villagerItems.push(item);
        break;
      case Faction.Special:
        thirdItems.push(item);
        break;
    }
  }

  return { wolfItems, godItems, villagerItems, thirdItems };
};

/** Board picker section of grouped templates */
export interface TemplateSectionData {
  category: TemplateCategory;
  title: string;
  data: PresetTemplate[];
}

/**
 * Group templates by category for display.
 * Order: Classic → Advanced → Special → ThirdParty.
 */
export const groupTemplatesByCategory = (
  templates: readonly PresetTemplate[],
): TemplateSectionData[] => {
  const order: TemplateCategory[] = [
    TemplateCategory.Classic,
    TemplateCategory.Advanced,
    TemplateCategory.Special,
    TemplateCategory.ThirdParty,
  ];

  const grouped = new Map<TemplateCategory, PresetTemplate[]>();
  for (const template of templates) {
    const list = grouped.get(template.category) ?? [];
    list.push(template);
    grouped.set(template.category, list);
  }

  const sections: TemplateSectionData[] = [];
  for (const category of order) {
    const data = grouped.get(category);
    if (data && data.length > 0) {
      sections.push({
        category,
        title: `${TEMPLATE_CATEGORY_LABELS[category]} · ${data.length}`,
        data,
      });
    }
  }

  return sections;
};

/**
 * Filter templates by search query.
 * Matches template name and role displayNames.
 */
export const filterTemplates = (
  templates: readonly PresetTemplate[],
  query: string,
): readonly PresetTemplate[] => {
  if (!query.trim()) return templates;
  const q = query.trim().toLowerCase();

  return templates.filter(
    (template) =>
      template.name.toLowerCase().includes(q) ||
      template.roles.some((roleId) => ROLE_SPECS[roleId].displayName.toLowerCase().includes(q)),
  );
};
