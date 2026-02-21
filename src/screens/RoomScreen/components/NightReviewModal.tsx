/**
 * NightReviewModal - 夜晚行动回顾 Modal（裁判/观战者用）
 *
 * 显示第一天晚上所有行动摘要及全员真实身份。
 * 渲染 Modal UI 并接收预构建的数据，不 import service，不含业务逻辑。
 */
import React, { useMemo } from 'react';
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

import type { NightReviewData } from '../NightReview.helpers';

interface NightReviewModalProps {
  visible: boolean;
  data: NightReviewData;
  onClose: () => void;
}

export const NightReviewModal: React.FC<NightReviewModalProps> = ({ visible, data, onClose }) => {
  const colors = useColors();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const styles = useMemo(
    () => createStyles(colors, screenWidth, screenHeight),
    [colors, screenWidth, screenHeight],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox} testID={TESTIDS.nightReviewModal}>
          <Text style={styles.title}>夜晚行动回顾</Text>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Action summary section */}
            <Text style={styles.sectionTitle}>行动摘要</Text>
            {data.actionLines.map((line, i) => (
              <Text key={`action-${i}`} style={styles.line}>
                {line}
              </Text>
            ))}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Identity table section */}
            <Text style={styles.sectionTitle}>全员身份</Text>
            {data.identityLines.map((line, i) => (
              <Text key={`identity-${i}`} style={styles.line}>
                {line}
              </Text>
            ))}
          </ScrollView>

          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>关闭</Text>
          </TouchableOpacity>
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
      maxHeight: screenHeight * 0.75,
    },
    title: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.medium,
    },
    scrollView: {
      flexGrow: 0,
    },
    sectionTitle: {
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
      marginBottom: spacing.small,
    },
    line: {
      fontSize: typography.secondary,
      color: colors.text,
      lineHeight: typography.secondary * 1.8,
      paddingLeft: spacing.small,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.medium,
    },
    closeButton: {
      marginTop: spacing.medium,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.medium,
      paddingVertical: spacing.medium,
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: typography.body,
      color: colors.textInverse,
      fontWeight: typography.weights.semibold,
    },
  });
}
