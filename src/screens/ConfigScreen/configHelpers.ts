/**
 * configHelpers — Pure helper functions for ConfigScreen
 *
 * Module-level data transformations used by useConfigScreenState.
 * No React dependencies — pure functions and static data only.
 */

import {
  Faction,
  isValidRoleId,
  ROLE_SPECS,
  type RoleId,
} from '@werewolf/game-engine/models/roles';
import {
  findMatchingPresetName,
  getPlayerCount,
  type PresetTemplate,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
} from '@werewolf/game-engine/models/Template';

import type { FactionColorKey } from './components';
import { buildInitialSelection, FACTION_GROUPS } from './configData';

// ─────────────────────────────────────────────────────────────────────────────
// Selection helpers
// ─────────────────────────────────────────────────────────────────────────────

export const getInitialSelection = (): Record<string, boolean> => buildInitialSelection();

/** All roles off — used when entering ConfigScreen via "从零开始自定义". */
export const getEmptySelection = (): Record<string, boolean> => buildInitialSelection([]);

export const selectionToRoles = (
  selection: Record<string, boolean>,
  variantOverrides?: Record<string, string>,
): RoleId[] => {
  const roles: RoleId[] = [];
  Object.entries(selection).forEach(([key, selected]) => {
    if (selected) {
      const baseRoleId = key.replace(/\d+$/, '');
      const roleId = variantOverrides?.[baseRoleId] ?? baseRoleId;
      if (isValidRoleId(roleId)) {
        roles.push(roleId);
      }
    }
  });
  return roles;
};

// ─────────────────────────────────────────────────────────────────────────────
// Variant reverse lookup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reverse lookup: variantId → base slot roleId.
 * Built once from FACTION_GROUPS at module level.
 */
const VARIANT_TO_BASE: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const group of FACTION_GROUPS) {
    for (const section of group.sections) {
      for (const slot of section.roles) {
        if (slot.variants) {
          for (const v of slot.variants) {
            map.set(v, slot.roleId);
          }
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
  templateRoles: RoleId[],
): {
  selection: Record<string, boolean>;
  variantOverrides: Record<string, string>;
  matchedPreset: string | undefined;
} => {
  const selection = getInitialSelection();
  Object.keys(selection).forEach((key) => {
    selection[key] = false;
  });
  const overrides: Record<string, string> = {};
  const baseCounts: Record<string, number> = {};
  templateRoles.forEach((role) => {
    const baseId = VARIANT_TO_BASE.get(role) ?? role;
    if (VARIANT_TO_BASE.has(role)) {
      overrides[baseId] = role;
    }
    baseCounts[baseId] = (baseCounts[baseId] || 0) + 1;
  });
  Object.entries(baseCounts).forEach(([baseRole, count]) => {
    for (let i = 0; i < count; i++) {
      const key = i === 0 ? baseRole : `${baseRole}${i}`;
      if (key in selection) selection[key] = true;
    }
  });
  const matchedPreset = findMatchingPresetName(templateRoles) ?? undefined;
  return { selection, variantOverrides: overrides, matchedPreset };
};

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Map Faction enum to FactionColorKey for chip coloring */
export const FACTION_COLOR_MAP: Record<string, FactionColorKey> = {
  [Faction.Wolf]: 'wolf',
  [Faction.God]: 'god',
  [Faction.Villager]: 'villager',
  [Faction.Special]: 'third',
};

/** Compute total player count (accounts for treasureMaster bottom cards) */
export const computeTotalCount = (
  selection: Record<string, boolean>,
  variantOverrides?: Record<string, string>,
): number => {
  const roles = selectionToRoles(selection, variantOverrides);
  return getPlayerCount(roles);
};

/** Expand a RoleSlot into an array of {key, label} for rendering chips */
export const expandSlotToChipEntries = (
  slot: {
    roleId: string;
    count?: number;
    variants?: string[];
  },
  variantOverrides?: Record<string, string>,
): { key: string; label: string; hasVariants: boolean }[] => {
  const count = slot.count ?? 1;
  const activeRoleId = variantOverrides?.[slot.roleId] ?? slot.roleId;
  const spec = isValidRoleId(activeRoleId) ? ROLE_SPECS[activeRoleId] : undefined;
  const label = spec?.displayName ?? activeRoleId;
  const hasVariants = !!slot.variants && slot.variants.length > 0;

  return Array.from({ length: count }, (_, i) => ({
    key: i === 0 ? slot.roleId : `${slot.roleId}${i}`,
    label,
    hasVariants,
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// Template picker helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Faction statistics for a template */
export interface FactionStats {
  wolfCount: number;
  godCount: number;
  villagerCount: number;
  thirdCount: number;
}

/** Role display item (roleId + displayName + count) */
export interface TemplateRoleItem {
  roleId: string;
  displayName: string;
  count: number;
  faction: Faction;
}

/** Compute faction statistics from a roles array */
export const computeFactionStats = (roles: RoleId[]): FactionStats => {
  let wolfCount = 0;
  let godCount = 0;
  let villagerCount = 0;
  let thirdCount = 0;

  for (const roleId of roles) {
    if (!isValidRoleId(roleId)) continue;
    const spec = ROLE_SPECS[roleId];
    switch (spec.faction) {
      case Faction.Wolf:
        wolfCount++;
        break;
      case Faction.God:
        godCount++;
        break;
      case Faction.Villager:
        villagerCount++;
        break;
      case Faction.Special:
        thirdCount++;
        break;
    }
  }

  return { wolfCount, godCount, villagerCount, thirdCount };
};

/**
 * Get "key roles" — non-generic roles that distinguish this template.
 * Excludes plain 'wolf' and 'villager'. Returns up to `max` unique display items.
 */
export const getKeyRoles = (roles: RoleId[], max: number = 3): TemplateRoleItem[] => {
  const countMap = new Map<string, number>();
  for (const roleId of roles) {
    if (roleId === 'wolf' || roleId === 'villager') continue;
    countMap.set(roleId, (countMap.get(roleId) ?? 0) + 1);
  }

  const items: TemplateRoleItem[] = [];
  for (const [roleId, count] of countMap) {
    if (!isValidRoleId(roleId)) continue;
    const spec = ROLE_SPECS[roleId];
    items.push({
      roleId,
      displayName: spec.displayName,
      count,
      faction: spec.faction,
    });
  }

  // Prioritize distinctive roles: third-party > wolf variants > god > villager
  const FACTION_PRIORITY: Record<string, number> = {
    [Faction.Special]: 0,
    [Faction.Wolf]: 1,
    [Faction.God]: 2,
    [Faction.Villager]: 3,
  };
  items.sort((a, b) => (FACTION_PRIORITY[a.faction] ?? 3) - (FACTION_PRIORITY[b.faction] ?? 3));

  return items.slice(0, max);
};

/**
 * Collect all distinctive roles across ALL preset templates.
 * Excludes generic 'wolf' and 'villager'. De-duplicated, sorted by faction
 * priority (third > wolf variants > god). Computed once at module level.
 */
export const getDistinctiveRoles = (templates: PresetTemplate[]): TemplateRoleItem[] => {
  const seen = new Set<string>();
  const items: TemplateRoleItem[] = [];

  for (const t of templates) {
    for (const roleId of t.roles) {
      if (roleId === 'wolf' || roleId === 'villager') continue;
      if (seen.has(roleId)) continue;
      seen.add(roleId);
      if (!isValidRoleId(roleId)) continue;
      const spec = ROLE_SPECS[roleId];
      items.push({ roleId, displayName: spec.displayName, count: 1, faction: spec.faction });
    }
  }

  const FACTION_PRIORITY: Record<string, number> = {
    [Faction.Special]: 0,
    [Faction.Wolf]: 1,
    [Faction.God]: 2,
    [Faction.Villager]: 3,
  };
  items.sort((a, b) => (FACTION_PRIORITY[a.faction] ?? 3) - (FACTION_PRIORITY[b.faction] ?? 3));

  return items;
};

/**
 * Group roles by faction for detailed display.
 * Returns four arrays: wolf, god, villager, third.
 */
export const groupRolesByFaction = (
  roles: RoleId[],
): {
  wolfItems: TemplateRoleItem[];
  godItems: TemplateRoleItem[];
  villagerItems: TemplateRoleItem[];
  thirdItems: TemplateRoleItem[];
} => {
  const countMap = new Map<string, number>();
  for (const roleId of roles) {
    countMap.set(roleId, (countMap.get(roleId) ?? 0) + 1);
  }

  const wolfItems: TemplateRoleItem[] = [];
  const godItems: TemplateRoleItem[] = [];
  const villagerItems: TemplateRoleItem[] = [];
  const thirdItems: TemplateRoleItem[] = [];

  for (const [roleId, count] of countMap) {
    if (!isValidRoleId(roleId)) continue;
    const spec = ROLE_SPECS[roleId];
    const item: TemplateRoleItem = {
      roleId,
      displayName: spec.displayName,
      count,
      faction: spec.faction,
    };

    switch (spec.faction) {
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

/** SectionList section for grouped templates */
export interface TemplateSectionData {
  category: TemplateCategory;
  title: string;
  data: PresetTemplate[];
}

/**
 * Group templates by category for SectionList display.
 * Order: Classic → Advanced → Special → ThirdParty.
 */
export const groupTemplatesByCategory = (templates: PresetTemplate[]): TemplateSectionData[] => {
  const order: TemplateCategory[] = [
    TemplateCategory.Classic,
    TemplateCategory.Advanced,
    TemplateCategory.Special,
    TemplateCategory.ThirdParty,
  ];

  const grouped = new Map<TemplateCategory, PresetTemplate[]>();
  for (const t of templates) {
    const list = grouped.get(t.category) ?? [];
    list.push(t);
    grouped.set(t.category, list);
  }

  const sections: TemplateSectionData[] = [];
  for (const cat of order) {
    const data = grouped.get(cat);
    if (data && data.length > 0) {
      sections.push({
        category: cat,
        title: `${TEMPLATE_CATEGORY_LABELS[cat]} · ${data.length}`,
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
export const filterTemplates = (templates: PresetTemplate[], query: string): PresetTemplate[] => {
  if (!query.trim()) return templates;
  const q = query.trim().toLowerCase();

  return templates.filter((t) => {
    // Match template name
    if (t.name.toLowerCase().includes(q)) return true;
    // Match role displayNames
    for (const roleId of t.roles) {
      if (!isValidRoleId(roleId)) continue;
      const spec = ROLE_SPECS[roleId];
      if (spec.displayName.toLowerCase().includes(q)) return true;
    }
    return false;
  });
};
