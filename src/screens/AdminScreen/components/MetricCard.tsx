/**
 * MetricCard — Single numeric metric display card
 *
 * Renders a value + label in a card with optional Ionicon.
 * Used by StatsTab (registered/active/games) and AnalyticsTab (avgLoad/avgTTFB).
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, shadows, spacing, typography } from '@/theme';

interface MetricCardProps {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const MetricCardComponent: React.FC<MetricCardProps> = ({ value, label, icon }) => (
  <View style={styles.card}>
    {icon && <Ionicons name={icon} size={18} color={colors.primary} style={styles.icon} />}
    <Text style={styles.value}>{value}</Text>
    <Text style={styles.label}>{label}</Text>
  </View>
);

export const MetricCard = memo(MetricCardComponent);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.medium,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    ...shadows.sm,
  },
  icon: {
    marginBottom: spacing.tight,
  },
  value: {
    fontSize: typography.heading,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  label: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.micro,
  },
});
