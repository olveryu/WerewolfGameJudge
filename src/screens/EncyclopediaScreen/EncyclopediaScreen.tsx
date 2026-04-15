/**
 * EncyclopediaScreen - 角色图鉴
 *
 * SectionList 阵营分组 + 信息密集横卡 + Bottom Sheet 详情面板。
 * 支持按阵营筛选（4 阵营 toggle）+ 能力标签 dropdown 筛选 + 搜索。
 * 纯展示屏，不依赖 service，不含业务逻辑。
 */
import { Ionicons } from '@expo/vector-icons';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import {
  Faction,
  getAllRoleIds,
  getRoleSpec,
  isValidRoleId,
  isWolfRole,
  ROLE_SPECS,
  type RoleAbilityTag,
  type RoleId,
} from '@werewolf/game-engine/models/roles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  SectionList,
  type SectionListData,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { FormTextField } from '@/components/FormTextField';
import { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  componentSizes,
  createSharedStyles,
  fixed,
  layout,
  shadows,
  spacing,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

import { ALL_TAGS, FACTION_SECTIONS, type FactionConfig, TAG_LABELS } from './constants';
import { RoleDetailSheet } from './RoleDetailSheet';
import { RoleListItem } from './RoleListItem';

// ============================================
// Types
// ============================================

type FactionFilterKey = 'all' | 'god' | 'wolf' | 'villager' | 'third';

interface FactionTab {
  key: Exclude<FactionFilterKey, 'all'>;
  label: string;
}

const FACTION_TABS: readonly FactionTab[] = [
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

// ============================================
// Helpers
// ============================================

function getFactionColorForRole(roleId: RoleId, colors: ThemeColors): string {
  if (isWolfRole(roleId)) return colors.wolf;
  const spec = getRoleSpec(roleId);
  if (spec?.faction === Faction.God) return colors.god;
  if (spec?.faction === Faction.Special) return colors.third;
  return colors.villager;
}

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

interface RoleSection {
  title: string;
  colorKey: FactionConfig['colorKey'];
  data: [RoleId, RoleId | null][];
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
    // Single faction → single section (no section header needed, but SectionList requires it)
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

  // All factions → grouped sections
  return FACTION_SECTIONS.map((config) => {
    const roles = filtered.filter((id) => ROLE_SPECS[id].faction === config.faction);
    return {
      title: `${config.label} · ${roles.length}`,
      colorKey: config.colorKey,
      data: toPairs(roles),
    };
  }).filter((s) => s.data.length > 0);
}

// ============================================
// Main Screen
// ============================================

export const EncyclopediaScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
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
      setSelectedRole(roleId as RoleId);
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

  const styles = useMemo(() => createStyles(colors), []);

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

  const renderItem = useCallback(
    ({ item }: { item: [RoleId, RoleId | null] }) => (
      <View style={styles.gridRow}>
        <RoleListItem
          roleId={item[0]}
          factionColor={getFactionColorForRole(item[0], colors)}
          onPress={handleRolePress}
          colors={colors}
        />
        {item[1] ? (
          <RoleListItem
            roleId={item[1]}
            factionColor={getFactionColorForRole(item[1], colors)}
            onPress={handleRolePress}
            colors={colors}
          />
        ) : (
          <View style={styles.gridPlaceholder} />
        )}
      </View>
    ),
    [handleRolePress, styles],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<[RoleId, RoleId | null], RoleSection> }) => {
      const factionColor = colors[section.colorKey];
      return (
        <View style={[styles.sectionHeader, { backgroundColor: withAlpha(factionColor, 0.06) }]}>
          <View style={[styles.sectionAccent, { backgroundColor: factionColor }]} />
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {section.title}
          </Text>
        </View>
      );
    },
    [styles],
  );

  const keyExtractor = useCallback(
    (item: [RoleId, RoleId | null]) => item[0] + (item[1] ?? ''),
    [],
  );

  return (
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID={TESTIDS.encyclopediaScreenRoot}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + layout.headerPaddingV }]}>
        <Button variant="icon" onPress={handleGoBack} accessibilityLabel="返回">
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </Button>
        <Text style={styles.headerTitle}>角色图鉴</Text>
        <View style={styles.headerRight}>
          <Button
            variant="icon"
            onPress={() => setTagDropdownVisible(true)}
            style={activeTag ? styles.headerIconButtonActive : undefined}
            accessibilityLabel="能力筛选"
          >
            <Ionicons
              name="filter"
              size={componentSizes.icon.md}
              color={activeTag ? colors.primary : colors.text}
            />
          </Button>
          <Button variant="icon" onPress={toggleSearch} accessibilityLabel="搜索">
            <Ionicons
              name={searchVisible ? 'close' : 'search'}
              size={componentSizes.icon.md}
              color={colors.text}
            />
          </Button>
        </View>
      </View>

      {/* Search Bar */}
      {searchVisible && (
        <FormTextField
          variant="search"
          icon="search"
          containerStyle={styles.searchBar}
          placeholder="搜索角色名/技能"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
          returnKeyType="search"
        />
      )}

      {/* Faction Tabs */}
      <View style={styles.tabBar}>
        {FACTION_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <Pressable
              key={tab.key}
              testID={TESTIDS.encyclopediaFactionTab(tab.key)}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleFactionChange(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label} · {getTabCount(tab.key)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tag Dropdown Modal */}
      <Modal
        visible={tagDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTagDropdownVisible(false)}
      >
        <Pressable style={styles.dropdownOverlay} onPress={() => setTagDropdownVisible(false)}>
          <View style={styles.dropdownMenu}>
            <Text style={styles.dropdownTitle}>能力筛选</Text>
            {ALL_TAGS.map((tag) => {
              const isActive = activeTag === tag;
              const count = getTagCount(tag);
              if (count === 0 && !isActive) return null;
              return (
                <Pressable
                  key={tag}
                  testID={TESTIDS.encyclopediaTagFilter(tag)}
                  style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                  onPress={() => handleTagPress(tag)}
                >
                  <Text
                    style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}
                  >
                    {TAG_LABELS[tag]}
                  </Text>
                  {count > 0 && (
                    <Text
                      style={[styles.dropdownItemCount, isActive && styles.dropdownItemCountActive]}
                    >
                      {count}
                    </Text>
                  )}
                  {isActive && (
                    <Ionicons
                      name="checkmark"
                      size={componentSizes.icon.sm}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
            {activeTag && (
              <Button
                variant="ghost"
                onPress={() => {
                  setActiveTag(null);
                  setTagDropdownVisible(false);
                }}
              >
                清除筛选
              </Button>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Role List */}
      {totalCount > 0 ? (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled={false}
          style={styles.listStyle}
          contentContainerStyle={[
            styles.listContent,
            insets.bottom > 0 && { paddingBottom: spacing.xlarge + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={componentSizes.icon.xl} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>没有找到匹配的角色</Text>
          <Text style={[styles.emptyHint, { color: colors.textMuted }]}>试试调整筛选条件</Text>
        </View>
      )}

      {/* Role Detail Sheet */}
      <RoleDetailSheet
        visible={selectedRole !== null}
        roleId={selectedRole}
        onClose={handleCloseDetail}
      />
    </SafeAreaView>
  );
};

// ============================================
// Styles
// ============================================

function createStyles(colors: ThemeColors) {
  const shared = createSharedStyles(colors);
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.transparent,
    },
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.screenH,
      paddingVertical: spacing.medium,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    backButton: {
      ...shared.iconButton,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    headerTitle: {
      flex: 1,
      fontSize: layout.headerTitleSize,
      lineHeight: layout.headerTitleLineHeight,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    headerIconButtonActive: {
      backgroundColor: withAlpha(colors.primary, 0.15),
    },
    // Search
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.screenH,
      marginTop: spacing.small,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      gap: spacing.small,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      padding: 0,
    },
    // Faction Tabs
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.screenH,
      marginTop: spacing.small,
      marginBottom: spacing.small,
      gap: spacing.small,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.small,
      borderRadius: borderRadius.small,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tabActive: {
      backgroundColor: withAlpha(colors.primary, 0.15),
      borderColor: colors.primary,
    },
    tabText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    // Tag Dropdown Menu (Modal)
    dropdownOverlay: {
      flex: 1,
      backgroundColor: withAlpha(colors.background, 0.5),
      justifyContent: 'center',
      alignItems: 'center',
    },
    dropdownMenu: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      paddingVertical: spacing.medium,
      paddingHorizontal: spacing.large,
      minWidth: 200,
      maxWidth: '80%',
      ...shadows.md,
    },
    dropdownTitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginBottom: spacing.small,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.small,
      borderRadius: borderRadius.small,
    },
    dropdownItemActive: {
      backgroundColor: withAlpha(colors.primary, 0.1),
    },
    dropdownItemText: {
      flex: 1,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    dropdownItemTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    dropdownItemCount: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.medium,
      color: colors.textMuted,
      marginRight: spacing.small,
    },
    dropdownItemCountActive: {
      color: colors.primary,
    },
    dropdownClearText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.medium,
      color: colors.error,
    },
    // Section List
    listStyle: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      paddingBottom: spacing.xlarge,
    },
    gridRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.screenH,
      gap: spacing.small,
      marginBottom: spacing.small,
    },
    gridPlaceholder: {
      flex: 1,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.screenH,
    },
    sectionAccent: {
      width: spacing.tight,
      height: typography.secondary,
      borderRadius: borderRadius.full,
      marginRight: spacing.small,
    },
    sectionTitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.semibold,
    },
    // Empty State
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xlarge,
    },
    emptyText: {
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.medium,
      marginTop: spacing.medium,
    },
    emptyHint: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      marginTop: spacing.tight,
    },
  });
}
