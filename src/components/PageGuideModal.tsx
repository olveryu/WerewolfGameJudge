/**
 * PageGuideModal — 页面级新手引导弹窗
 *
 * 居中卡片 + 标题 + 要点列表 + "下次不再显示"复选框 + "知道了"按钮。
 * 弹出: scale(0.9→1) + fadeIn 250ms spring。关闭: fadeOut 200ms。
 * 纯展示组件，接收 visible / items / callbacks。不 import service，不含业务逻辑。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { TESTIDS } from '@/testids';
import {
  borderRadius,
  componentSizes,
  fixed,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  useColors,
} from '@/theme';

// ============================================
// Types
// ============================================

export interface GuideItem {
  emoji: string;
  text: string;
}

interface PageGuideModalProps {
  visible: boolean;
  title: string;
  titleEmoji: string;
  items: readonly GuideItem[];
  dontShowAgain: boolean;
  onToggleDontShowAgain: () => void;
  onDismiss: () => void;
}

// ============================================
// Animation constants
// ============================================

const OPEN_DURATION = 250;
const CLOSE_DURATION = 200;
const SCALE_FROM = 0.9;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// ============================================
// Component
// ============================================

export const PageGuideModal: React.FC<PageGuideModalProps> = ({
  visible,
  title,
  titleEmoji,
  items,
  dontShowAgain,
  onToggleDontShowAgain,
  onDismiss,
}) => {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors, screenWidth), [colors, screenWidth]);

  // Animation values — lazy-initialized, stable across renders
  const [anim] = useState(() => ({
    overlay: new Animated.Value(0),
    scale: new Animated.Value(SCALE_FROM),
    opacity: new Animated.Value(0),
  }));

  // Track internal modal visibility for close animation
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      // Reset values
      anim.overlay.setValue(0);
      anim.scale.setValue(SCALE_FROM);
      anim.opacity.setValue(0);
      // Animate in
      Animated.parallel([
        Animated.timing(anim.overlay, {
          toValue: 1,
          duration: OPEN_DURATION,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(anim.scale, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: OPEN_DURATION,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
  }, [visible, anim]);

  const handleDismiss = useCallback(() => {
    // Animate out
    Animated.parallel([
      Animated.timing(anim.overlay, {
        toValue: 0,
        duration: CLOSE_DURATION,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(anim.opacity, {
        toValue: 0,
        duration: CLOSE_DURATION,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      setModalVisible(false);
      onDismiss();
    });
  }, [anim, onDismiss]);

  if (!modalVisible) return null;

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={handleDismiss}>
      <Animated.View style={[styles.overlay, { opacity: anim.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDismiss}
          testID={TESTIDS.pageGuideOverlay}
        />
        <Animated.View
          style={[styles.card, { opacity: anim.opacity, transform: [{ scale: anim.scale }] }]}
          testID={TESTIDS.pageGuideModal}
        >
          {/* Title */}
          <View style={styles.titleRow}>
            <Text style={styles.titleEmoji}>{titleEmoji}</Text>
            <Text style={styles.titleText} testID={TESTIDS.pageGuideTitle}>
              {title}
            </Text>
          </View>

          {/* Guide items */}
          <View style={styles.itemList}>
            {items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
                <Text style={styles.itemText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Don't show again checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={onToggleDontShowAgain}
            activeOpacity={fixed.activeOpacity}
            testID={TESTIDS.pageGuideCheckbox}
          >
            <View style={[styles.checkbox, dontShowAgain && styles.checkboxChecked]}>
              {dontShowAgain && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>下次不再显示</Text>
          </TouchableOpacity>

          {/* Dismiss button */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            activeOpacity={fixed.activeOpacity}
            testID={TESTIDS.pageGuideDismissBtn}
          >
            <Text style={styles.dismissButtonText}>知道了</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ============================================
// Styles
// ============================================

function createStyles(colors: ThemeColors, screenWidth: number) {
  const CHECKBOX_SIZE = componentSizes.icon.md;

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xlarge,
      padding: spacing.large,
      minWidth: componentSizes.modal.minWidth,
      maxWidth: Math.min(screenWidth * 0.85, fixed.maxContentWidth),
      width: screenWidth * 0.85,
      ...shadows.lg,
    },
    // Title
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.small,
      marginBottom: spacing.medium,
    },
    titleEmoji: {
      fontSize: typography.heading,
    },
    titleText: {
      ...textStyles.subtitleSemibold,
      color: colors.text,
    },
    // Items
    itemList: {
      gap: spacing.small,
      marginBottom: spacing.large,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.small,
    },
    itemEmoji: {
      fontSize: typography.body,
      width: componentSizes.icon.md,
      textAlign: 'center',
      flexShrink: 0,
    },
    itemText: {
      flex: 1,
      flexShrink: 1,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.normal,
      color: colors.textSecondary,
    },
    // Checkbox
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      minHeight: fixed.minTouchTarget,
      marginBottom: spacing.medium,
    },
    checkbox: {
      width: CHECKBOX_SIZE,
      height: CHECKBOX_SIZE,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.border,
      borderRadius: borderRadius.small,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkmark: {
      fontSize: typography.caption,
      color: colors.textInverse,
      fontWeight: typography.weights.bold,
    },
    checkboxLabel: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textMuted,
    },
    // Button
    dismissButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      paddingVertical: spacing.medium,
      alignItems: 'center',
    },
    dismissButtonText: {
      ...textStyles.bodySemibold,
      color: colors.textInverse,
    },
  });
}
