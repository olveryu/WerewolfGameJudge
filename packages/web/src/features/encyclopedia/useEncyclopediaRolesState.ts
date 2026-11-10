/**
 * Shared encyclopedia "roles" segment state: faction filter, ability tag filter, search, the
 * selected role detail and the grouped sections. The data comes from the game's injected
 * `EncyclopediaRoleSource`; filters and search read only entry fields.
 */
import { useState } from 'react';

import type {
  EncyclopediaFactionColorKey,
  EncyclopediaRoleEntry,
  EncyclopediaRoleSource,
} from './encyclopediaSource';

/** Faction filter: `'all'` or one `factionGroups` key. */
type EncyclopediaFactionFilterKey = string;

/** One faction section of the role grid. */
export interface EncyclopediaRoleSection {
  readonly key: string;
  readonly title: string;
  readonly colorKey: EncyclopediaFactionColorKey;
  readonly entries: readonly EncyclopediaRoleEntry[];
}

function matchesFaction(entry: EncyclopediaRoleEntry, filter: EncyclopediaFactionFilterKey) {
  if (filter === 'all') return true;
  return entry.factionKey === filter;
}

function matchesTag(entry: EncyclopediaRoleEntry, tagKey: string | null) {
  if (tagKey === null) return true;
  return entry.tags?.some((tag) => tag.key === tagKey) ?? false;
}

function matchesSearch(entry: EncyclopediaRoleEntry, query: string) {
  if (query === '') return true;
  return entry.searchText.toLowerCase().includes(query.toLowerCase());
}

function buildSections(
  source: EncyclopediaRoleSource,
  filter: EncyclopediaFactionFilterKey,
  tagKey: string | null,
  search: string,
): EncyclopediaRoleSection[] {
  const filtered = source.roles.filter(
    (entry) =>
      matchesFaction(entry, filter) && matchesTag(entry, tagKey) && matchesSearch(entry, search),
  );

  if (filter !== 'all') {
    const group = source.factionGroups.find((candidate) => candidate.key === filter);
    if (!group) throw new Error(`[Encyclopedia] Unknown faction group: ${filter}`);
    return filtered.length > 0
      ? [
          {
            key: group.key,
            title: `${group.label} · ${filtered.length}`,
            colorKey: group.colorKey,
            entries: filtered,
          },
        ]
      : [];
  }

  return source.factionGroups
    .map((group) => {
      const entries = filtered.filter((entry) => entry.factionKey === group.key);
      return {
        key: group.key,
        title: `${group.label} · ${entries.length}`,
        colorKey: group.colorKey,
        entries,
      };
    })
    .filter((section) => section.entries.length > 0);
}

/** Roles segment state; `initialRoleId` (a deep link) opens that role's detail. */
export function useEncyclopediaRolesState(source: EncyclopediaRoleSource, initialRoleId?: string) {
  const [activeFilter, setActiveFilter] = useState<EncyclopediaFactionFilterKey>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(initialRoleId ?? null);
  const [tagDropdownVisible, setTagDropdownVisible] = useState(false);
  const [deepLinkedRoleId, setDeepLinkedRoleId] = useState(initialRoleId);

  if (deepLinkedRoleId !== initialRoleId) {
    setDeepLinkedRoleId(initialRoleId);
    setSelectedRoleId(initialRoleId ?? null);
  }

  const isSearching = searchQuery.length > 0;
  const sections = buildSections(
    source,
    isSearching ? 'all' : activeFilter,
    isSearching ? null : activeTag,
    searchQuery,
  );
  const totalCount = sections.reduce((sum, section) => sum + section.entries.length, 0);

  return {
    activeFilter,
    activeTag,
    setActiveTag,
    searchQuery,
    setSearchQuery,
    searchVisible,
    selectedRoleId,
    tagDropdownVisible,
    setTagDropdownVisible,
    sections,
    totalCount,
    handleRolePress: setSelectedRoleId,
    handleCloseDetail: () => setSelectedRoleId(null),
    handleFactionChange: (key: string) => {
      setActiveFilter((previous) => (previous === key ? 'all' : key));
      setActiveTag(null);
    },
    handleTagPress: (tagKey: string) => {
      setActiveTag((previous) => (previous === tagKey ? null : tagKey));
      setTagDropdownVisible(false);
    },
    toggleSearch: () => {
      if (searchVisible) setSearchQuery('');
      setSearchVisible(!searchVisible);
    },
    getTabCount: (key: string) => source.roles.filter((entry) => matchesFaction(entry, key)).length,
    getTagCount: (tagKey: string) =>
      source.roles.filter(
        (entry) =>
          matchesFaction(entry, activeFilter) &&
          matchesTag(entry, tagKey) &&
          matchesSearch(entry, searchQuery),
      ).length,
  };
}

export type EncyclopediaRolesState = ReturnType<typeof useEncyclopediaRolesState>;
