/**
 * FactionChip - Faction-colored rounded chip displaying a role name.
 *
 * Two sizes: `sm` (caption font, for TemplatePicker), `md` (secondary font, for RoomScreen).
 * Rounded rectangle + surfaceHover background + faction-color border/text.
 * Renders TouchableOpacity when `onPress` is provided, otherwise renders plain View.
 * Pure presentation component; does not import service, contains no business logic.
 */
import { memo, useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { Text, TouchableOpacity, View } from 'react-native';

import { borderRadius, colors, fixed, spacing, typography } from '@/theme';

type ChipSize = 'sm' | 'md';

interface FactionChipProps {
  /** Display text (role name, optionally with ×count) */
  label: string;
  /** Faction color token value (e.g. colors.wolf) */
  color: string;
  /** sm = caption font (TemplatePicker), md = secondary font (RoomScreen). Default: sm */
  size?: ChipSize;
  /** When provided, chip becomes touchable */
  onPress?: () => void;
}

const BASE_CHIP: ViewStyle = {
  borderRadius: borderRadius.small,
  borderWidth: fixed.borderWidth,
};

const SIZE_CHIP: Record<ChipSize, ViewStyle> = {
  sm: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
  },
  md: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
  },
};

const SIZE_TEXT: Record<ChipSize, TextStyle> = {
  sm: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.medium,
  },
  md: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
  },
};

export const FactionChip = memo<FactionChipProps>(({ label, color, size = 'sm', onPress }) => {
  const chipStyle = useMemo<ViewStyle[]>(
    () => [
      BASE_CHIP,
      SIZE_CHIP[size],
      { borderColor: color, backgroundColor: colors.surfaceHover },
    ],
    [color, size],
  );

  const textStyle = useMemo<TextStyle[]>(() => [SIZE_TEXT[size], { color }], [color, size]);

  const content = <Text style={textStyle}>{label}</Text>;

  return onPress ? (
    <TouchableOpacity style={chipStyle} activeOpacity={fixed.activeOpacity} onPress={onPress}>
      {content}
    </TouchableOpacity>
  ) : (
    <View style={chipStyle}>{content}</View>
  );
});

FactionChip.displayName = 'FactionChip';
