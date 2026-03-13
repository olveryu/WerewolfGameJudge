/**
 * NightReviewModal - 夜晚行动回顾 Modal（裁判/观战者用）
 *
 * 显示第一天晚上所有行动摘要及全员真实身份。
 * 支持"分享战报"截图分享。
 * 渲染 Modal UI 并接收预构建的数据，不 import service，不含业务逻辑。
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { UI_ICONS } from '@/config/iconTokens';
import { STATUS_ICONS } from '@/config/iconTokens';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  fixed,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  useColors,
} from '@/theme';
import { roomScreenLog } from '@/utils/logger';

import type { NightReviewData } from '../NightReview.helpers';
import { shareImageBase64 } from '../shareImage';

/**
 * Capture a View as base64 PNG (native: captureRef, web: html2canvas).
 */
async function captureViewAsBase64(ref: React.RefObject<View | null>): Promise<string> {
  if (Platform.OS === 'web') {
    const html2canvas = (await import('html2canvas')).default;
    const node = ref.current as unknown as HTMLElement;
    if (!node) throw new Error('Share card ref not ready');
    const canvas = await html2canvas(node, { backgroundColor: null });
    const dataUrl = canvas.toDataURL('image/png');
    const prefix = 'base64,';
    const idx = dataUrl.indexOf(prefix);
    return idx >= 0 ? dataUrl.slice(idx + prefix.length) : dataUrl;
  }
  return captureRef(ref, { format: 'png', result: 'base64', quality: 1 });
}

interface NightReviewModalProps {
  visible: boolean;
  data: NightReviewData;
  roomNumber: string;
  onClose: () => void;
  /** When provided, shows a "分享给玩家" button (Host only). */
  onShareToPlayers?: () => void;
}

export const NightReviewModal: React.FC<NightReviewModalProps> = ({
  visible,
  data,
  roomNumber,
  onClose,
  onShareToPlayers,
}) => {
  const colors = useColors();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const styles = useMemo(
    () => createStyles(colors, screenWidth, screenHeight),
    [colors, screenWidth, screenHeight],
  );

  const shareCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      await shareImageBase64(
        () => captureViewAsBase64(shareCardRef),
        `room-${roomNumber}-review.png`,
        `狼人杀房间 ${roomNumber} 战报`,
      );
    } catch (e) {
      roomScreenLog.error('Failed to share night review image:', e);
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, roomNumber]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox} testID={TESTIDS.nightReviewModal}>
          {/* Capture area for share screenshot */}
          <View ref={shareCardRef} collapsable={false} style={styles.shareCapture}>
            <Text style={styles.title}>夜晚行动回顾</Text>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Fair play reminder */}
              <Text style={styles.disclaimer}>
                <Ionicons
                  name={STATUS_ICONS.WARNING}
                  size={typography.secondary}
                  color={colors.warning}
                />
                {' 仅供裁判及观战者参考'}
              </Text>

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
          </View>

          {/* Action buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.shareButton, isSharing && styles.buttonDisabled]}
              onPress={handleShare}
              activeOpacity={isSharing ? 1 : fixed.activeOpacity}
              accessibilityState={{ disabled: isSharing }}
              testID={TESTIDS.nightReviewShareButton}
            >
              <Ionicons name={UI_ICONS.SHARE} size={typography.body} color={colors.textInverse} />
              <Text style={styles.shareButtonText}>{isSharing ? '分享中…' : '分享战报'}</Text>
            </TouchableOpacity>
            {onShareToPlayers && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onShareToPlayers}
                activeOpacity={fixed.activeOpacity}
              >
                <Ionicons name="people-outline" size={typography.body} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>分享给玩家</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={fixed.activeOpacity}
              accessibilityLabel="关闭"
            >
              <Text style={styles.closeButtonText}>关闭</Text>
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
      maxHeight: screenHeight * 0.75,
    },
    shareCapture: {
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.medium,
    },
    scrollView: {
      flexGrow: 0,
    },
    sectionTitle: {
      ...textStyles.bodySemibold,
      color: colors.primary,
      marginBottom: spacing.small,
    },
    disclaimer: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.medium,
    },
    line: {
      fontSize: typography.secondary,
      color: colors.text,
      lineHeight: typography.lineHeights.secondary,
      paddingLeft: spacing.small,
    },
    divider: {
      height: fixed.divider,
      backgroundColor: colors.border,
      marginVertical: spacing.medium,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.small,
      marginTop: spacing.medium,
    },
    shareButton: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      paddingVertical: spacing.medium,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.tight,
    },
    shareButtonText: {
      ...textStyles.bodySemibold,
      color: colors.textInverse,
    },
    buttonDisabled: {
      opacity: fixed.disabledOpacity,
    },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: colors.surfaceHover,
      borderRadius: borderRadius.full,
      paddingVertical: spacing.medium,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.tight,
      borderWidth: fixed.borderWidth,
      borderColor: colors.primary,
    },
    secondaryButtonText: {
      ...textStyles.bodySemibold,
      color: colors.primary,
    },
    closeButton: {
      flex: 1,
      backgroundColor: colors.surfaceHover,
      borderRadius: borderRadius.full,
      paddingVertical: spacing.medium,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    closeButtonText: {
      ...textStyles.bodySemibold,
      color: colors.text,
    },
  });
}
