/**
 * useBoardPickerScreenState — BoardPickerScreen 的状态 hook
 *
 * 搜索 / 分类 / 角色筛选 / 展开折叠 / 导航。
 */
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Faction, type RoleId } from '@werewolf/game-engine/models/roles';
import { PRESET_TEMPLATES, TemplateCategory } from '@werewolf/game-engine/models/Template';
import { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation } from 'react-native';

import type { RootStackParamList } from '@/navigation/types';
import {
  filterTemplates,
  getDistinctiveRoles,
  groupTemplatesByCategory,
} from '@/screens/ConfigScreen/configHelpers';
import { colors } from '@/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'BoardPicker'>;
type BoardPickerRouteProp = RouteProp<RootStackParamList, 'BoardPicker'>;

export function useBoardPickerScreenState() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<BoardPickerRouteProp>();
  const existingRoomCode = route.params?.existingRoomCode;
  const nominateMode = route.params?.nominateMode;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [previewRoleId, setPreviewRoleId] = useState<RoleId | null>(null);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | null>(
    TemplateCategory.Classic,
  );
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [expandedFactions, setExpandedFactions] = useState<Set<string>>(new Set());

  // ── Role filter chip data (stable, grouped by faction) ──
  const distinctiveRoles = useMemo(() => getDistinctiveRoles(PRESET_TEMPLATES), []);
  const filterGroups = useMemo(() => {
    const groups: { label: string; color: string; items: typeof distinctiveRoles }[] = [];
    const factions: { key: Faction; label: string; colorKey: string }[] = [
      { key: Faction.Wolf, label: '狼人', colorKey: 'wolf' },
      { key: Faction.God, label: '神职', colorKey: 'god' },
      { key: Faction.Villager, label: '村民', colorKey: 'villager' },
      { key: Faction.Special, label: '第三方', colorKey: 'third' },
    ];
    for (const f of factions) {
      const items = distinctiveRoles.filter((r) => r.faction === f.key);
      if (items.length > 0) {
        groups.push({
          label: f.label,
          color: colors[f.colorKey as keyof typeof colors],
          items,
        });
      }
    }
    return groups;
  }, [distinctiveRoles]);

  // ── Data pipeline ──
  const filtered = useMemo(() => filterTemplates(PRESET_TEMPLATES, searchQuery), [searchQuery]);
  const roleFiltered = useMemo(
    () =>
      selectedRoleIds.size === 0
        ? filtered
        : filtered.filter((t) => {
            const roleSet = new Set<string>(t.roles);
            for (const id of selectedRoleIds) {
              if (!roleSet.has(id)) return false;
            }
            return true;
          }),
    [filtered, selectedRoleIds],
  );
  const allSections = useMemo(() => groupTemplatesByCategory(roleFiltered), [roleFiltered]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<TemplateCategory, number>();
    for (const s of allSections) {
      counts.set(s.category, s.data.length);
    }
    return counts;
  }, [allSections]);
  const sections = useMemo(
    () =>
      activeCategory === null
        ? allSections
        : allSections.filter((s) => s.category === activeCategory),
    [allSections, activeCategory],
  );

  // ── Handlers ──
  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  const handleSelect = useCallback(
    (presetName: string) => {
      if (nominateMode) {
        navigation.replace('Config', { presetName, nominateMode });
      } else {
        navigation.popTo('Config', { presetName, existingRoomCode });
      }
    },
    [navigation, existingRoomCode, nominateMode],
  );

  const handleCustom = useCallback(() => {
    if (nominateMode) {
      navigation.replace('Config', { nominateMode });
    } else {
      navigation.popTo('Config', existingRoomCode ? { existingRoomCode } : undefined);
    }
  }, [navigation, existingRoomCode, nominateMode]);

  const handleRolePress = useCallback((roleId: string) => {
    setPreviewRoleId(roleId as RoleId);
  }, []);

  const handlePreviewClose = useCallback(() => {
    setPreviewRoleId(null);
  }, []);

  const toggleSearch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchVisible((prev) => {
      if (prev) setSearchQuery('');
      return !prev;
    });
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleTabPress = useCallback((cat: TemplateCategory) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveCategory((prev) => (prev === cat ? null : cat));
  }, []);

  const handleToggleExpand = useCallback((name: string) => {
    setExpandedName((prev) => (prev === name ? null : name));
  }, []);

  const toggleFilter = useCallback(() => {
    setFilterVisible((prev) => !prev);
  }, []);

  const handleToggleRole = useCallback((roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  }, []);

  const handleClearFilter = useCallback(() => {
    setSelectedRoleIds(new Set());
  }, []);

  const handleToggleFactionSection = useCallback((label: string) => {
    setExpandedFactions((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  return {
    // State
    searchQuery,
    setSearchQuery,
    searchVisible,
    previewRoleId,
    activeCategory,
    expandedName,
    filterVisible,
    selectedRoleIds,
    expandedFactions,
    // Computed
    filterGroups,
    categoryCounts,
    sections,
    // Handlers
    handleGoBack,
    handleSelect,
    handleCustom,
    handleRolePress,
    handlePreviewClose,
    toggleSearch,
    handleClearSearch,
    handleTabPress,
    handleToggleExpand,
    toggleFilter,
    handleToggleRole,
    handleClearFilter,
    handleToggleFactionSection,
  };
}
