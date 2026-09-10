/** FashionVoteProgress — count-only submission meter; never exposes hidden vote choices. */
import { FASHION_PLAYER_COUNT } from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

interface FashionVoteProgressProps {
  readonly submitted: number;
  readonly label: string;
  readonly tone?: 'cyan' | 'pink';
}

export const FashionVoteProgress: React.FC<FashionVoteProgressProps> = ({
  submitted,
  label,
  tone = 'cyan',
}) => (
  <View style={styles.frame}>
    <View style={styles.headerRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={tone === 'pink' ? styles.countPink : styles.countCyan}>
        {submitted}/{FASHION_PLAYER_COUNT}
      </Text>
    </View>
    <View style={styles.cells}>
      {Array.from({ length: FASHION_PLAYER_COUNT }, (_, index) => (
        <View
          key={index}
          style={[
            styles.cell,
            index < submitted ? (tone === 'pink' ? styles.cellPink : styles.cellCyan) : null,
          ]}
        />
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  frame: {
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    backgroundColor: fashionShadowColors.surfaceRaised,
    padding: spacing.medium,
    gap: spacing.small,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  label: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  countCyan: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
  },
  countPink: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
  },
  cells: {
    flexDirection: 'row',
    gap: spacing.tight,
  },
  cell: {
    flex: 1,
    height: spacing.tight,
    borderRadius: borderRadius.full,
    backgroundColor: fashionShadowColors.border,
  },
  cellCyan: {
    backgroundColor: fashionShadowColors.neonCyan,
  },
  cellPink: {
    backgroundColor: fashionShadowColors.neonPink,
  },
});
