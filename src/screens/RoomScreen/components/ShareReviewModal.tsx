/**
 * ShareReviewModal - 分享详细信息座位选择 Modal
 *
 * Host 在 ended 阶段选择允许查看「详细信息」的座位。
 * 纯展示组件：渲染多选座位列表 + 确认/取消按钮，通过回调上报选择结果。
 * 不 import service，不含业务逻辑。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { TESTIDS } from '@/testids';
import { borderRadius, spacing, type ThemeColors, typography, useColors } from '@/theme';

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
  onConfirm: (selectedSeats: number[]) => void;
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
  const styles = useMemo(
    () => createStyles(colors, screenWidth, screenHeight),
    [colors, screenWidth, screenHeight],
  );

  // Initialize selection from currentAllowedSeats when modal opens
  const [selected, setSelected] = useState<Set<number>>(() => new Set(currentAllowedSeats));

  // Sync selection with currentAllowedSeats each time modal opens
  useEffect(() => {
    if (visible) {
      setSelected(new Set(currentAllowedSeats));
    }
  }, [visible, currentAllowedSeats]);

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

  const handleConfirm = useCallback(() => {
    onConfirm(Array.from(selected).sort((a, b) => a - b));
  }, [onConfirm, selected]);

  const selectedCount = selected.size;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox} testID={TESTIDS.shareReviewModal}>
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
                  activeOpacity={0.7}
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
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>
                确认{selectedCount > 0 ? `（${selectedCount}人）` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

function createStyles(colors: ThemeColors, screenWidth: number, screenHeight: number) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalBox: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.large,
      width: screenWidth * 0.88,
      maxHeight: screenHeight * 0.7,
    },
    title: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.tight,
    },
    subtitle: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.medium,
    },
    scrollView: {
      flexGrow: 0,
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
      backgroundColor: `${colors.primary}15`,
    },
    checkbox: {
      width: spacing.large,
      height: spacing.large,
      borderRadius: borderRadius.small,
      borderWidth: 2,
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
      color: colors.textInverse,
      fontWeight: typography.weights.bold,
    },
    seatLabel: {
      fontSize: typography.body,
      color: colors.text,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.medium,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: colors.surfaceHover,
      borderRadius: borderRadius.medium,
      paddingVertical: spacing.medium,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: typography.body,
      color: colors.textSecondary,
      fontWeight: typography.weights.semibold,
    },
    confirmButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.medium,
      paddingVertical: spacing.medium,
      alignItems: 'center',
    },
    confirmButtonText: {
      fontSize: typography.body,
      color: colors.textInverse,
      fontWeight: typography.weights.semibold,
    },
  });
}
