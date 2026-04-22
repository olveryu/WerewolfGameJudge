/**
 * useEncyclopediaScreenState — EncyclopediaScreen 的状态 hook
 *
 * 阵营/标签筛选、搜索、角色详情面板、section 构建。
 */
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import {
  Faction,
  getAllRoleIds,
  isValidRoleId,
  ROLE_SPECS,
  type RoleAbilityTag,
  type RoleId,
} from '@werewolf/game-engine/models/roles';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { RootStackParamList } from '@/navigation/types';

import { FACTION_SECTIONS } from './constants';

// ── Types ───────────────────────────────────────────────────────────────────

export type FactionFilterKey = 'all' | 'god' | 'wolf' | 'villager' | 'third';

interface FactionTab {
  key: Exclude<FactionFilterKey, 'all'>;
  label: string;
}

export const FACTION_TABS: readonly FactionTab[] = [
  { key: 'god', label: '神职' },
  { key: 'wolf', label: '狼人' },
  { key: 'villager', label: '村民' },
  { key: 'third', label: '第三方' },
] as const;

const FACTION_KEY_MAP: Record<Exclude<FactionFilterKey, 'all'>, Faction> = {
  god: Faction.God,
  wolf: Faction.Wolf,
  villager: Faction.Villager,
  third: Faction.Special,
};

export interface RoleSection {
  title: string;
  colorKey: string;
  data: [RoleId, RoleId | null][];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function matchesFaction(roleId: RoleId, filter: FactionFilterKey): boolean {
  if (filter === 'all') return true;
  return ROLE_SPECS[roleId].faction === FACTION_KEY_MAP[filter];
}

function matchesTag(roleId: RoleId, tag: RoleAbilityTag | null): boolean {
  if (tag === null) return true;
  return ROLE_SPECS[roleId].tags?.some((t) => t === tag) ?? false;
}

function matchesSearch(roleId: RoleId, query: string): boolean {
  if (query === '') return true;
  const spec = ROLE_SPECS[roleId];
  const haystack = `${spec.displayName}${spec.shortName}${spec.description}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/** Chunk a flat array into pairs for 2-column grid */
function toPairs(ids: RoleId[]): [RoleId, RoleId | null][] {
  const pairs: [RoleId, RoleId | null][] = [];
  for (let i = 0; i < ids.length; i += 2) {
    pairs.push([ids[i], ids[i + 1] ?? null]);
  }
  return pairs;
}

function buildSections(
  allRoleIds: RoleId[],
  filter: FactionFilterKey,
  tag: RoleAbilityTag | null,
  search: string,
): RoleSection[] {
  const filtered = allRoleIds
    .filter((id) => matchesFaction(id, filter))
    .filter((id) => matchesTag(id, tag))
    .filter((id) => matchesSearch(id, search));

  if (filter !== 'all') {
    const config = FACTION_SECTIONS.find((c) => c.faction === FACTION_KEY_MAP[filter])!;
    return filtered.length > 0
      ? [
          {
            title: `${config.label} · ${filtered.length}`,
            colorKey: config.colorKey,
            data: toPairs(filtered),
          },
        ]
      : [];
  }

  return FACTION_SECTIONS.map((config) => {
    const roles = filtered.filter((id) => ROLE_SPECS[id].faction === config.faction);
    return {
      title: `${config.label} · ${roles.length}`,
      colorKey: config.colorKey,
      data: toPairs(roles),
    };
  }).filter((s) => s.data.length > 0);
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useEncyclopediaScreenState() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Encyclopedia'>>();
  const [activeFilter, setActiveFilter] = useState<FactionFilterKey>('all');
  const [activeTag, setActiveTag] = useState<RoleAbilityTag | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [tagDropdownVisible, setTagDropdownVisible] = useState(false);

  // Auto-open role detail if navigated with roleId param
  useEffect(() => {
    const roleId = route.params?.roleId;
    if (roleId && isValidRoleId(roleId)) {
      setSelectedRole(roleId);
    }
  }, [route.params?.roleId]);

  const allRoleIds = useMemo(() => getAllRoleIds(), []);

  const isSearching = searchQuery.length > 0;

  const sections = useMemo(
    () =>
      buildSections(
        allRoleIds,
        isSearching ? 'all' : activeFilter,
        isSearching ? null : activeTag,
        searchQuery,
      ),
    [allRoleIds, activeFilter, activeTag, searchQuery, isSearching],
  );

  const totalCount = useMemo(
    () =>
      sections.reduce((sum, s) => sum + s.data.reduce((n, pair) => n + (pair[1] ? 2 : 1), 0), 0),
    [sections],
  );

  const handleRolePress = useCallback((roleId: RoleId) => {
    setSelectedRole(roleId);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedRole(null);
  }, []);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home' as never);
    }
  }, [navigation]);

  const handleFactionChange = useCallback((key: Exclude<FactionFilterKey, 'all'>) => {
    setActiveFilter((prev) => (prev === key ? 'all' : key));
    setActiveTag(null);
  }, []);

  const handleTagPress = useCallback((tag: RoleAbilityTag) => {
    setActiveTag((prev) => (prev === tag ? null : tag));
    setTagDropdownVisible(false);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchVisible((prev) => {
      if (prev) setSearchQuery('');
      return !prev;
    });
  }, []);

  const getTabCount = useCallback(
    (key: Exclude<FactionFilterKey, 'all'>) =>
      allRoleIds.filter((id) => matchesFaction(id, key)).length,
    [allRoleIds],
  );

  const getTagCount = useCallback(
    (tag: RoleAbilityTag) =>
      allRoleIds
        .filter((id) => matchesFaction(id, activeFilter))
        .filter((id) => matchesTag(id, tag))
        .filter((id) => matchesSearch(id, searchQuery)).length,
    [allRoleIds, activeFilter, searchQuery],
  );

  return {
    // State
    activeFilter,
    activeTag,
    setActiveTag,
    searchQuery,
    setSearchQuery,
    searchVisible,
    selectedRole,
    tagDropdownVisible,
    setTagDropdownVisible,
    // Computed
    sections,
    totalCount,
    // Handlers
    handleRolePress,
    handleCloseDetail,
    handleGoBack,
    handleFactionChange,
    handleTagPress,
    toggleSearch,
    getTabCount,
    getTagCount,
  };
}
