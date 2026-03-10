/**
 * SettingsOptionCard — 设置面板动画选项卡片（图标 + 名称 + 短描述）
 *
 * 垂直布局：Ionicons 图标 → 中文名称 → 短描述。
 * 基于 PressableScale 提供 iOS 风格弹簧缩放微动效。
 * 支持 selected / unselected 状态，"关闭"项视觉低调（textMuted），"随机"项展示解析结果。
 * 纯 UI 组件：接收样式 props 和 onPress 回调，不 import service，不包含业务逻辑。
 */
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { Text, type TextStyle, View, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/PressableScale';

import type { AnimationOptionConfig } from './animationOptions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsOptionCardStyles {
  card: ViewStyle;
  cardSelected: ViewStyle;
  cardNone: ViewStyle;
  iconWrap: ViewStyle;
  label: TextStyle;
  labelSelected: TextStyle;
  labelNone: TextStyle;
  desc: TextStyle;
  descSelected: TextStyle;
  descNone: TextStyle;
  resolvedHint: TextStyle;
}

interface SettingsOptionCardProps {
  option: AnimationOptionConfig;
  selected: boolean;
  onSelect: (value: string) => void;
  styles: SettingsOptionCardStyles;
  /** 图标颜色（未选中态） */
  iconColor: string;
  /** 图标颜色（选中态） */
  iconColorSelected: string;
  /** 图标颜色（"关闭"项） */
  iconColorNone: string;
  /** 图标尺寸 */
  iconSize: number;
  /** 当选项为"随机"且被选中时，显示的解析结果文案（如"本局: 轮盘"） */
  resolvedHint?: string;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SettingsOptionCard = memo<SettingsOptionCardProps>(function SettingsOptionCard({
  option,
  selected,
  onSelect,
  styles,
  iconColor,
  iconColorSelected,
  iconColorNone,
  iconSize,
  resolvedHint,
  testID,
}) {
  const handlePress = useCallback(() => {
    onSelect(option.value);
  }, [onSelect, option.value]);

  const isNone = option.isNone === true;

  // Resolve style variants
  const cardStyle = [styles.card, selected && styles.cardSelected, isNone && styles.cardNone];

  const labelStyle = [
    styles.label,
    selected && styles.labelSelected,
    isNone && !selected && styles.labelNone,
  ];

  const descStyle = [
    styles.desc,
    selected && styles.descSelected,
    isNone && !selected && styles.descNone,
  ];

  const currentIconColor = selected ? iconColorSelected : isNone ? iconColorNone : iconColor;

  const a11yLabel = `${option.label}，${option.shortDesc}`;

  return (
    <PressableScale
      onPress={handlePress}
      style={cardStyle}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={option.icon as React.ComponentProps<typeof Ionicons>['name']}
          size={iconSize}
          color={currentIconColor}
        />
      </View>
      <Text style={labelStyle} numberOfLines={1}>
        {option.label}
      </Text>
      <Text style={descStyle} numberOfLines={2}>
        {option.shortDesc}
      </Text>
      {option.isRandom && selected && resolvedHint != null && (
        <Text style={styles.resolvedHint} numberOfLines={1}>
          {resolvedHint}
        </Text>
      )}
    </PressableScale>
  );
});
