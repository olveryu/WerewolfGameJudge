/**
 * useBoardPickerScreenState — state hook for BoardPickerScreen
 *
 * Search / category / role filter / expand-collapse. Navigation belongs to the config flow.
 */
import {
  Faction,
  PRESET_TEMPLATES,
  type RoleId,
  TemplateCategory,
} from '@game-judge/game-engine/games/werewolf/public';
import { useState } from 'react';

import {
  FACTION_COLOR_MAP,
  type FactionColorKey,
  filterTemplates,
  getDistinctiveRoles,
  groupTemplatesByCategory,
} from '@/games/werewolf/screens/ConfigScreen/configHelpers';

const FILTER_FACTIONS: readonly { readonly key: Faction; readonly label: string }[] = [
  { key: Faction.Wolf, label: '狼人' },
  { key: Faction.God, label: '神职' },
  { key: Faction.Villager, label: '村民' },
  { key: Faction.Special, label: '第三方' },
];

interface FilterGroup {
  readonly label: string;
  readonly faction: FactionColorKey;
  readonly items: ReturnType<typeof getDistinctiveRoles>;
}

/** Role filter chips: every distinctive preset role, grouped by faction. */
const FILTER_GROUPS: readonly FilterGroup[] = (() => {
  const distinctiveRoles = getDistinctiveRoles(PRESET_TEMPLATES);
  return FILTER_FACTIONS.flatMap(({ key, label }) => {
    const items = distinctiveRoles.filter((role) => role.faction === key);
    return items.length > 0 ? [{ label, faction: FACTION_COLOR_MAP[key], items }] : [];
  });
})();

function toggleSetMember<T>(set: ReadonlySet<T>, member: T): ReadonlySet<T> {
  const next = new Set(set);
  if (next.has(member)) next.delete(member);
  else next.add(member);
  return next;
}

/** Board picker screen state hook. */
export function useBoardPickerScreenState() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | null>(
    TemplateCategory.Classic,
  );
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<ReadonlySet<RoleId>>(new Set());
  const [expandedFactions, setExpandedFactions] = useState<ReadonlySet<string>>(new Set());

  // ── Data pipeline ──
  const filtered = filterTemplates(PRESET_TEMPLATES, searchQuery);
  const roleFiltered =
    selectedRoleIds.size === 0
      ? filtered
      : filtered.filter((template) => {
          const roleSet = new Set<RoleId>(template.roles);
          return [...selectedRoleIds].every((roleId) => roleSet.has(roleId));
        });
  const allSections = groupTemplatesByCategory(roleFiltered);
  const categoryCounts = new Map<TemplateCategory, number>(
    allSections.map((section) => [section.category, section.data.length]),
  );
  const sections =
    activeCategory === null
      ? allSections
      : allSections.filter((section) => section.category === activeCategory);

  return {
    // State
    searchQuery,
    setSearchQuery,
    searchVisible,
    activeCategory,
    expandedName,
    filterVisible,
    selectedRoleIds,
    expandedFactions,
    // Computed
    filterGroups: FILTER_GROUPS,
    categoryCounts,
    sections,
    // Handlers
    toggleSearch: () => {
      if (searchVisible) setSearchQuery('');
      setSearchVisible(!searchVisible);
    },
    handleClearSearch: () => setSearchQuery(''),
    handleTabPress: (category: TemplateCategory) =>
      setActiveCategory((prev) => (prev === category ? null : category)),
    handleToggleExpand: (name: string) => setExpandedName((prev) => (prev === name ? null : name)),
    toggleFilter: () => setFilterVisible((prev) => !prev),
    handleToggleRole: (roleId: RoleId) =>
      setSelectedRoleIds((prev) => toggleSetMember(prev, roleId)),
    handleClearFilter: () => setSelectedRoleIds(new Set()),
    handleToggleFactionSection: (label: string) =>
      setExpandedFactions((prev) => toggleSetMember(prev, label)),
  };
}
