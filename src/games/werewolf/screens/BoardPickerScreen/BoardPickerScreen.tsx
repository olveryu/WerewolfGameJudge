/**
 * BoardPickerScreen - full-screen board picker page (first step of room creation)
 *
 * SectionList displays preset template cards by category (Classic / Advanced / Special / Third-party).
 * Each card shows name + faction stats + key differentiating role chips.
 * Top search bar supports filtering by name + role name. Bottom "Custom" entry skips presets and goes directly to ConfigScreen.
 * Pure presentation layer, does not import service, contains no business logic.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { PresetTemplate } from '@game-judge/game-engine/games/werewolf/public';
import {
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
} from '@game-judge/game-engine/games/werewolf/public';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { FormTextField } from '@/components/FormTextField';
import { PressableScale } from '@/components/PressableScale';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BoardStrategyModal } from '@/games/werewolf/components/BoardStrategy';
import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import { type TemplateSectionData } from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import { useBoardRolePreview } from '@/games/werewolf/screens/useBoardRolePreview';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, spacing, withAlpha } from '@/theme';

import { SegmentedControl } from '../EncyclopediaScreen/components/SegmentedControl';
import { BoardCard, estimateMaxChips } from './BoardCard';
import { createBoardPickerStyles } from './BoardPickerScreen.styles';
import { useBoardPickerScreenState } from './useBoardPickerScreenState';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
interface BoardPickerScreenProps {
  readonly onExitFlow: () => void;
}

/** Board picker screen. */ export const BoardPickerScreen: React.FC<BoardPickerScreenProps> = ({
  onExitFlow,
}) => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createBoardPickerStyles(colors), []);
  const { width: screenWidth } = useWindowDimensions();
  const maxChips = useMemo(() => estimateMaxChips(screenWidth), [screenWidth]);
  const { handleRolePress, roleCardProps } = useBoardRolePreview();

  const {
    searchQuery,
    setSearchQuery,
    searchVisible,
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
    toggleSearch,
    handleClearSearch,
    handleTabPress,
    handleToggleExpand,
    toggleFilter,
    handleToggleRole,
    handleClearFilter,
    handleToggleFactionSection,
  } = useBoardPickerScreenState({ onExitFlow });

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
      // Fixed accent color per category (was: cycled by section position)
      const accentColor =
        section.category === TemplateCategory.Classic
          ? colors.god
          : section.category === TemplateCategory.Advanced
            ? colors.warning
            : section.category === TemplateCategory.Special
              ? colors.primary
              : colors.third;

      return (
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionAccent, { backgroundColor: accentColor }]} />
          <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
      );
    },
    [styles],
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

      {/* Category Tabs — disabled (not removed) during search */}
      <SegmentedControl
        segments={CATEGORY_TABS.map((cat) => ({
          key: cat,
          label: `${TEMPLATE_CATEGORY_LABELS[cat]} · ${categoryCounts.get(cat) ?? 0}`,
        }))}
        activeKey={activeCategory}
        onChangeKey={handleTabPress}
        disabled={searchVisible}
      />

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
        <PressableScale style={styles.customButtonRow} onPress={handleCustom} haptic>
          <Ionicons name="create-outline" size={componentSizes.icon.md} color={colors.primary} />
          <Text style={styles.customButtonText}>从零开始自定义配置</Text>
        </PressableScale>
      </View>

      {/* Role preview card */}
      <RoleCardSimple {...roleCardProps} />

      {/* Board Strategy Modal */}
      <BoardStrategyModal boardName={strategyBoardName} onClose={handleStrategyClose} />
    </SafeAreaView>
  );
};
