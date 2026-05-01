/**
 * RolesGuideContent — 角色图鉴内容区
 *
 * 从 EncyclopediaScreen 提取的完整角色浏览内容：
 * 阵营筛选 tabs、能力标签 dropdown、搜索、SectionList 2-col 网格、RoleDetailSheet。
 * 作为 EncyclopediaScreen 的 tab content 使用，不含 ScreenHeader / SafeAreaView。
 * 状态由父组件通过 props 传入（hook 在 shell 层调用）。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Faction, getRoleSpec, isWolfRole, type RoleId } from '@werewolf/game-engine/models/roles';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { Modal, Pressable, SectionList, type SectionListData, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { FormTextField } from '@/components/FormTextField';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, spacing, type ThemeColors, withAlpha } from '@/theme';

import { ALL_TAGS, TAG_LABELS } from './constants';
import { createEncyclopediaStyles } from './EncyclopediaScreen.styles';
import { RoleDetailSheet } from './RoleDetailSheet';
import { RoleListItem } from './RoleListItem';
import {
  FACTION_TABS,
  type RoleSection,
  type useEncyclopediaScreenState,
} from './useEncyclopediaScreenState';

function getFactionColorForRole(roleId: RoleId, themeColors: ThemeColors): string {
  if (isWolfRole(roleId)) return themeColors.wolf;
  const spec = getRoleSpec(roleId);
  if (spec?.faction === Faction.God) return themeColors.god;
  if (spec?.faction === Faction.Special) return themeColors.third;
  return themeColors.villager;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RolesGuideContentProps {
  state: ReturnType<typeof useEncyclopediaScreenState>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const RolesGuideContent: React.FC<RolesGuideContentProps> = ({ state }) => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createEncyclopediaStyles(colors), []);

  const {
    activeFilter,
    activeTag,
    setActiveTag,
    searchQuery,
    setSearchQuery,
    searchVisible,
    selectedRole,
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
      const factionColor = colors[section.colorKey as keyof typeof colors];
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
    </View>
  );
};
