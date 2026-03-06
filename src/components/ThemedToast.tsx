/**
 * ThemedToast - iOS capsule 风格 Toast 通知组件
 *
 * 使用 react-native-toast-message 自定义 renderer（非 BaseToast），
 * pill 形状，水平 icon + 文字，跟随当前主题色。
 *
 * Does not contain business logic — purely presentational wiring.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast, { type ToastConfigParams } from 'react-native-toast-message';

import { useTheme } from '@/theme';
import type { ThemeColors } from '@/theme/themes';
import { borderRadius, shadows, spacing, typography } from '@/theme/tokens';

const ICON_SIZE = 18;

/** Toast 类型与 Ionicons 名称映射 */
const TOAST_ICONS = {
  success: 'checkmark-circle' as const,
  error: 'alert-circle' as const,
  info: 'information-circle' as const,
};

const styles = StyleSheet.create({
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: borderRadius.full,
    gap: spacing.small,
    maxWidth: '90%',
    ...shadows.md,
  },
  text1: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
    flexShrink: 1,
  },
  text2: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    flexShrink: 1,
  },
});

function capsuleToast(
  colors: ThemeColors,
  accentColor: string,
  iconName: (typeof TOAST_ICONS)[keyof typeof TOAST_ICONS],
  displayName: string,
) {
  const CapsuleToast = ({ text1, text2 }: ToastConfigParams<unknown>) => (
    <View style={[styles.capsule, { backgroundColor: colors.card }]}>
      <Ionicons name={iconName} size={ICON_SIZE} color={accentColor} />
      {text1 ? <Text style={[styles.text1, { color: colors.text }]}>{text1}</Text> : null}
      {text2 ? <Text style={[styles.text2, { color: colors.textSecondary }]}>{text2}</Text> : null}
    </View>
  );
  CapsuleToast.displayName = displayName;
  return CapsuleToast;
}

export function ThemedToast() {
  const { colors } = useTheme();

  const toastConfig = useMemo(
    () => ({
      success: capsuleToast(colors, colors.success, TOAST_ICONS.success, 'SuccessToast'),
      error: capsuleToast(colors, colors.error, TOAST_ICONS.error, 'ErrorToast'),
      info: capsuleToast(colors, colors.info, TOAST_ICONS.info, 'InfoToast'),
    }),
    [colors],
  );

  return <Toast config={toastConfig} />;
}
