/**
 * EncyclopediaRolesContent — 共享图鉴「角色」段内容区（自狼人杀 RolesGuideContent 搬入）。
 *
 * 阵营筛选 tab、能力标签下拉（数据源提供 tagCatalog 时才有）、搜索、
 * SectionList 双列网格、角色详情 sheet。状态由分段壳持有并以 props 传入。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { Pressable, SectionList, type SectionListData, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { FormTextField } from '@/components/FormTextField';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, spacing, withAlpha } from '@/theme';

import { EncyclopediaRoleDetailSheet } from './EncyclopediaRoleDetailSheet';
import { EncyclopediaRoleListItem } from './EncyclopediaRoleListItem';
import type { EncyclopediaRoleEntry, EncyclopediaRoleSource } from './encyclopediaSource';
import { createEncyclopediaStyles } from './encyclopediaStyles';
import {
  type EncyclopediaRoleSection,
  type EncyclopediaRolesState,
} from './useEncyclopediaRolesState';

// ── Props ─────────────────────────────────────────────────────────────────────

interface EncyclopediaRolesContentProps {
  source: EncyclopediaRoleSource;
  state: EncyclopediaRolesState;
  /** 详情 hero 附加动作插槽（游戏专属）；透传给详情 sheet。 */
  roleDetailHeaderExtra?: (entry: EncyclopediaRoleEntry, onClose: () => void) => React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Role guide content area. */
export const EncyclopediaRolesContent: React.FC<EncyclopediaRolesContentProps> = ({
  source,
  state,
  roleDetailHeaderExtra,
}) => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createEncyclopediaStyles(colors), []);

  const {
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
    handleRolePress,
    handleCloseDetail,
    handleFactionChange,
    handleTagPress,
    getTabCount,
    getTagCount,
  } = state;

  const tagCatalog = source.tagCatalog;

  const renderItem = useCallback(
    ({ item }: { item: [EncyclopediaRoleEntry, EncyclopediaRoleEntry | null] }) => (
      <View style={styles.gridRow}>
        <EncyclopediaRoleListItem
          entry={item[0]}
          factionColor={colors[item[0].factionColorKey]}
          onPress={handleRolePress}
        />
        {item[1] ? (
          <EncyclopediaRoleListItem
            entry={item[1]}
            factionColor={colors[item[1].factionColorKey]}
            onPress={handleRolePress}
          />
        ) : (
          <View style={styles.gridPlaceholder} />
        )}
      </View>
    ),
    [handleRolePress, styles],
  );

  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: SectionListData<
        [EncyclopediaRoleEntry, EncyclopediaRoleEntry | null],
        EncyclopediaRoleSection
      >;
    }) => {
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
    (item: [EncyclopediaRoleEntry, EncyclopediaRoleEntry | null]) =>
      item[0].id + (item[1]?.id ?? ''),
    [],
  );

  const selectedEntry =
    selectedRoleId === null
      ? null
      : (source.roles.find((entry) => entry.id === selectedRoleId) ?? null);

  return (
    <View style={styles.container}>
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
        {source.factionGroups.map((group) => {
          const isActive = activeFilter === group.key;
          return (
            <Pressable
              key={group.key}
              testID={TESTIDS.encyclopediaFactionTab(group.key)}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleFactionChange(group.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {group.label} · {getTabCount(group.key)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tag Dropdown Modal（数据源提供 tagCatalog 时才有此能力） */}
      {tagCatalog && (
        <Modal
          visible={tagDropdownVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTagDropdownVisible(false)}
        >
          <Pressable style={styles.dropdownOverlay} onPress={() => setTagDropdownVisible(false)}>
            <View style={styles.dropdownMenu}>
              <Text style={styles.dropdownTitle}>能力筛选</Text>
              {tagCatalog.map((tag) => {
                const isActive = activeTag === tag.key;
                const count = getTagCount(tag.key);
                if (count === 0 && !isActive) return null;
                return (
                  <Pressable
                    key={tag.key}
                    testID={TESTIDS.encyclopediaTagFilter(tag.key)}
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                    onPress={() => handleTagPress(tag.key)}
                  >
                    <Text
                      style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}
                    >
                      {tag.label}
                    </Text>
                    {count > 0 && (
                      <Text
                        style={[
                          styles.dropdownItemCount,
                          isActive && styles.dropdownItemCountActive,
                        ]}
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
      )}

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
      <EncyclopediaRoleDetailSheet
        entry={selectedEntry}
        onClose={handleCloseDetail}
        headerExtra={roleDetailHeaderExtra}
      />
    </View>
  );
};
