/**
 * ConfigScreen data-driven role layout
 *
 * Single source of truth for the ConfigScreen role selection UI.
 * Labels are derived from ROLE_SPECS.displayName at render time.
 *
 * Design:
 * - FactionGroup → Section[] → RoleSlot[]
 * - RoleSlot with `count` > 1 generates multiple selection keys (e.g. wolf, wolf1, wolf2...)
 * - RoleSlot with `count` = 1 (default) generates a single key matching the roleId
 */
import { Faction } from '@werewolf/game-engine/models/roles/spec/types';

// ============================================
// Types
// ============================================

interface RoleSlot {
  /** The base roleId (matches ROLE_SPECS key) */
  roleId: string;
  /**
   * How many selectable copies of this role.
   * Generates keys: roleId, roleId1, roleId2, ... roleId(count-1)
   * @default 1
   */
  count?: number;
  /**
   * If true, this slot uses a stepper ([-][+]) instead of individual chips.
   * Typically used for generic roles like 普通狼人/普通村民.
   * @default false
   */
  isBulk?: boolean;
}

interface RoleSection {
  title: string;
  roles: RoleSlot[];
}

interface FactionGroup {
  title: string;
  /** Ionicons icon name for the faction tab */
  iconName: string;
  faction: Faction;
  sections: RoleSection[];
}

// ============================================
// Data
// ============================================

export const FACTION_GROUPS: FactionGroup[] = [
  {
    title: '好人阵营',
    iconName: 'shield-outline',
    faction: Faction.Villager, // covers both Villager & God faction visually
    sections: [
      {
        title: '普通村民',
        roles: [{ roleId: 'villager', count: 5, isBulk: true }],
      },
      {
        title: '神职',
        roles: [
          { roleId: 'seer' },
          { roleId: 'witch' },
          { roleId: 'hunter' },
          { roleId: 'guard' },
          { roleId: 'idiot' },
          { roleId: 'graveyardKeeper' },
          { roleId: 'knight' },
          { roleId: 'dreamcatcher' },
          { roleId: 'magician' },
          { roleId: 'witcher' },
          { roleId: 'psychic' },
        ],
      },
    ],
  },
  {
    title: '狼人阵营',
    iconName: 'paw-outline',
    faction: Faction.Wolf,
    sections: [
      {
        title: '普通狼人',
        roles: [{ roleId: 'wolf', count: 5, isBulk: true }],
      },
      {
        title: '技能狼',
        roles: [
          { roleId: 'wolfQueen' },
          { roleId: 'wolfKing' },
          { roleId: 'darkWolfKing' },
          { roleId: 'gargoyle' },
          { roleId: 'nightmare' },
          { roleId: 'bloodMoon' },
          { roleId: 'wolfRobot' },
          { roleId: 'spiritKnight' },
        ],
      },
    ],
  },
  {
    title: '中立阵营',
    iconName: 'git-compare-outline',
    faction: Faction.Special,
    sections: [
      {
        title: '第三方',
        roles: [{ roleId: 'slacker' }],
      },
    ],
  },
];

// ============================================
// Helpers
// ============================================

/**
 * Generate all selection keys from FACTION_GROUPS.
 * Key format: roleId (first slot), roleId1 (second), roleId2 (third), ...
 */
function getAllSelectionKeys(): string[] {
  const keys: string[] = [];
  for (const group of FACTION_GROUPS) {
    for (const section of group.sections) {
      for (const slot of section.roles) {
        const count = slot.count ?? 1;
        for (let i = 0; i < count; i++) {
          keys.push(i === 0 ? slot.roleId : `${slot.roleId}${i}`);
        }
      }
    }
  }
  return keys;
}

/**
 * Build the initial selection map with specified defaults.
 * All keys are false by default unless listed in `defaultOn`.
 */
export function buildInitialSelection(
  defaultOn: string[] = [
    'wolf',
    'wolf1',
    'wolf2',
    'wolf3',
    'villager',
    'villager1',
    'villager2',
    'villager3',
    'seer',
    'witch',
    'hunter',
    'idiot',
  ],
): Record<string, boolean> {
  const keys = getAllSelectionKeys();
  const selection: Record<string, boolean> = {};
  const onSet = new Set(defaultOn);
  for (const key of keys) {
    selection[key] = onSet.has(key);
  }
  return selection;
}
