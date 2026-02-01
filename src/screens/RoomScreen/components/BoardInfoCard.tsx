/**
 * BoardInfoCard.tsx - Game board configuration display
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
}

export const BoardInfoCard: React.FC<BoardInfoCardProps> = ({
  playerCount,
  wolfRolesText,
  godRolesText,
  specialRolesText,
  villagerCount,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.boardInfoContainer}>
      <Text style={styles.boardInfoTitle}>板子配置 ({playerCount}人局)</Text>
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
            <Text style={styles.roleCategoryText}>{villagerCount}人</Text>
          </View>
        )}
      </View>
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
    boardInfoTitle: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.small,
    },
    boardInfoContent: {
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
      width: 70,
    },
    roleCategoryText: {
      flex: 1,
      fontSize: typography.secondary,
      color: colors.text,
      lineHeight: 20,
    },
  });
}

export default BoardInfoCard;
