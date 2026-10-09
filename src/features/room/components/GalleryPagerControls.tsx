/**
 * GalleryPagerControls - 回看翻页控制条（本地翻页，游戏无关）。
 *
 * 形态统一：共享 Button 的 icon 形态（chevron）+ 独立的位置文本「N / M」。
 * 只吃展示状态与回调，不认识任何游戏命令；翻到哪一页由游戏侧维护。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Button } from '@/components/Button';
import { colors, componentSizes, spacing, textStyles } from '@/theme';

interface GalleryPagerControlsProps {
  /** 当前页（0 起）。 */
  readonly current: number;
  /** 总页数。 */
  readonly total: number;
  /** 上一页按钮的无障碍文案（如「上一本」「上一篇故事」）。 */
  readonly prevLabel: string;
  /** 下一页按钮的无障碍文案。 */
  readonly nextLabel: string;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  /** 根容器附加样式（如停靠栏的边框/内边距），由游戏侧提供。 */
  readonly style?: StyleProp<ViewStyle>;
}

export const GalleryPagerControls: React.FC<GalleryPagerControlsProps> = ({
  current,
  total,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  style,
}) => (
  <View style={[styles.row, style]}>
    <Button variant="icon" accessibilityLabel={prevLabel} disabled={current <= 0} onPress={onPrev}>
      <Ionicons name="chevron-back" size={componentSizes.icon.md} color={colors.text} />
    </Button>
    <Text style={styles.position}>
      {current + 1} / {total}
    </Text>
    <Button
      variant="icon"
      accessibilityLabel={nextLabel}
      disabled={current >= total - 1}
      onPress={onNext}
    >
      <Ionicons name="chevron-forward" size={componentSizes.icon.md} color={colors.text} />
    </Button>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.medium,
  },
  position: {
    ...textStyles.bodySemibold,
    minWidth: 72,
    color: colors.text,
    textAlign: 'center',
  },
});
