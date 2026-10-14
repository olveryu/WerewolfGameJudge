/**
 * useEncyclopediaRolesState — 共享图鉴「角色」段状态机。
 *
 * 阵营筛选、能力标签筛选、搜索、角色详情选择与分组分段的构建；
 * 自狼人杀 useEncyclopediaScreenState 泛化：数据源从引擎 spec
 * 改为注入的 EncyclopediaRoleSource，筛选/搜索只读条目字段。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { EncyclopediaRoleEntry, EncyclopediaRoleSource } from './encyclopediaSource';

/** 阵营筛选键：'all' 或某个 factionGroups 的 key。 */
export type EncyclopediaFactionFilterKey = string;

/** 角色分组（SectionList 数据源）：双列配对。 */
export interface EncyclopediaRoleSection {
  readonly title: string;
  readonly colorKey: EncyclopediaRoleEntry['factionColorKey'];
  readonly data: [EncyclopediaRoleEntry, EncyclopediaRoleEntry | null][];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function matchesFaction(entry: EncyclopediaRoleEntry, filter: EncyclopediaFactionFilterKey) {
  if (filter === 'all') return true;
  return entry.factionKey === filter;
}

function matchesTag(entry: EncyclopediaRoleEntry, tagKey: string | null) {
  if (tagKey === null) return true;
  return entry.tags?.some((t) => t.key === tagKey) ?? false;
}

function matchesSearch(entry: EncyclopediaRoleEntry, query: string) {
  if (query === '') return true;
  return entry.searchText.toLowerCase().includes(query.toLowerCase());
}

/** Chunk a flat array into pairs for 2-column grid */
function toPairs(
  entries: EncyclopediaRoleEntry[],
): [EncyclopediaRoleEntry, EncyclopediaRoleEntry | null][] {
  const pairs: [EncyclopediaRoleEntry, EncyclopediaRoleEntry | null][] = [];
  for (let i = 0; i < entries.length; i += 2) {
    pairs.push([entries[i]!, entries[i + 1] ?? null]);
  }
  return pairs;
}

function buildSections(
  source: EncyclopediaRoleSource,
  filter: EncyclopediaFactionFilterKey,
  tagKey: string | null,
  search: string,
): EncyclopediaRoleSection[] {
  const filtered = source.roles
    .filter((entry) => matchesFaction(entry, filter))
    .filter((entry) => matchesTag(entry, tagKey))
    .filter((entry) => matchesSearch(entry, search));

  if (filter !== 'all') {
    const group = source.factionGroups.find((g) => g.key === filter);
    if (!group) throw new Error(`[Encyclopedia] Unknown faction group: ${filter}`);
    return filtered.length > 0
      ? [
          {
            title: `${group.label} · ${filtered.length}`,
            colorKey: group.colorKey,
            data: toPairs(filtered),
          },
        ]
      : [];
  }

  return source.factionGroups
    .map((group) => {
      const roles = filtered.filter((entry) => entry.factionKey === group.key);
      return {
        title: `${group.label} · ${roles.length}`,
        colorKey: group.colorKey,
        data: toPairs(roles),
      };
    })
    .filter((s) => s.data.length > 0);
}

// ── Hook ────────────────────────────────────────────────────────────────────

/** 图鉴角色段状态 hook；initialRoleId 用于深链直达详情。 */
export function useEncyclopediaRolesState(source: EncyclopediaRoleSource, initialRoleId?: string) {
  const [activeFilter, setActiveFilter] = useState<EncyclopediaFactionFilterKey>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [tagDropdownVisible, setTagDropdownVisible] = useState(false);

  // Auto-open role detail if navigated with roleId param
  useEffect(() => {
    setSelectedRoleId(initialRoleId ?? null);
  }, [initialRoleId]);

  const isSearching = searchQuery.length > 0;

  const sections = useMemo(
    () =>
      buildSections(
        source,
        isSearching ? 'all' : activeFilter,
        isSearching ? null : activeTag,
        searchQuery,
      ),
    [source, activeFilter, activeTag, searchQuery, isSearching],
  );

  const totalCount = useMemo(
    () =>
      sections.reduce((sum, s) => sum + s.data.reduce((n, pair) => n + (pair[1] ? 2 : 1), 0), 0),
    [sections],
  );

  const handleRolePress = useCallback((roleId: string) => {
    setSelectedRoleId(roleId);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedRoleId(null);
  }, []);

  const handleFactionChange = useCallback((key: string) => {
    setActiveFilter((prev) => (prev === key ? 'all' : key));
    setActiveTag(null);
  }, []);

  const handleTagPress = useCallback((tagKey: string) => {
    setActiveTag((prev) => (prev === tagKey ? null : tagKey));
    setTagDropdownVisible(false);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchVisible((prev) => {
      if (prev) setSearchQuery('');
      return !prev;
    });
  }, []);

  const getTabCount = useCallback(
    (key: string) => source.roles.filter((entry) => matchesFaction(entry, key)).length,
    [source],
  );

  const getTagCount = useCallback(
    (tagKey: string) =>
      source.roles
        .filter((entry) => matchesFaction(entry, activeFilter))
        .filter((entry) => matchesTag(entry, tagKey))
        .filter((entry) => matchesSearch(entry, searchQuery)).length,
    [source, activeFilter, searchQuery],
  );

  return {
    // State
    activeFilter,
    activeTag,
    setActiveTag,
    searchQuery,
    setSearchQuery,
    searchVisible,
    selectedRoleId,
    tagDropdownVisible,
    setTagDropdownVisible,
    // Computed
    sections,
    totalCount,
    // Handlers
    handleRolePress,
    handleCloseDetail,
    handleFactionChange,
    handleTagPress,
    toggleSearch,
    getTabCount,
    getTagCount,
  };
}

export type EncyclopediaRolesState = ReturnType<typeof useEncyclopediaRolesState>;
