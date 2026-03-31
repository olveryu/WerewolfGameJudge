/**
 * ShareReviewModal - 分享详细信息座位选择 Modal
 *
 * Host 在 ended 阶段选择允许查看「详细信息」的座位。
 * 纯展示组件：渲染多选座位列表 + 确认/取消按钮，通过回调上报选择结果。
 * 不 import service，不含业务逻辑。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  fixed,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  useColors,
  withAlpha,
} from '@/theme';

interface SeatInfo {
  /** 0-based seat index */
  seat: number;
  displayName: string;
}

interface ShareReviewModalProps {
  visible: boolean;
  seats: SeatInfo[];
  /** 当前已授权的座位（用于回显） */
  currentAllowedSeats: readonly number[];
  onConfirm: (selectedSeats: number[]) => void | Promise<void>;
  onClose: () => void;
}

export const ShareReviewModal: React.FC<ShareReviewModalProps> = ({
  visible,
  seats,
  currentAllowedSeats,
  onConfirm,
  onClose,
}) => {
  const colors = useColors();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const contentStyle = useMemo(
    () => ({ width: screenWidth * 0.88, maxHeight: screenHeight * 0.7 }),
    [screenWidth, screenHeight],
  );

  // Visible seat numbers — used to filter out stale entries (e.g. host's own seat)
  const visibleSeatSet = useMemo(() => new Set(seats.map((s) => s.seat)), [seats]);

  // Initialize selection from currentAllowedSeats (filtered to visible seats)
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(currentAllowedSeats.filter((s) => visibleSeatSet.has(s))),
  );
  const [submitting, setSubmitting] = useState(false);

  // Sync selection with currentAllowedSeats each time modal opens
  useEffect(() => {
    if (visible) {
      setSelected(new Set(currentAllowedSeats.filter((s) => visibleSeatSet.has(s))));
      setSubmitting(false);
    }
  }, [visible, currentAllowedSeats, visibleSeatSet]);

  const toggleSeat = useCallback((seat: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat)) {
        next.delete(seat);
      } else {
        next.add(seat);
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(Array.from(selected).sort((a, b) => a - b));
    } finally {
      setSubmitting(false);
    }
  }, [onConfirm, selected, submitting]);

  const selectedCount = selected.size;

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      contentStyle={contentStyle}
      testID={TESTIDS.shareReviewModal}
    >
      <Text style={styles.title}>分享详细信息</Text>
      <Text style={styles.subtitle}>选择可查看「详细信息」的玩家</Text>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {seats.map(({ seat, displayName }) => {
          const isSelected = selected.has(seat);
          return (
            <TouchableOpacity
              key={String(seat)}
              style={[styles.seatRow, isSelected && styles.seatRowSelected]}
              onPress={() => toggleSeat(seat)}
              activeOpacity={fixed.activeOpacity}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.seatLabel}>
                {seat + 1}号 {displayName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onClose}
          activeOpacity={fixed.activeOpacity}
        >
          <Text style={styles.cancelButtonText}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={submitting}
        >
          <Text style={styles.confirmButtonText}>
            {submitting ? '提交中…' : `确认${selectedCount > 0 ? `（${selectedCount}人）` : ''}`}
          </Text>
        </TouchableOpacity>
      </View>
    </BaseCenterModal>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    title: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.tight,
    },
    subtitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.medium,
    },
    scrollView: {
      flex: 1,
      marginBottom: spacing.medium,
    },
    seatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.medium,
      borderRadius: borderRadius.medium,
      marginBottom: spacing.tight,
    },
    seatRowSelected: {
      backgroundColor: withAlpha(colors.primary, 0.125),
    },
    checkbox: {
      width: spacing.large,
      height: spacing.large,
      borderRadius: borderRadius.small,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.medium,
    },
    checkboxSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkmark: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textInverse,
      fontWeight: typography.weights.bold,
    },
    seatLabel: {
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      color: colors.text,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.medium,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: colors.surfaceHover,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      paddingVertical: spacing.medium,
      alignItems: 'center',
    },
    cancelButtonText: {
      ...textStyles.bodySemibold,
      color: colors.text,
    },
    confirmButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      paddingVertical: spacing.medium,
      alignItems: 'center',
    },
    confirmButtonDisabled: {
      opacity: fixed.disabledOpacity,
    },
    confirmButtonText: {
      ...textStyles.bodySemibold,
      color: colors.textInverse,
    },
  });
}
