/**
 * 阿瓦隆工作区框架：标题头 + 滚动内容，水平居中限宽。
 */

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, spacing, textStyles } from '@/theme';

/** 游戏工作区最大宽度（与其他游戏一致），水平居中。 */
const AVALON_STAGE_MAX_WIDTH = 430;

/** 各阶段视图的统一外框；只渲染，不做业务判断。 */
export function AvalonStageFrame({
  title,
  headerRight,
  children,
  testID,
}: {
  readonly title: string;
  readonly headerRight?: ReactNode;
  readonly children: ReactNode;
  readonly testID?: string;
}) {
  return (
    <View style={styles.outer} testID={testID}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {headerRight}
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

/** 通用信息卡：标题 + 正文 + 可选操作区。 */
export function AvalonInfoCard({
  title,
  children,
  testID,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly testID?: string;
}) {
  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  inner: {
    width: '100%',
    maxWidth: AVALON_STAGE_MAX_WIDTH,
    paddingHorizontal: spacing.screenH,
    paddingVertical: spacing.small,
    gap: spacing.small,
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    gap: spacing.small,
    paddingBottom: spacing.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  card: {
    width: '100%',
    gap: spacing.small,
    padding: spacing.medium,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
  },
  cardTitle: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
});
