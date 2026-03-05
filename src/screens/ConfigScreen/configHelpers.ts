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
import { findMatchingPresetName } from '@werewolf/game-engine/models/Template';

import type { FactionColorKey } from './components';
import { buildInitialSelection, FACTION_GROUPS } from './configData';

// ─────────────────────────────────────────────────────────────────────────────
// Selection helpers
// ─────────────────────────────────────────────────────────────────────────────

export const getInitialSelection = (): Record<string, boolean> => buildInitialSelection();

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
  [Faction.Special]: 'neutral',
};

/** Compute total selected role count */
export const computeTotalCount = (selection: Record<string, boolean>): number => {
  let total = 0;
  Object.values(selection).forEach((selected) => {
    if (selected) total++;
  });
  return total;
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
