/**
 * SegmentedControl — 通用双段切换组件
 *
 * 用于 EncyclopediaScreen 顶部 "角色 | 板子" tab 切换。
 * 纯展示组件，不含业务逻辑、service 依赖。
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, spacing, typography, withAlpha } from '@/theme';

interface Segment<T extends string> {
  key: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: readonly Segment<T>[];
  activeKey: T;
  onChangeKey: (key: T) => void;
}

export function SegmentedControl<T extends string>({
  segments,
  activeKey,
  onChangeKey,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.container}>
      {segments.map((segment) => {
        const isActive = segment.key === activeKey;
        return (
          <Pressable
            key={segment.key}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => onChangeKey(segment.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{segment.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: spacing.screenH,
    marginTop: spacing.small,
    marginBottom: spacing.small,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
    padding: spacing.micro,
    gap: spacing.micro,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.small,
    borderRadius: borderRadius.small,
  },
  segmentActive: {
    backgroundColor: withAlpha(colors.primary, 0.15),
  },
  label: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
});
