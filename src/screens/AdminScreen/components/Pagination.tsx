/**
 * Pagination — Page navigation control for Admin lists
 *
 * Renders ← page / total → with chevron icons.
 * Used by UsersTab and RoomsTab.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { borderRadius, colors, componentSizes, spacing, typography } from '@/theme';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const PaginationComponent: React.FC<PaginationProps> = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <View style={styles.container}>
      <PressableScale
        style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
        onPress={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        <Ionicons name="chevron-back" size={componentSizes.icon.md} color={colors.text} />
      </PressableScale>
      <Text style={styles.pageInfo}>
        {page} / {totalPages}
      </Text>
      <PressableScale
        style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
        onPress={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
      >
        <Ionicons name="chevron-forward" size={componentSizes.icon.md} color={colors.text} />
      </PressableScale>
    </View>
  );
};

export const Pagination = memo(PaginationComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.medium,
    paddingVertical: spacing.small,
  },
  pageBtn: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
  },
  pageBtnDisabled: {
    opacity: 0.3,
  },
  pageInfo: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
});
