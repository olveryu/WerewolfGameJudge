/**
 * EncyclopediaScreen - 角色图鉴
 *
 * 展示所有角色的详细信息卡片（badge + 名称 + 阵营色竖条 + 功能/难度标签 + 摘要），
 * 支持按阵营筛选（全部 / 神职 / 村民 / 狼人 / 第三方）+ 即时搜索，
 * 按功能分组显示 section header，点击打开结构化详情 Modal（含上下角色导航）。
 * 收藏（AsyncStorage）+ 最近查看（内存）。
 * 纯展示屏，不依赖 service，不含业务逻辑。
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TESTIDS } from '@/testids';
import {
  borderRadius,
  componentSizes,
  fixed,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  useColors,
  withAlpha,
} from '@/theme';

import { RoleDetailContent } from './components/RoleDetailContent';
import { RoleGridItem, type RoleGridItemStyles } from './components/RoleGridItem';
import {
  buildFlatListData,
  buildSections,
  FACTION_TABS,
  type FactionFilterKey,
  flatRoleIdsFromSections,
  getFactionColorKey,
  type ListItem,
} from './data/roleCategories';
import { useRecentRoles } from './hooks/useRecentRoles';

// ============================================
// Constants
// ============================================

const NUM_COLUMNS = 2;
const GRID_GAP = spacing.small;

// ============================================
// Main Screen
// ============================================

export const EncyclopediaScreen: React.FC = () => {
  const colors = useColors();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();

  const [activeFilter, setActiveFilter] = useState<FactionFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const searchInputRef = useRef<TextInput>(null);

  const { addRecent, toggleFavorite, isFavorite } = useRecentRoles();

  // ── 数据构建 ──
  const sections = useMemo(
    () => buildSections(activeFilter, searchQuery),
    [activeFilter, searchQuery],
  );
  const flatData = useMemo(() => buildFlatListData(sections), [sections]);
  const flatRoleIds = useMemo(() => flatRoleIdsFromSections(sections), [sections]);

  // ── 布局计算 ──
  const contentPadding = spacing.medium;
  const itemWidth = (screenWidth - contentPadding * 2 - GRID_GAP) / NUM_COLUMNS;

  const styles = useMemo(() => createStyles(colors), [colors]);
  const gridItemStyles = useMemo(() => createGridItemStyles(colors), [colors]);

  // ── Handlers ──
  const handleRolePress = useCallback(
    (roleId: RoleId) => {
      addRecent(roleId);
      setSelectedRole(roleId);
    },
    [addRecent],
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedRole(null);
  }, []);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleToggleSearch = useCallback(() => {
    setShowSearch((prev) => {
      if (!prev) {
        // 展开后聚焦
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } else {
        setSearchQuery('');
      }
      return !prev;
    });
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  // ── 详情导航 ──
  const selectedIndex = selectedRole ? flatRoleIds.indexOf(selectedRole) : -1;

  const handlePrev = useMemo(() => {
    if (selectedIndex <= 0) return null;
    return () => {
      const prevRole = flatRoleIds[selectedIndex - 1];
      addRecent(prevRole);
      setSelectedRole(prevRole);
    };
  }, [selectedIndex, flatRoleIds, addRecent]);

  const handleNext = useMemo(() => {
    if (selectedIndex < 0 || selectedIndex >= flatRoleIds.length - 1) return null;
    return () => {
      const nextRole = flatRoleIds[selectedIndex + 1];
      addRecent(nextRole);
      setSelectedRole(nextRole);
    };
  }, [selectedIndex, flatRoleIds, addRecent]);

  const handleToggleFavorite = useCallback(() => {
    if (selectedRole) toggleFavorite(selectedRole);
  }, [selectedRole, toggleFavorite]);

  // ── 渲染 ──
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'sectionHeader') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
              {item.title}
            </Text>
          </View>
        );
      }
      // roleRow: 1 or 2 cards
      return (
        <View style={styles.gridRow}>
          {item.roles.map((roleId) => (
            <RoleGridItem
              key={roleId}
              roleId={roleId}
              factionColor={colors[getFactionColorKey(roleId)]}
              itemWidth={itemWidth}
              onPress={handleRolePress}
              colors={colors}
              styles={gridItemStyles}
              isFavorite={isFavorite(roleId)}
            />
          ))}
          {/* 奇数行占位 */}
          {item.roles.length === 1 && <View style={{ width: itemWidth }} />}
        </View>
      );
    },
    [colors, itemWidth, handleRolePress, gridItemStyles, styles, isFavorite],
  );

  const keyExtractor = useCallback((item: ListItem) => item.key, []);

  const listEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          没有找到「{searchQuery}」相关角色
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          试试其他关键词，或清除筛选
        </Text>
        <TouchableOpacity
          style={[styles.emptyClearButton, { borderColor: colors.primary }]}
          onPress={handleClearSearch}
          activeOpacity={fixed.activeOpacity}
        >
          <Text style={[styles.emptyClearText, { color: colors.primary }]}>清除搜索</Text>
        </TouchableOpacity>
      </View>
    ),
    [searchQuery, colors, styles, handleClearSearch],
  );

  return (
    <SafeAreaView style={styles.container} testID={TESTIDS.encyclopediaScreenRoot}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backButton}
          activeOpacity={fixed.activeOpacity}
          accessibilityLabel="返回"
        >
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>角色图鉴</Text>
        <TouchableOpacity
          onPress={handleToggleSearch}
          style={styles.searchButton}
          activeOpacity={fixed.activeOpacity}
          accessibilityLabel={showSearch ? '关闭搜索' : '搜索'}
        >
          <Ionicons
            name={showSearch ? 'close' : 'search'}
            size={componentSizes.icon.md}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={componentSizes.icon.sm} color={colors.textMuted} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="搜索角色名称…"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} activeOpacity={fixed.activeOpacity}>
              <Ionicons
                name="close-circle"
                size={componentSizes.icon.sm}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Faction Chips */}
      <View style={styles.tabBar}>
        {FACTION_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <Pressable
              key={tab.key}
              testID={TESTIDS.encyclopediaFactionTab(tab.key)}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveFilter(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Role List */}
      <FlatList
        data={flatData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={searchQuery ? listEmptyComponent : null}
      />

      {/* Role Detail Modal */}
      <RoleDetailContent
        visible={selectedRole !== null}
        roleId={selectedRole}
        onClose={handleCloseDetail}
        onPrev={handlePrev}
        onNext={handleNext}
        onRolePress={handleRolePress}
        isFavorite={selectedRole ? isFavorite(selectedRole) : false}
        onToggleFavorite={handleToggleFavorite}
      />
    </SafeAreaView>
  );
};

// ============================================
// Styles
// ============================================

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.small,
    },
    backButton: {
      padding: spacing.small,
    },
    headerTitle: {
      ...textStyles.titleBold,
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    searchButton: {
      padding: spacing.small,
      width: componentSizes.icon.lg + spacing.small * 2,
      alignItems: 'center',
    },
    // Search
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.medium,
      marginBottom: spacing.small,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      gap: spacing.small,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.body,
      paddingVertical: spacing.tight,
    },
    // Tabs
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.medium,
      marginBottom: spacing.medium,
      gap: spacing.small,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.small,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    tabActive: {
      backgroundColor: withAlpha(colors.primary, 0.15),
      borderColor: colors.primary,
    },
    tabText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    // Section Headers
    sectionHeader: {
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.tight,
      marginTop: spacing.small,
    },
    sectionHeaderText: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.semibold,
    },
    // Grid
    gridContent: {
      paddingHorizontal: spacing.medium,
      paddingBottom: spacing.xlarge,
    },
    gridRow: {
      flexDirection: 'row',
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    // Empty state
    emptyContainer: {
      alignItems: 'center',
      paddingTop: spacing.xxlarge,
      paddingHorizontal: spacing.large,
    },
    emptyIcon: {
      fontSize: typography.display,
      marginBottom: spacing.medium,
    },
    emptyTitle: {
      ...textStyles.bodySemibold,
      textAlign: 'center',
      marginBottom: spacing.small,
    },
    emptySubtitle: {
      fontSize: typography.secondary,
      textAlign: 'center',
      marginBottom: spacing.large,
    },
    emptyClearButton: {
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.small,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
    },
    emptyClearText: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.medium,
    },
  });
}

function createGridItemStyles(colors: ThemeColors): RoleGridItemStyles {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      overflow: 'hidden',
      ...shadows.sm,
    },
    factionBar: {
      width: fixed.borderWidthHighlight,
    },
    cardInner: {
      flex: 1,
      padding: spacing.small,
      gap: spacing.tight,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    badgeImage: {
      width: 36,
      height: 36,
    },
    nameText: {
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
      flex: 1,
    },
    emojiText: {
      fontSize: typography.secondary,
    },
    tagRow: {
      flexDirection: 'row',
      gap: spacing.tight,
    },
    factionChip: {
      paddingHorizontal: spacing.tight,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.full,
    },
    factionChipText: {
      fontSize: typography.captionSmall,
      fontWeight: typography.weights.medium,
    },
    difficultyChip: {
      paddingHorizontal: spacing.tight,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.full,
    },
    difficultyChipText: {
      fontSize: typography.captionSmall,
      fontWeight: typography.weights.medium,
    },
    summaryText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
    },
  });
}
