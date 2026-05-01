/**
 * ScreenHeader — 通用 Screen 头部组件
 *
 * 采用 absoluteFill 居中方案（同 RoomScreen），标题始终绝对居中，
 * 不受左右按钮宽度差异影响。左侧默认渲染返回按钮。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors } from '@/theme';
import { componentSizes, fixed, layout, spacing, typography } from '@/theme/tokens';

import { Button } from './Button';

interface ScreenHeaderProps {
  /** 标题文字 */
  title: string;
  /** 返回按钮回调 */
  onBack: () => void;
  /** 右侧自定义内容 */
  headerRight?: React.ReactNode;
  /** 安全区顶部偏移（insets.top） */
  topInset: number;
  /** 返回按钮 testID */
  backTestID?: string;
  /** 返回按钮 accessibilityLabel */
  backAccessibilityLabel?: string;
  /** header 容器额外样式 */
  style?: ViewStyle;
}

export const ScreenHeader = memo<ScreenHeaderProps>(function ScreenHeader({
  title,
  onBack,
  headerRight,
  topInset,
  backTestID,
  backAccessibilityLabel = '返回',
  style,
}) {
  return (
    <View style={[styles.header, { paddingTop: topInset + layout.headerPaddingV }, style]}>
      <View style={styles.sideContainer}>
        <Button
          variant="icon"
          onPress={onBack}
          testID={backTestID}
          accessibilityLabel={backAccessibilityLabel}
        >
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </Button>
      </View>
      <View style={styles.centerContainer}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.sideContainer}>{headerRight}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenH,
    paddingVertical: layout.headerPaddingV,
    backgroundColor: colors.surface,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  sideContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  title: {
    fontSize: layout.headerTitleSize,
    lineHeight: layout.headerTitleLineHeight,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
});
