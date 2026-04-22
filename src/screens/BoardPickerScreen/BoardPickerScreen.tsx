/**
 * BoardPickerScreen - 全屏板子选择页面（创建房间第一步）
 *
 * SectionList 按分类展示预设模板卡片（经典 / 进阶 / 特色 / 第三方）。
 * 每张卡片展示名称 + 阵营统计 + 关键差异角色 chip。
 * 顶部搜索栏支持按名字 + 角色名过滤。底部"自定义"入口跳过预设直接进 ConfigScreen。
 * 纯展示层，不 import service，不包含业务逻辑。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Faction, type RoleId } from '@werewolf/game-engine/models/roles';
import type { PresetTemplate } from '@werewolf/game-engine/models/Template';
import {
  getPlayerCount,
  PRESET_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
} from '@werewolf/game-engine/models/Template';
import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
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

import { Button } from '@/components/Button';
import { FactionRoleList } from '@/components/FactionRoleList';
import { FormTextField } from '@/components/FormTextField';
import { RoleCardSimple } from '@/components/RoleCardSimple';
import { ScreenHeader } from '@/components/ScreenHeader';
import { RootStackParamList } from '@/navigation/types';
import {
  computeFactionStats,
  FACTION_COLOR_MAP,
  filterTemplates,
  getDistinctiveRoles,
  getKeyRoles,
  groupTemplatesByCategory,
  type TemplateSectionData,
} from '@/screens/ConfigScreen/configHelpers';
import { isAIChatReady } from '@/services/feature/AIChatService';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, fixed, layout, spacing, typography, withAlpha } from '@/theme';
import { askAIAboutRole } from '@/utils/aiChatBridge';

import { type BoardPickerStyles, createBoardPickerStyles } from './BoardPickerScreen.styles';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'BoardPicker'>;
type BoardPickerRouteProp = RouteProp<RootStackParamList, 'BoardPicker'>;

/** Tab order for category filter bar */
const CATEGORY_TABS: TemplateCategory[] = [
  TemplateCategory.Classic,
  TemplateCategory.Advanced,
  TemplateCategory.Special,
  TemplateCategory.ThirdParty,
];

// ─────────────────────────────────────────────────────────────────────────────
// BoardCard — 单张板子卡片
// ─────────────────────────────────────────────────────────────────────────────

/** Estimate how many key-role chips fit in a single row. */
const estimateMaxChips = (screenWidth: number): number => {
  // card available width = screen − card margin − card padding
  const cardInner = screenWidth - layout.screenPaddingH * 2 - spacing.medium * 2;
  // each chip ≈ paddingH*2 + ~3 chars * fontSize + gap
  const chipWidth = spacing.small * 2 + 3 * typography.caption + spacing.tight;
  return Math.max(2, Math.floor(cardInner / chipWidth));
};

interface BoardCardProps {
  template: PresetTemplate;
  isExpanded: boolean;
  onToggleExpand: (name: string) => void;
  onSelect: (name: string) => void;
  onRolePress: (roleId: string) => void;
  styles: BoardPickerStyles;
  maxChips: number;
}

const BoardCard = React.memo<BoardCardProps>(
  ({ template, isExpanded, onToggleExpand, onSelect, onRolePress, styles, maxChips }) => {
    const stats = useMemo(() => computeFactionStats(template.roles), [template.roles]);
    const keyRoles = useMemo(
      () => getKeyRoles(template.roles, maxChips),
      [template.roles, maxChips],
    );
    const remainingCount = useMemo(() => {
      const totalSpecial = template.roles.filter((r) => r !== 'wolf' && r !== 'villager').length;
      return Math.max(0, totalSpecial - keyRoles.length);
    }, [template.roles, keyRoles]);

    const handleToggle = useCallback(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onToggleExpand(template.name);
    }, [onToggleExpand, template.name]);

    const handleSelect = useCallback(() => {
      onSelect(template.name);
    }, [onSelect, template.name]);

    return (
      <View style={[styles.card, isExpanded && styles.cardSelected]}>
        {/* Tap header to expand/collapse */}
        <TouchableOpacity
          style={styles.cardHeader}
          activeOpacity={fixed.activeOpacity}
          onPress={handleToggle}
        >
          {/* Row 1: Title + player count + chevron */}
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {template.name}
            </Text>
            <View style={styles.cardPlayerBadge}>
              <Text style={styles.cardPlayerText}>{getPlayerCount(template.roles)}人</Text>
            </View>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={componentSizes.icon.sm}
              color={colors.textSecondary}
              style={styles.cardChevron}
            />
          </View>

          {/* Row 2: Faction stat badges */}
          <View style={styles.factionStatRow}>
            <View
              style={[styles.factionStatBadge, { backgroundColor: withAlpha(colors.wolf, 0.12) }]}
            >
              <Text style={[styles.factionStatText, { color: colors.wolf }]}>
                狼{stats.wolfCount}
              </Text>
            </View>
            <View
              style={[styles.factionStatBadge, { backgroundColor: withAlpha(colors.god, 0.12) }]}
            >
              <Text style={[styles.factionStatText, { color: colors.god }]}>
                神{stats.godCount}
              </Text>
            </View>
            <View
              style={[
                styles.factionStatBadge,
                { backgroundColor: withAlpha(colors.villager, 0.12) },
              ]}
            >
              <Text style={[styles.factionStatText, { color: colors.villager }]}>
                民{stats.villagerCount}
              </Text>
            </View>
            {stats.thirdCount > 0 && (
              <View
                style={[
                  styles.factionStatBadge,
                  { backgroundColor: withAlpha(colors.third, 0.12) },
                ]}
              >
                <Text style={[styles.factionStatText, { color: colors.third }]}>
                  特{stats.thirdCount}
                </Text>
              </View>
            )}
          </View>

          {/* Row 3: Key role chips (collapsed only) */}
          {!isExpanded && keyRoles.length > 0 && (
            <View style={styles.keyRoleRow}>
              {keyRoles.map((item) => {
                const colorKey = FACTION_COLOR_MAP[item.faction] ?? 'villager';
                const chipColor = colors[colorKey as keyof typeof colors];
                return (
                  <View
                    key={item.roleId}
                    style={[
                      styles.keyRoleChip,
                      {
                        borderColor: withAlpha(chipColor, 0.3),
                        backgroundColor: withAlpha(chipColor, 0.06),
                      },
                    ]}
                  >
                    <Text style={[styles.keyRoleChipText, { color: chipColor }]}>
                      {item.displayName}
                    </Text>
                  </View>
                );
              })}
              {remainingCount > 0 && <Text style={styles.keyRoleMore}>+{remainingCount}</Text>}
            </View>
          )}
        </TouchableOpacity>

        {/* Expanded: full role list + select button */}
        {isExpanded && (
          <View style={styles.cardExpanded}>
            <View style={styles.cardDivider} />
            <FactionRoleList roles={template.roles} showStats={false} onRolePress={onRolePress} />
            <Text style={styles.roleListHint}>
              <Ionicons
                name="information-circle-outline"
                size={componentSizes.icon.xs}
                color={colors.textMuted}
              />{' '}
              点击角色名查看能力说明
            </Text>
            <Button
              variant="primary"
              size="sm"
              onPress={handleSelect}
              style={{ marginTop: spacing.medium }}
            >
              以此为基础
            </Button>
          </View>
        )}
      </View>
    );
  },
);

BoardCard.displayName = 'BoardCard';

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export const BoardPickerScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<BoardPickerRouteProp>();
  const existingRoomCode = route.params?.existingRoomCode;
  const nominateMode = route.params?.nominateMode;
  const styles = useMemo(() => createBoardPickerStyles(colors), []);
  const { width: screenWidth } = useWindowDimensions();
  const maxChips = useMemo(() => estimateMaxChips(screenWidth), [screenWidth]);

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
        // replace so BoardPicker is removed from stack; goBack() in Config returns to Room.
        // getId on Config ensures this won't collide with the create/edit instance.
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

  // ── Renderers ──
  const renderItem = useCallback(
    ({ item }: { item: PresetTemplate }) => (
      <BoardCard
        template={item}
        isExpanded={expandedName === item.name}
        onToggleExpand={handleToggleExpand}
        onSelect={handleSelect}
        onRolePress={handleRolePress}
        styles={styles}
        maxChips={maxChips}
      />
    ),
    [expandedName, handleToggleExpand, handleSelect, handleRolePress, styles, maxChips],
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
    </SafeAreaView>
  );
};
