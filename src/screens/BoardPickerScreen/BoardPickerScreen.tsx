/**
 * BoardPickerScreen - 全屏板子选择页面（创建房间第一步）
 *
 * SectionList 按分类展示预设模板卡片（经典 / 进阶 / 特色 / 第三方）。
 * 每张卡片展示名称 + 阵营统计 + 关键差异角色 chip。
 * 顶部搜索栏支持按名字 + 角色名过滤。底部"自定义"入口跳过预设直接进 ConfigScreen。
 * 纯展示层，不 import service，不包含业务逻辑。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { PresetTemplate } from '@werewolf/game-engine/models/Template';
import { TEMPLATE_CATEGORY_LABELS, TemplateCategory } from '@werewolf/game-engine/models/Template';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  Text,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoardStrategyContent } from '@/components/BoardStrategy';
import { Button } from '@/components/Button';
import { FormTextField } from '@/components/FormTextField';
import { RoleCardSimple } from '@/components/RoleCardSimple';
import { ScreenHeader } from '@/components/ScreenHeader';
import { type TemplateSectionData } from '@/screens/ConfigScreen/configHelpers';
import { isAIChatReady } from '@/services/feature/AIChatService';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  componentSizes,
  shadows,
  spacing,
  textStyles,
  withAlpha,
} from '@/theme';
import { askAIAboutRole } from '@/utils/aiChatBridge';

import { BoardCard, estimateMaxChips } from './BoardCard';
import { createBoardPickerStyles } from './BoardPickerScreen.styles';
import { useBoardPickerScreenState } from './useBoardPickerScreenState';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Strategy Modal styles (module-level, stable references) ──

const strategyOverlayStyle = {
  flex: 1,
  backgroundColor: withAlpha(colors.background, 0.5),
  justifyContent: 'flex-end' as const,
};

const strategyModalStyle = {
  backgroundColor: colors.surface,
  borderTopLeftRadius: borderRadius.xlarge,
  borderTopRightRadius: borderRadius.xlarge,
  paddingHorizontal: spacing.large,
  paddingBottom: spacing.large,
  maxHeight: '85%',
  width: '100%',
  ...shadows.md,
} as const;

const strategyHeaderStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
  paddingTop: spacing.medium,
  paddingBottom: spacing.small,
};

const strategyTitleStyle = {
  ...textStyles.subtitleSemibold,
  color: colors.text,
  flex: 1,
};

/** Tab order for category filter bar */
const CATEGORY_TABS: TemplateCategory[] = [
  TemplateCategory.Classic,
  TemplateCategory.Advanced,
  TemplateCategory.Special,
  TemplateCategory.ThirdParty,
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export const BoardPickerScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createBoardPickerStyles(colors), []);
  const { width: screenWidth } = useWindowDimensions();
  const maxChips = useMemo(() => estimateMaxChips(screenWidth), [screenWidth]);

  const {
    searchQuery,
    setSearchQuery,
    searchVisible,
    previewRoleId,
    activeCategory,
    expandedName,
    filterVisible,
    selectedRoleIds,
    expandedFactions,
    filterGroups,
    categoryCounts,
    sections,
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
  } = useBoardPickerScreenState();

  // ── Strategy Modal state ──
  const [strategyBoardName, setStrategyBoardName] = useState<string | null>(null);

  const handleStrategyPress = useCallback((name: string) => {
    setStrategyBoardName(name);
  }, []);

  const handleStrategyClose = useCallback(() => {
    setStrategyBoardName(null);
  }, []);

  // ── Renderers ──
  const renderItem = useCallback(
    ({ item }: { item: PresetTemplate }) => (
      <BoardCard
        template={item}
        isExpanded={expandedName === item.name}
        onToggleExpand={handleToggleExpand}
        onSelect={handleSelect}
        onRolePress={handleRolePress}
        onStrategyPress={handleStrategyPress}
        styles={styles}
        maxChips={maxChips}
      />
    ),
    [
      expandedName,
      handleToggleExpand,
      handleSelect,
      handleRolePress,
      handleStrategyPress,
      styles,
      maxChips,
    ],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: TemplateSectionData }) => {
      // Pick accent color based on section position
      const sectionColors: string[] = [colors.god, colors.warning];
      const sectionIndex = sections.indexOf(section);
      const accentColor = sectionColors[sectionIndex % sectionColors.length];

      return (
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionAccent, { backgroundColor: accentColor }]} />
          <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
      );
    },
    [sections, styles],
  );

  const keyExtractor = useCallback((item: PresetTemplate) => item.name, []);

  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>没有匹配的模板</Text>
        <Button variant="ghost" onPress={handleClearSearch}>
          清除搜索
        </Button>
      </View>
    ),
    [styles, handleClearSearch],
  );

  return (
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID={TESTIDS.boardPickerScreenRoot}
    >
      {/* Header */}
      <ScreenHeader
        title="选择板子"
        onBack={handleGoBack}
        topInset={insets.top}
        headerRight={
          <View style={styles.headerRight}>
            <View>
              <Button variant="icon" onPress={toggleFilter} accessibilityLabel="筛选角色">
                <Ionicons
                  name={filterVisible ? 'funnel' : 'funnel-outline'}
                  size={componentSizes.icon.md}
                  color={selectedRoleIds.size > 0 ? colors.primary : colors.text}
                />
              </Button>
              {selectedRoleIds.size > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{selectedRoleIds.size}</Text>
                </View>
              )}
            </View>
            <Button variant="icon" onPress={toggleSearch} accessibilityLabel="搜索">
              <Ionicons
                name={searchVisible ? 'close' : 'search'}
                size={componentSizes.icon.md}
                color={colors.text}
              />
            </Button>
          </View>
        }
      />

      {/* Subtitle hint */}
      <View style={styles.headerSubtitleRow}>
        <Ionicons name="bulb-outline" size={componentSizes.icon.sm} color={colors.textSecondary} />
        <Text style={styles.headerSubtitle}>选完后还能自由增减角色</Text>
      </View>

      {/* Search Bar */}
      {searchVisible && (
        <FormTextField
          variant="search"
          icon="search"
          containerStyle={styles.searchBar}
          placeholder="搜索模板或角色"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      )}

      {/* Category Tabs — hidden during search */}
      {!searchVisible && (
        <View style={styles.tabBar}>
          {CATEGORY_TABS.map((cat) => {
            const isActive = activeCategory === cat;
            const count = categoryCounts.get(cat) ?? 0;
            return (
              <Pressable
                key={cat}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => handleTabPress(cat)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {TEMPLATE_CATEGORY_LABELS[cat]} {count}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Role Filter Modal */}
      <Modal visible={filterVisible} transparent animationType="fade" onRequestClose={toggleFilter}>
        <Pressable style={styles.filterOverlay} onPress={toggleFilter}>
          <Pressable
            style={styles.filterModal}
            onPress={() => {
              /* prevent dismiss */
            }}
          >
            <Text style={styles.filterTitle}>筛选角色</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {filterGroups.map((group) => {
                const isSectionExpanded = expandedFactions.has(group.label);
                const selectedInGroup = group.items.filter((i) =>
                  selectedRoleIds.has(i.roleId),
                ).length;
                return (
                  <View key={group.label}>
                    <Pressable
                      style={styles.filterSectionHeader}
                      onPress={() => handleToggleFactionSection(group.label)}
                    >
                      <Text style={[styles.filterSectionLabel, { color: group.color }]}>
                        {group.label}
                      </Text>
                      <Text style={styles.filterSectionCount}>
                        {selectedInGroup > 0 ? `${selectedInGroup}/` : ''}
                        {group.items.length}
                      </Text>
                      <Ionicons
                        name={isSectionExpanded ? 'chevron-up' : 'chevron-down'}
                        size={componentSizes.icon.xs}
                        color={colors.textMuted}
                        style={{ marginLeft: spacing.tight }}
                      />
                    </Pressable>
                    {isSectionExpanded && (
                      <View style={styles.filterChipWrap}>
                        {group.items.map((item) => {
                          const isActive = selectedRoleIds.has(item.roleId);
                          return (
                            <Pressable
                              key={item.roleId}
                              style={[
                                styles.filterItem,
                                isActive && {
                                  borderColor: group.color,
                                  backgroundColor: withAlpha(group.color, 0.12),
                                },
                              ]}
                              onPress={() => handleToggleRole(item.roleId)}
                            >
                              <Text
                                style={[
                                  styles.filterItemText,
                                  isActive && {
                                    color: group.color,
                                    fontWeight: styles.filterItemTextActive.fontWeight,
                                  },
                                ]}
                              >
                                {item.displayName}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <Text style={styles.filterHint}>部分角色不在预设板子中，可通过“自定义配置”添加</Text>
            <View style={styles.filterFooter}>
              {selectedRoleIds.size > 0 && (
                <Button variant="ghost" size="sm" onPress={handleClearFilter}>
                  清除筛选
                </Button>
              )}
              <Button variant="primary" size="sm" onPress={toggleFilter}>
                确认
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* SectionList */}
      <SectionList<PresetTemplate, TemplateSectionData>
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={ListEmptyComponent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        style={styles.listStyle}
        contentContainerStyle={styles.listContent}
      />

      {/* Bottom bar — custom entry */}
      <View style={[styles.bottomBar, insets.bottom > 0 && { paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.customButtonRow} activeOpacity={0.7} onPress={handleCustom}>
          <Ionicons name="create-outline" size={componentSizes.icon.md} color={colors.primary} />
          <Text style={styles.customButtonText}>从零开始自定义配置</Text>
        </TouchableOpacity>
      </View>

      {/* Role preview card */}
      <RoleCardSimple
        visible={previewRoleId !== null}
        roleId={previewRoleId}
        onClose={handlePreviewClose}
        showRealIdentity
        onAskAI={isAIChatReady() ? (rid) => askAIAboutRole(rid, handlePreviewClose) : undefined}
      />

      {/* Board Strategy Modal */}
      <Modal
        visible={strategyBoardName !== null}
        transparent
        animationType="slide"
        onRequestClose={handleStrategyClose}
      >
        <Pressable style={strategyOverlayStyle} onPress={handleStrategyClose}>
          <Pressable
            style={strategyModalStyle}
            onPress={() => {
              /* prevent dismiss */
            }}
          >
            <View style={strategyHeaderStyle}>
              <Text style={strategyTitleStyle} numberOfLines={1}>
                {strategyBoardName} · 攻略
              </Text>
              <Button variant="icon" size="sm" onPress={handleStrategyClose}>
                <Ionicons name="close" size={componentSizes.icon.md} color={colors.textSecondary} />
              </Button>
            </View>
            {strategyBoardName && <BoardStrategyContent boardName={strategyBoardName} />}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};
