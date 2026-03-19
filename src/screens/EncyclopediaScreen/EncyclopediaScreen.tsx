/**
 * EncyclopediaScreen - 角色图鉴
 *
 * 展示所有角色的简要信息（emoji + 名称 + 阵营色边框），
 * 支持按阵营筛选（全部 / 好人 / 狼人 / 第三方），点击打开 RoleCardSimple 详情。
 * 纯展示屏，不依赖 service，不含业务逻辑。
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  Faction,
  getAllRoleIds,
  getRoleSpec,
  isWolfRole,
  ROLE_SPECS,
  type RoleId,
} from '@werewolf/game-engine/models/roles';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RoleCardSimple } from '@/components/RoleCardSimple';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  componentSizes,
  createSharedStyles,
  fixed,
  shadows,
  spacing,
  type ThemeColors,
  typography,
  useColors,
  withAlpha,
} from '@/theme';
import { getRoleBadge } from '@/utils/roleBadges';

// ============================================
// Types
// ============================================

type FactionFilterKey = 'villager' | 'god' | 'wolf' | 'third';

interface FactionTab {
  key: FactionFilterKey;
  label: string;
}

const FACTION_TABS: FactionTab[] = [
  { key: 'god', label: '神' },
  { key: 'wolf', label: '狼人' },
  { key: 'villager', label: '村民' },
  { key: 'third', label: '第三方' },
];

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

function matchesFactionFilter(roleId: RoleId, filter: FactionFilterKey): boolean {
  const spec = ROLE_SPECS[roleId];
  if (filter === 'villager') return spec.faction === Faction.Villager;
  if (filter === 'god') return spec.faction === Faction.God;
  if (filter === 'wolf') return spec.faction === Faction.Wolf;
  return spec.faction === Faction.Special;
}

// ============================================
// Sub-components
// ============================================

const NUM_COLUMNS = 4;
const GRID_GAP = spacing.small;

interface RoleGridItemProps {
  roleId: RoleId;
  factionColor: string;
  itemWidth: number;
  onPress: (roleId: RoleId) => void;
  colors: ThemeColors;
}

const RoleGridItem = React.memo<RoleGridItemProps>(function RoleGridItem({
  roleId,
  factionColor,
  itemWidth,
  onPress,
  colors,
}) {
  const spec = ROLE_SPECS[roleId];
  const styles = gridItemStyles;
  return (
    <Pressable
      testID={TESTIDS.encyclopediaRoleItem(roleId)}
      style={[
        styles.card,
        {
          width: itemWidth,
          borderColor: withAlpha(factionColor, 0.5),
          backgroundColor: withAlpha(factionColor, 0.12),
        },
      ]}
      onPress={() => onPress(roleId)}
    >
      <Image source={getRoleBadge(roleId)} style={styles.badge} />
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {spec.displayName}
      </Text>
    </Pressable>
  );
});

const BADGE_SIZE = componentSizes.avatar.lg;

const gridItemStyles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.tight,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    ...shadows.sm,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    marginBottom: spacing.tight,
  },
  name: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
});

// ============================================
// Main Screen
// ============================================

export const EncyclopediaScreen: React.FC = () => {
  const colors = useColors();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();

  const [activeFilter, setActiveFilter] = useState<FactionFilterKey>('god');
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);

  const allRoleIds = useMemo(() => getAllRoleIds(), []);

  const filteredRoles = useMemo(
    () => allRoleIds.filter((id) => matchesFactionFilter(id, activeFilter)),
    [allRoleIds, activeFilter],
  );

  const contentPadding = spacing.medium;
  const itemWidth = (screenWidth - contentPadding * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleRolePress = useCallback((roleId: RoleId) => {
    setSelectedRole(roleId);
  }, []);

  const handleCloseCard = useCallback(() => {
    setSelectedRole(null);
  }, []);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home' as never);
    }
  }, [navigation]);

  const renderItem = useCallback(
    ({ item }: { item: RoleId }) => (
      <RoleGridItem
        roleId={item}
        factionColor={getFactionColorForRole(item, colors)}
        itemWidth={itemWidth}
        onPress={handleRolePress}
        colors={colors}
      />
    ),
    [colors, itemWidth, handleRolePress],
  );

  const keyExtractor = useCallback((item: RoleId) => item, []);

  const getTabCount = useCallback(
    (key: FactionFilterKey) => allRoleIds.filter((id) => matchesFactionFilter(id, key)).length,
    [allRoleIds],
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
        <View style={styles.headerSpacer} />
      </View>

      {/* Faction Tabs */}
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
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label} · {getTabCount(tab.key)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Role Grid */}
      <FlatList
        data={filteredRoles}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
      />

      {/* Role Detail Modal */}
      <RoleCardSimple
        visible={selectedRole !== null}
        roleId={selectedRole}
        onClose={handleCloseCard}
        showRealIdentity
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
      backgroundColor: colors.background,
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
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
    },
    headerSpacer: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
    },
    // Tabs
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.medium,
      marginTop: spacing.small,
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
    // Grid
    gridContent: {
      paddingHorizontal: spacing.medium,
      paddingBottom: spacing.xlarge,
    },
    gridRow: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
  });
}
