/**
 * CollectionScreen — 角色收集图鉴
 *
 * 按阵营分组展示 43 个角色的收集状态。已收集角色显示彩色徽章 + 首次体验日期，
 * 未收集显示灰色锁定样式。支持阵营精通（全阵营收集完成显示标记）。
 * 数据来源于 StatsService.fetchUserCollection()。
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Faction,
  getAllRoleIds,
  getRoleSpec,
  type RoleId,
} from '@werewolf/game-engine/models/roles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, SectionList, type SectionListData, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { RootStackParamList } from '@/navigation/types';
import { fetchUserCollection } from '@/services/feature/StatsService';
import {
  borderRadius,
  componentSizes,
  createSharedStyles,
  fixed,
  layout,
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

interface FactionSection {
  faction: Faction;
  label: string;
  colorKey: 'god' | 'wolf' | 'villager' | 'third';
}

const FACTION_SECTIONS: readonly FactionSection[] = [
  { faction: Faction.God, label: '神职', colorKey: 'god' },
  { faction: Faction.Wolf, label: '狼人', colorKey: 'wolf' },
  { faction: Faction.Villager, label: '村民', colorKey: 'villager' },
  { faction: Faction.Special, label: '第三方', colorKey: 'third' },
] as const;

interface RoleItem {
  roleId: RoleId;
  name: string;
  faction: Faction;
  collected: boolean;
  firstPlayedAt: string | null;
}

type SectionData = SectionListData<
  RoleItem,
  { title: string; colorKey: string; mastered: boolean }
>;

// ============================================
// Component
// ============================================

export const CollectionScreen: React.FC = () => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated } = useAuth();

  const [collectedSet, setCollectedSet] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetchUserCollection()
      .then((data) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const r of data.roles) {
          map.set(r.roleId, r.firstPlayedAt);
        }
        setCollectedSet(map);
      })
      .catch(() => {
        // silently fail — collection is non-critical
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const allRoleIds = useMemo(() => getAllRoleIds(), []);

  const sections: SectionData[] = useMemo(() => {
    return FACTION_SECTIONS.map((fs) => {
      const roles: RoleItem[] = allRoleIds
        .filter((id) => getRoleSpec(id).faction === fs.faction)
        .map((id) => ({
          roleId: id,
          name: getRoleSpec(id).displayName,
          faction: fs.faction,
          collected: collectedSet.has(id),
          firstPlayedAt: collectedSet.get(id) ?? null,
        }));
      const mastered = roles.length > 0 && roles.every((r) => r.collected);
      return {
        title: fs.label,
        colorKey: fs.colorKey,
        mastered,
        data: roles,
      };
    });
  }, [allRoleIds, collectedSet]);

  const totalCollected = collectedSet.size;
  const totalRoles = allRoleIds.length;

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => {
      const collected = section.data.filter((r) => r.collected).length;
      const total = section.data.length;
      const factionColor = colors[section.colorKey as keyof ThemeColors] as string;
      return (
        <View style={[styles.sectionHeader, { borderLeftColor: factionColor }]}>
          <Text style={[styles.sectionTitle, { color: factionColor }]}>{section.title}</Text>
          <Text style={styles.sectionCount}>
            {collected}/{total}
            {section.mastered ? ' ✅' : ''}
          </Text>
        </View>
      );
    },
    [colors, styles],
  );

  const renderItem = useCallback(
    ({ item }: { item: RoleItem }) => {
      const factionColor = colors[
        FACTION_SECTIONS.find((f) => f.faction === item.faction)?.colorKey ?? 'god'
      ] as string;
      return (
        <View style={styles.roleCard}>
          <View style={[styles.badgeContainer, !item.collected && styles.badgeContainerLocked]}>
            <Image source={getRoleBadge(item.roleId)} style={styles.badge} />
            {!item.collected && (
              <View style={styles.lockOverlay}>
                <Ionicons name="lock-closed" size={typography.body} color={colors.textMuted} />
              </View>
            )}
          </View>
          <View style={styles.roleInfo}>
            <Text
              style={[
                styles.roleName,
                item.collected ? { color: factionColor } : styles.roleNameLocked,
              ]}
            >
              {item.name}
            </Text>
            {item.collected && item.firstPlayedAt ? (
              <Text style={styles.roleDate}>
                {new Date(item.firstPlayedAt).toLocaleDateString('zh-CN')}
              </Text>
            ) : (
              <Text style={styles.roleDateLocked}>未解锁</Text>
            )}
          </View>
        </View>
      );
    },
    [colors, styles],
  );

  const keyExtractor = useCallback((item: RoleItem) => item.roleId, []);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={[styles.header, { paddingTop: insets.top + layout.headerPaddingV }]}>
        <Button variant="icon" onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </Button>
        <Text style={styles.headerTitle}>角色收集</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          已收集 {totalCollected}/{totalRoles}
        </Text>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${totalRoles > 0 ? (totalCollected / totalRoles) * 100 : 0}%` },
            ]}
          />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
};

// ============================================
// Styles
// ============================================

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.screenH,
      paddingVertical: layout.headerPaddingV,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      flex: 1,
      fontSize: layout.headerTitleSize,
      lineHeight: layout.headerTitleLineHeight,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
    },
    headerSpacer: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
    },
    summaryBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.screenH,
      paddingVertical: spacing.medium,
      backgroundColor: colors.surface,
      gap: spacing.medium,
    },
    summaryText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
    },
    progressBarBg: {
      flex: 1,
      height: 6,
      backgroundColor: colors.border,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
    },
    list: {
      flex: 1,
    },
    listContent: {
      padding: spacing.screenH,
      paddingBottom: spacing.xxlarge,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.small,
      marginTop: spacing.medium,
      marginBottom: spacing.small,
      borderLeftWidth: 3,
    },
    sectionTitle: {
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.semibold,
    },
    sectionCount: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
    },
    roleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      ...createSharedStyles(colors).cardBase,
      marginBottom: spacing.small,
      padding: spacing.medium,
      gap: spacing.medium,
    },
    badgeContainer: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
      borderRadius: borderRadius.medium,
      overflow: 'hidden',
    },
    badgeContainerLocked: {
      opacity: 0.3,
    },
    badge: {
      width: '100%',
      height: '100%',
      borderRadius: borderRadius.medium,
    },
    lockOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: withAlpha(colors.background, 0.6),
      borderRadius: borderRadius.medium,
    },
    roleInfo: {
      flex: 1,
      gap: spacing.micro,
    },
    roleName: {
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.medium,
    },
    roleNameLocked: {
      color: colors.textMuted,
    },
    roleDate: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
    },
    roleDateLocked: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textMuted,
    },
  });
