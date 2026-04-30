/**
 * BoardCard — 单张板子卡片（展开/折叠 + 阵营统计 + 关键角色 chip）
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { getPlayerCount, type PresetTemplate } from '@werewolf/game-engine/models/Template';
import React, { useCallback, useMemo } from 'react';
import { LayoutAnimation, Text, TouchableOpacity, View } from 'react-native';

import { BOARD_STRATEGY } from '@/components/BoardStrategy';
import { Button } from '@/components/Button';
import { FactionRoleList } from '@/components/FactionRoleList';
import {
  computeFactionStats,
  FACTION_COLOR_MAP,
  getKeyRoles,
} from '@/screens/ConfigScreen/configHelpers';
import { colors, componentSizes, fixed, layout, spacing, typography, withAlpha } from '@/theme';

import { type BoardPickerStyles } from './BoardPickerScreen.styles';

/** Estimate how many key-role chips fit in a single row. */
export const estimateMaxChips = (screenWidth: number): number => {
  const cardInner = screenWidth - layout.screenPaddingH * 2 - spacing.medium * 2;
  const chipWidth = spacing.small * 2 + 3 * typography.caption + spacing.tight;
  return Math.max(2, Math.floor(cardInner / chipWidth));
};

interface BoardCardProps {
  template: PresetTemplate;
  isExpanded: boolean;
  onToggleExpand: (name: string) => void;
  onSelect: (name: string) => void;
  onRolePress: (roleId: string) => void;
  onStrategyPress: (name: string) => void;
  styles: BoardPickerStyles;
  maxChips: number;
  /** Whether to show the "以此为基础" select button. Defaults to true. */
  showSelectButton?: boolean;
}

export const BoardCard = React.memo<BoardCardProps>(
  ({
    template,
    isExpanded,
    onToggleExpand,
    onSelect,
    onRolePress,
    onStrategyPress,
    styles,
    maxChips,
    showSelectButton = true,
  }) => {
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

    const handleStrategyPress = useCallback(() => {
      onStrategyPress(template.name);
    }, [onStrategyPress, template.name]);

    const hasStrategy = template.name in BOARD_STRATEGY;

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

        {/* Expanded: full role list + action buttons */}
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
            <View style={showSelectButton ? cardActionRowStyle : cardActionRowCenteredStyle}>
              {hasStrategy && (
                <Button
                  variant={showSelectButton ? 'secondary' : 'primary'}
                  size="sm"
                  icon={
                    <Ionicons
                      name="book-outline"
                      size={componentSizes.icon.sm}
                      color={showSelectButton ? colors.text : colors.textInverse}
                    />
                  }
                  onPress={handleStrategyPress}
                >
                  查看攻略
                </Button>
              )}
              {showSelectButton && (
                <Button
                  variant="primary"
                  size="sm"
                  onPress={handleSelect}
                  style={cardSelectButtonStyle}
                >
                  以此为基础
                </Button>
              )}
            </View>
          </View>
        )}
      </View>
    );
  },
);

const cardActionRowStyle = {
  flexDirection: 'row' as const,
  justifyContent: 'space-between' as const,
  alignItems: 'center' as const,
  marginTop: spacing.medium,
  gap: spacing.small,
};

const cardActionRowCenteredStyle = {
  flexDirection: 'row' as const,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  marginTop: spacing.medium,
};

const cardSelectButtonStyle = {
  flex: 1,
};

BoardCard.displayName = 'BoardCard';
