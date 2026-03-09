/**
 * FactionChip — 阵营色圆角 chip，展示角色名称。
 *
 * 两个尺寸：`sm`（caption 字号，用于 TemplatePicker）、`md`（secondary 字号，用于 RoomScreen）。
 * 圆角矩形 + surfaceHover 背景 + 阵营色边框/文字。
 * 当 `onPress` 存在时渲染 TouchableOpacity，否则渲染普通 View。
 * 纯展示组件，不 import service，不包含业务逻辑。
 */
import { memo, useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { Text, TouchableOpacity, View } from 'react-native';

import { borderRadius, spacing, typography, useColors } from '@/theme';
import { fixed } from '@/theme/tokens';

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
    paddingVertical: spacing.tight / 2,
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
  const colors = useColors();
  const chipStyle = useMemo<ViewStyle[]>(
    () => [
      BASE_CHIP,
      SIZE_CHIP[size],
      { borderColor: color, backgroundColor: colors.surfaceHover },
    ],
    [color, colors.surfaceHover, size],
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
