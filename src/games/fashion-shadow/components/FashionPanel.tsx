/** FashionPanel — reusable cyber-noir content surface for Fashion Shadow screens. */
import type React from 'react';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { borderRadius, fixed, spacing } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

type FashionPanelTone = 'neutral' | 'pink' | 'cyan' | 'success' | 'danger';

interface FashionPanelProps extends PropsWithChildren {
  readonly tone?: FashionPanelTone;
  readonly style?: ViewStyle;
}

const toneStyles: Readonly<Record<FashionPanelTone, ViewStyle>> = {
  neutral: { borderColor: fashionShadowColors.border },
  pink: {
    borderColor: fashionShadowColors.neonPink,
    backgroundColor: fashionShadowColors.surfaceMuted,
  },
  cyan: {
    borderColor: fashionShadowColors.neonCyan,
    backgroundColor: fashionShadowColors.surfaceMuted,
  },
  success: {
    borderColor: fashionShadowColors.success,
    backgroundColor: fashionShadowColors.successSoft,
  },
  danger: {
    borderColor: fashionShadowColors.danger,
    backgroundColor: fashionShadowColors.dangerSoft,
  },
};

export const FashionPanel: React.FC<FashionPanelProps> = ({
  children,
  tone = 'neutral',
  style,
}) => <View style={[styles.panel, toneStyles[tone], style]}>{children}</View>;

const styles = StyleSheet.create({
  panel: {
    backgroundColor: fashionShadowColors.surfaceMuted,
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    padding: spacing.large,
    gap: spacing.small,
    overflow: 'hidden',
  },
});
