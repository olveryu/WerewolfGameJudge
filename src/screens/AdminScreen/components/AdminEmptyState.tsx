/**
 * AdminEmptyState — Unified loading / error / empty placeholder for Admin tabs
 *
 * Renders one of three states based on props. Fail fast: exactly one state must be active.
 */

import type React from 'react';
import { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

interface AdminEmptyStateProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
}

const AdminEmptyStateComponent: React.FC<AdminEmptyStateProps> = ({ loading, error, empty }) => {
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>无数据</Text>
      </View>
    );
  }

  return null;
};

/** 管理页加载/错误/空状态占位。 */
export const AdminEmptyState = memo(AdminEmptyStateComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xlarge,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.caption,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
});
