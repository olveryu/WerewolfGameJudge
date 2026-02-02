/**
 * BoardInfoCard.tsx - Game board configuration display (collapsible)
 */
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../../theme';

export interface BoardInfoCardProps {
  /** Total number of players */
  playerCount: number;
  /** Wolf roles formatted string (e.g., "狼人x2, 狼王x1") */
  wolfRolesText: string;
  /** God roles formatted string */
  godRolesText: string;
  /** Special roles formatted string (optional) */
  specialRolesText?: string;
  /** Number of villagers */
  villagerCount: number;
  /** Whether the card should be collapsed */
  collapsed?: boolean;
}

export const BoardInfoCard: React.FC<BoardInfoCardProps> = ({
  playerCount,
  wolfRolesText,
  godRolesText,
  specialRolesText,
  villagerCount,
  collapsed = false,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [userHasInteracted, setUserHasInteracted] = useState(false);

  // Sync with external collapsed prop only if user hasn't manually interacted
  useEffect(() => {
    if (!userHasInteracted) {
      setIsCollapsed(collapsed);
    }
  }, [collapsed, userHasInteracted]);

  const handleToggle = () => {
    setUserHasInteracted(true);
    setIsCollapsed(!isCollapsed);
  };

  return (
    <View style={styles.boardInfoContainer}>
      <TouchableOpacity style={styles.headerRow} onPress={handleToggle} activeOpacity={0.7}>
        <Text style={styles.boardInfoTitle}>板子配置 ({playerCount}人局)</Text>
        <Text style={styles.collapseIcon}>{isCollapsed ? '▼' : '▲'}</Text>
      </TouchableOpacity>

      {!isCollapsed && (
        <View style={styles.boardInfoContent}>
          <View style={styles.roleCategory}>
            <Text style={styles.roleCategoryLabel}>🐺 狼人：</Text>
            <Text style={styles.roleCategoryText}>{wolfRolesText}</Text>
          </View>
          <View style={styles.roleCategory}>
            <Text style={styles.roleCategoryLabel}>✨ 神职：</Text>
            <Text style={styles.roleCategoryText}>{godRolesText}</Text>
          </View>
          {Boolean(specialRolesText) && (
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>🎭 特殊：</Text>
              <Text style={styles.roleCategoryText}>{specialRolesText}</Text>
            </View>
          )}
          {villagerCount > 0 && (
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>👤 村民：</Text>
              <Text style={styles.roleCategoryText}>
                {villagerCount > 1 ? `村民×${villagerCount}` : '村民'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    boardInfoContainer: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.medium,
      marginBottom: spacing.medium,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    boardInfoTitle: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
    },
    collapseIcon: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
    },
    boardInfoContent: {
      marginTop: spacing.small,
      gap: spacing.tight,
    },
    roleCategory: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    roleCategoryLabel: {
      fontSize: typography.secondary,
      fontWeight: '600',
      color: colors.textSecondary,
      width: spacing.xxlarge * 2 + spacing.tight, // ~70
    },
    roleCategoryText: {
      flex: 1,
      fontSize: typography.secondary,
      color: colors.text,
      lineHeight: typography.title, // ~20
    },
  });
}

export default BoardInfoCard;
