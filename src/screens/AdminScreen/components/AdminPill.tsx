/**
 * AdminPill — Reusable pill/chip toggle for Admin Portal
 *
 * Used by tab bar, sort pills, filter chips, time preset selectors.
 * Renders active/inactive visual state. Parent owns selection logic.
 */

import type React from 'react';
import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { borderRadius, colors, spacing, typography } from '@/theme';

interface AdminPillProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

const AdminPillComponent: React.FC<AdminPillProps> = ({ label, isActive, onPress }) => (
  <PressableScale style={[styles.pill, isActive && styles.pillActive]} onPress={onPress}>
    <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{label}</Text>
  </PressableScale>
);

export const AdminPill = memo(AdminPillComponent);

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.textInverse,
  },
});
