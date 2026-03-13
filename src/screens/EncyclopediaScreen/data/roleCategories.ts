/**
 * roleCategories - 角色图鉴分类元数据
 *
 * 为图鉴页提供功能分组、难度标签等展示层元数据。
 * 纯静态常量，不影响 game-engine 业务逻辑。
 * 分类数据仅用于 EncyclopediaScreen 的 UI 分组和筛选。
 */
import {
  Faction,
  getAllRoleIds,
  getRoleSpec,
  isWolfRole,
  ROLE_SPECS,
  type RoleId,
} from '@werewolf/game-engine/models/roles';
import type { RoleSpec } from '@werewolf/game-engine/models/roles/spec/spec.types';

// ============================================
// Types
// ============================================

/** 阵营筛选 key — 对应 Faction 枚举 + 'all' */
export type FactionFilterKey = 'all' | 'god' | 'villager' | 'wolf' | 'third';

/** 难度级别：1=入门 2=进阶 3=高级 */
type Difficulty = 1 | 2 | 3;

interface FactionTab {
  key: FactionFilterKey;
  label: string;
}

interface RoleCategoryMeta {
  difficulty: Difficulty;
  /** 功能标签（中文），用于 chip 展示 */
  functionTag: string;
  /** 分组 key，用于 section 排序 */
  groupKey: string;
}

interface RoleSection {
  key: string;
  title: string;
  roles: RoleId[];
}

// ============================================
// Constants
// ============================================

export const FACTION_TABS: FactionTab[] = [
  { key: 'all', label: '全部' },
  { key: 'god', label: '神职' },
  { key: 'villager', label: '村民' },
  { key: 'wolf', label: '狼人' },
  { key: 'third', label: '第三方' },
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: '入门',
  2: '进阶',
  3: '高级',
};

// ============================================
// Role Category Metadata
// ============================================

const ROLE_CATEGORY_META: Record<RoleId, RoleCategoryMeta> = {
  // ── Villager ──
  villager: { difficulty: 1, functionTag: '基础', groupKey: 'villager-base' },
  mirrorSeer: { difficulty: 3, functionTag: '查验', groupKey: 'villager-base' },
  drunkSeer: { difficulty: 3, functionTag: '查验', groupKey: 'villager-base' },

  // ── God — 查验类 ──
  seer: { difficulty: 1, functionTag: '查验', groupKey: 'god-investigate' },
  psychic: { difficulty: 2, functionTag: '查验', groupKey: 'god-investigate' },
  dreamcatcher: { difficulty: 3, functionTag: '查验', groupKey: 'god-investigate' },
  pureWhite: { difficulty: 3, functionTag: '查验', groupKey: 'god-investigate' },

  // ── God — 保护类 ──
  guard: { difficulty: 1, functionTag: '保护', groupKey: 'god-protect' },

  // ── God — 输出类 ──
  hunter: { difficulty: 1, functionTag: '输出', groupKey: 'god-offense' },
  knight: { difficulty: 2, functionTag: '输出', groupKey: 'god-offense' },

  // ── God — 控场类 ──
  witch: { difficulty: 1, functionTag: '控场', groupKey: 'god-control' },
  magician: { difficulty: 2, functionTag: '控场', groupKey: 'god-control' },
  silenceElder: { difficulty: 2, functionTag: '控场', groupKey: 'god-control' },
  votebanElder: { difficulty: 2, functionTag: '控场', groupKey: 'god-control' },

  // ── God — 被动类 ──
  idiot: { difficulty: 1, functionTag: '被动', groupKey: 'god-passive' },
  witcher: { difficulty: 3, functionTag: '被动', groupKey: 'god-passive' },
  dancer: { difficulty: 3, functionTag: '被动', groupKey: 'god-passive' },
  graveyardKeeper: { difficulty: 2, functionTag: '被动', groupKey: 'god-passive' },

  // ── Wolf — 基础狼 ──
  wolf: { difficulty: 1, functionTag: '基础', groupKey: 'wolf-basic' },

  // ── Wolf — 功能狼 ──
  wolfQueen: { difficulty: 2, functionTag: '功能', groupKey: 'wolf-functional' },
  wolfKing: { difficulty: 2, functionTag: '功能', groupKey: 'wolf-functional' },
  darkWolfKing: { difficulty: 2, functionTag: '功能', groupKey: 'wolf-functional' },
  wolfWitch: { difficulty: 2, functionTag: '功能', groupKey: 'wolf-functional' },
  nightmare: { difficulty: 2, functionTag: '功能', groupKey: 'wolf-functional' },
  warden: { difficulty: 3, functionTag: '功能', groupKey: 'wolf-functional' },

  // ── Wolf — 特殊狼 ──
  gargoyle: { difficulty: 3, functionTag: '特殊', groupKey: 'wolf-special' },
  awakenedGargoyle: { difficulty: 3, functionTag: '特殊', groupKey: 'wolf-special' },
  bloodMoon: { difficulty: 3, functionTag: '特殊', groupKey: 'wolf-special' },
  wolfRobot: { difficulty: 3, functionTag: '特殊', groupKey: 'wolf-special' },
  spiritKnight: { difficulty: 3, functionTag: '特殊', groupKey: 'wolf-special' },
  masquerade: { difficulty: 3, functionTag: '特殊', groupKey: 'wolf-special' },

  // ── Third-party ──
  slacker: { difficulty: 2, functionTag: '独立', groupKey: 'third-base' },
  wildChild: { difficulty: 2, functionTag: '独立', groupKey: 'third-base' },
  piper: { difficulty: 2, functionTag: '独立', groupKey: 'third-base' },
};

export function getRoleCategoryMeta(roleId: RoleId): RoleCategoryMeta {
  return ROLE_CATEGORY_META[roleId];
}

// ============================================
// Section Definitions — 每个阵营下的功能分组
// ============================================

interface SectionDef {
  key: string;
  title: string;
  /** 对应 groupKey 前缀 */
  groupKeys: string[];
  /** 仅在以下阵营筛选中出现 */
  factions: FactionFilterKey[];
}

const SECTION_DEFS: SectionDef[] = [
  // God sub-groups
  {
    key: 'god-investigate',
    title: '查验类',
    groupKeys: ['god-investigate'],
    factions: ['all', 'god'],
  },
  { key: 'god-protect', title: '保护类', groupKeys: ['god-protect'], factions: ['all', 'god'] },
  { key: 'god-offense', title: '输出类', groupKeys: ['god-offense'], factions: ['all', 'god'] },
  { key: 'god-control', title: '控场类', groupKeys: ['god-control'], factions: ['all', 'god'] },
  { key: 'god-passive', title: '被动类', groupKeys: ['god-passive'], factions: ['all', 'god'] },
  // Villager
  {
    key: 'villager-base',
    title: '村民',
    groupKeys: ['villager-base'],
    factions: ['all', 'villager'],
  },
  // Wolf sub-groups
  { key: 'wolf-basic', title: '基础狼', groupKeys: ['wolf-basic'], factions: ['all', 'wolf'] },
  {
    key: 'wolf-functional',
    title: '功能狼',
    groupKeys: ['wolf-functional'],
    factions: ['all', 'wolf'],
  },
  { key: 'wolf-special', title: '特殊狼', groupKeys: ['wolf-special'], factions: ['all', 'wolf'] },
  // Third-party
  { key: 'third-base', title: '第三方', groupKeys: ['third-base'], factions: ['all', 'third'] },
];

// ============================================
// Filtering & Section Building
// ============================================

function matchesFactionFilter(roleId: RoleId, filter: FactionFilterKey): boolean {
  if (filter === 'all') return true;
  const spec = ROLE_SPECS[roleId];
  if (filter === 'god') return spec.faction === Faction.God;
  if (filter === 'villager') return spec.faction === Faction.Villager;
  if (filter === 'wolf') return spec.faction === Faction.Wolf;
  return spec.faction === Faction.Special;
}

function matchesSearch(roleId: RoleId, query: string): boolean {
  if (!query) return true;
  const spec = getRoleSpec(roleId);
  const lower = query.toLowerCase();
  return (
    spec.displayName.toLowerCase().includes(lower) ||
    spec.shortName.toLowerCase().includes(lower) ||
    spec.description.toLowerCase().includes(lower)
  );
}

/** 构建当前筛选条件下的 section 列表 */
export function buildSections(filter: FactionFilterKey, searchQuery: string): RoleSection[] {
  const allIds = getAllRoleIds();

  // 搜索模式：扁平列表，不分 section
  if (searchQuery) {
    const matched = allIds.filter(
      (id) => matchesFactionFilter(id, filter) && matchesSearch(id, searchQuery),
    );
    if (matched.length === 0) return [];
    return [{ key: 'search-results', title: '', roles: matched }];
  }

  const sections: RoleSection[] = [];
  for (const def of SECTION_DEFS) {
    if (!def.factions.includes(filter)) continue;
    const roles = allIds.filter(
      (id) =>
        matchesFactionFilter(id, filter) && def.groupKeys.includes(ROLE_CATEGORY_META[id].groupKey),
    );
    if (roles.length > 0) {
      sections.push({ key: def.key, title: def.title, roles });
    }
  }
  return sections;
}

/** 从 sections 构建 FlatList 可用的扁平 item 数组 */
export type ListItem =
  | { type: 'sectionHeader'; title: string; key: string }
  | { type: 'roleRow'; roles: readonly [RoleId] | readonly [RoleId, RoleId]; key: string };

export function buildFlatListData(sections: RoleSection[]): ListItem[] {
  const items: ListItem[] = [];
  for (const section of sections) {
    if (section.title) {
      items.push({ type: 'sectionHeader', title: section.title, key: `h-${section.key}` });
    }
    // 两两分组
    for (let i = 0; i < section.roles.length; i += 2) {
      const pair =
        i + 1 < section.roles.length
          ? ([section.roles[i], section.roles[i + 1]] as const)
          : ([section.roles[i]] as const);
      items.push({ type: 'roleRow', roles: pair, key: `r-${pair[0]}` });
    }
  }
  return items;
}

/** 从 sections 中提取扁平角色 ID 列表（用于详情左右导航） */
export function flatRoleIdsFromSections(sections: RoleSection[]): RoleId[] {
  return sections.flatMap((s) => s.roles);
}

/** 获取角色的阵营色 token key */
export function getFactionColorKey(roleId: RoleId): 'wolf' | 'god' | 'villager' | 'third' {
  if (isWolfRole(roleId)) return 'wolf';
  const spec = getRoleSpec(roleId);
  if (spec?.faction === Faction.God) return 'god';
  if (spec?.faction === Faction.Special) return 'third';
  return 'villager';
}

/** 获取行动时机标签 */
export function getActionTiming(roleId: RoleId): string {
  const spec = getRoleSpec(roleId);
  if (spec.night1.hasAction) return '夜晚行动';
  // 检查白天技能角色
  const dayActionRoles: RoleId[] = ['knight', 'wolfKing', 'darkWolfKing', 'idiot', 'bloodMoon'];
  if (dayActionRoles.includes(roleId)) return '白天行动';
  return '被动技能';
}

/** 获取角色 flags 的可视化标签列表 */
export function getFlagLabels(roleId: RoleId): string[] {
  const spec = getRoleSpec(roleId) as RoleSpec;
  const labels: string[] = [];
  if (spec.flags?.immuneToWolfKill) labels.push('🛡️ 免疫狼刀');
  if (spec.flags?.immuneToPoison) labels.push('🧪 免疫毒杀');
  if (spec.flags?.reflectsDamage) labels.push('↩️ 反弹伤害');
  return labels;
}

/** 获取关联角色列表 */
export function getRelatedRoles(roleId: RoleId): Array<{ id: RoleId; reason: string }> {
  const related: Array<{ id: RoleId; reason: string }> = [];
  const spec = getRoleSpec(roleId) as RoleSpec;

  // displayAs 关联
  if (spec.displayAs) {
    related.push({ id: spec.displayAs as unknown as RoleId, reason: '伪装为' });
  }

  // 相同功能对比
  const meta = ROLE_CATEGORY_META[roleId];
  const allIds = getAllRoleIds();
  for (const otherId of allIds) {
    if (otherId === roleId) continue;
    const otherMeta = ROLE_CATEGORY_META[otherId];
    // 同一 groupKey 的角色互相关联
    if (otherMeta.groupKey === meta.groupKey && related.length < 4) {
      related.push({ id: otherId, reason: '同类角色' });
    }
  }

  return related.slice(0, 4);
}
