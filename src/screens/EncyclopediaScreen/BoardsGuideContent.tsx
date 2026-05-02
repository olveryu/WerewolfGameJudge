/**
 * BoardsGuideContent — 板子图鉴内容区
 *
 * 分类 chips 筛选 + 特色标签 dropdown 筛选 + 搜索 + FlatList<BoardCard>。
 * 复用 BoardPickerScreen 的 BoardCard 组件（showSelectButton=false）。
 * 纯展示组件，不含业务逻辑。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { getRoleSpec } from '@werewolf/game-engine/models/roles';
import {
  PRESET_TEMPLATES,
  type PresetTemplate,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
} from '@werewolf/game-engine/models/Template';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoardStrategyModal } from '@/components/BoardStrategy';
import { BOARD_STRATEGY } from '@/components/BoardStrategy/boardStrategyData';
import { Button } from '@/components/Button';
import { FormTextField } from '@/components/FormTextField';
import { BoardCard, estimateMaxChips } from '@/screens/BoardPickerScreen/BoardCard';
import { createBoardPickerStyles } from '@/screens/BoardPickerScreen/BoardPickerScreen.styles';
import {
  borderRadius,
  colors,
  componentSizes,
  shadows,
  spacing,
  typography,
  withAlpha,
} from '@/theme';

import { createBoardsGuideStyles } from './BoardsGuideContent.styles';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_COUNTS: Record<TemplateCategory, number> = (() => {
  const counts = {
    [TemplateCategory.Classic]: 0,
    [TemplateCategory.Advanced]: 0,
    [TemplateCategory.Special]: 0,
    [TemplateCategory.ThirdParty]: 0,
  };
  for (const t of PRESET_TEMPLATES) counts[t.category]++;
  return counts;
})();

const CATEGORY_TABS: readonly { key: TemplateCategory; label: string }[] = [
  TemplateCategory.Classic,
  TemplateCategory.Advanced,
  TemplateCategory.Special,
  TemplateCategory.ThirdParty,
].map((cat) => ({
  key: cat,
  label: `${TEMPLATE_CATEGORY_LABELS[cat]} · ${CATEGORY_COUNTS[cat]}`,
}));

/** All unique tags from BOARD_STRATEGY, sorted by frequency (desc) then alphabetical */
const ALL_BOARD_TAGS: readonly { tag: string; count: number }[] = (() => {
  const countMap = new Map<string, number>();
  for (const strategy of Object.values(BOARD_STRATEGY)) {
    for (const tag of strategy.tags) {
      countMap.set(tag, (countMap.get(tag) ?? 0) + 1);
    }
  }
  return [...countMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
    .map(([tag, count]) => ({ tag, count }));
})();

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesCategoryFilter(
  template: PresetTemplate,
  category: TemplateCategory | null,
): boolean {
  if (category === null) return true;
  return template.category === category;
}

function matchesSearchQuery(template: PresetTemplate, query: string): boolean {
  if (query === '') return true;
  const lowerQuery = query.toLowerCase();
  if (template.name.toLowerCase().includes(lowerQuery)) return true;
  return template.roles.some((roleId) =>
    getRoleSpec(roleId).displayName.toLowerCase().includes(lowerQuery),
  );
}

function matchesTagFilter(template: PresetTemplate, tagFilter: string | null): boolean {
  if (tagFilter === null) return true;
  return BOARD_STRATEGY[template.name]!.tags.includes(tagFilter);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface BoardsGuideContentProps {
  searchVisible: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  tagFilter: string | null;
  setTagFilter: (tag: string | null) => void;
  tagFilterDropdownVisible: boolean;
  setTagFilterDropdownVisible: (v: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const BoardsGuideContent: React.FC<BoardsGuideContentProps> = ({
  searchVisible,
  searchQuery,
  setSearchQuery,
  tagFilter,
  setTagFilter,
  tagFilterDropdownVisible,
  setTagFilterDropdownVisible,
}) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => createBoardsGuideStyles(colors), []);
  const cardStyles = useMemo(() => createBoardPickerStyles(colors), []);
  const maxChips = useMemo(() => estimateMaxChips(screenWidth), [screenWidth]);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | null>(null);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [strategyBoardName, setStrategyBoardName] = useState<string | null>(null);

  const filteredTemplates = useMemo(() => {
    return PRESET_TEMPLATES.filter(
      (t) =>
        matchesCategoryFilter(t, activeCategory) &&
        matchesSearchQuery(t, searchQuery) &&
        matchesTagFilter(t, tagFilter),
    );
  }, [activeCategory, searchQuery, tagFilter]);

  const handleCategoryPress = useCallback((key: TemplateCategory) => {
    setActiveCategory((prev) => (prev === key ? null : key));
  }, []);

  const handleTagFilterPress = useCallback(
    (tag: string) => {
      setTagFilter(tagFilter === tag ? null : tag);
      setTagFilterDropdownVisible(false);
    },
    [tagFilter, setTagFilter, setTagFilterDropdownVisible],
  );

  const handleToggleExpand = useCallback((name: string) => {
    setExpandedName((prev) => (prev === name ? null : name));
  }, []);

  const handleStrategyPress = useCallback((name: string) => {
    setStrategyBoardName(name);
  }, []);

  const handleStrategyClose = useCallback(() => {
    setStrategyBoardName(null);
  }, []);

  // noop — encyclopedia doesn't select boards
  const handleSelect = useCallback(() => {}, []);
  // noop — encyclopedia doesn't navigate to role detail on chip press
  const handleRolePress = useCallback(() => {}, []);

  const renderItem = useCallback(
    ({ item }: { item: PresetTemplate }) => (
      <BoardCard
        template={item}
        isExpanded={expandedName === item.name}
        onToggleExpand={handleToggleExpand}
        onSelect={handleSelect}
        onRolePress={handleRolePress}
        onStrategyPress={handleStrategyPress}
        styles={cardStyles}
        maxChips={maxChips}
        showSelectButton={false}
      />
    ),
    [
      expandedName,
      handleToggleExpand,
      handleSelect,
      handleRolePress,
      handleStrategyPress,
      cardStyles,
      maxChips,
    ],
  );

  const keyExtractor = useCallback((item: PresetTemplate) => item.name, []);

  return (
    <View style={styles.container}>
      {searchVisible && (
        <FormTextField
          variant="search"
          icon="search"
          containerStyle={styles.searchBar}
          placeholder="搜索板子名/角色名"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
          returnKeyType="search"
        />
      )}

      {/* Category chips */}
      <View style={styles.categoryBar}>
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeCategory === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              onPress={() => handleCategoryPress(tab.key)}
            >
              <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Active tag filter badge */}
      {tagFilter && (
        <View style={styles.activeFilterRow}>
          <View style={styles.activeFilterBadge}>
            <Text style={styles.activeFilterText}>{tagFilter}</Text>
            <Pressable onPress={() => setTagFilter(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={componentSizes.icon.sm} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Tag filter dropdown modal */}
      <Modal
        visible={tagFilterDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTagFilterDropdownVisible(false)}
      >
        <Pressable
          style={dropdownStyles.overlay}
          onPress={() => setTagFilterDropdownVisible(false)}
        >
          <View style={dropdownStyles.menu}>
            <Text style={dropdownStyles.title}>特色标签筛选</Text>
            <ScrollView style={dropdownStyles.scroll} showsVerticalScrollIndicator={false}>
              {ALL_BOARD_TAGS.map(({ tag, count }) => {
                const isActive = tagFilter === tag;
                return (
                  <Pressable
                    key={tag}
                    style={[dropdownStyles.item, isActive && dropdownStyles.itemActive]}
                    onPress={() => handleTagFilterPress(tag)}
                  >
                    <Text
                      style={[dropdownStyles.itemText, isActive && dropdownStyles.itemTextActive]}
                    >
                      {tag}
                    </Text>
                    <Text
                      style={[dropdownStyles.itemCount, isActive && dropdownStyles.itemCountActive]}
                    >
                      {count}
                    </Text>
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
            </ScrollView>
            {tagFilter && (
              <Button
                variant="ghost"
                onPress={() => {
                  setTagFilter(null);
                  setTagFilterDropdownVisible(false);
                }}
              >
                清除筛选
              </Button>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Board list */}
      {filteredTemplates.length > 0 ? (
        <FlatList
          data={filteredTemplates}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          style={styles.list}
          contentContainerStyle={[
            styles.listContentNoPad,
            insets.bottom > 0 && { paddingBottom: spacing.xlarge + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="albums-outline" size={componentSizes.icon.xl} color={colors.textMuted} />
          <Text style={styles.emptyText}>没有找到匹配的板子</Text>
          <Text style={styles.emptyHint}>试试调整筛选条件</Text>
        </View>
      )}

      <BoardStrategyModal boardName={strategyBoardName} onClose={handleStrategyClose} />
    </View>
  );
};

// ── Dropdown styles (stable module-level) ─────────────────────────────────────

const dropdownStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: withAlpha(colors.background, 0.5),
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.large,
    minWidth: 220,
    maxWidth: '80%',
    maxHeight: '70%',
    ...shadows.md,
  },
  title: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.small,
  },
  scroll: {
    maxHeight: 300,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.small,
    borderRadius: borderRadius.small,
  },
  itemActive: {
    backgroundColor: withAlpha(colors.primary, 0.1),
  },
  itemText: {
    flex: 1,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  itemTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  itemCount: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
    marginRight: spacing.small,
  },
  itemCountActive: {
    color: colors.primary,
  },
});
