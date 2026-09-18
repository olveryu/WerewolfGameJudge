/** Pictionary rules content hosted by the shared game-guide route. */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  typography,
  withAlpha,
} from '@/theme';

const RULES = [
  ['create-outline', '各自出题', '第一轮每个人写下一个题目，交给下一位玩家作画。'],
  ['brush-outline', '只看上一棒', '看到文字就画画，看到画就猜词，不能回看更早的内容。'],
  [
    'swap-horizontal-outline',
    '随机接龙不重复',
    'N 人共 N 棒，文字和绘画交替，同一本画册每人只参与一次。',
  ],
  ['images-outline', '一起揭晓', '最后按顺序播放每条接龙，看题目如何一路变形。'],
] as const;

export const PictionaryRulesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameGuide'>>();
  const insets = useSafeAreaInsets();
  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenHeader title="你画我猜接龙玩法" onBack={goBack} topInset={insets.top} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>一人一道开场题，最后一起看答案</Text>
        <Text style={styles.heading}>画得像不像不重要，传得离谱才有趣</Text>
        <Text style={styles.intro}>
          支持 4–20 人，游戏棒数等于玩家人数。到时收取已写文字和未完成画稿，全部收齐后继续。
        </Text>
        <View style={styles.ruleList}>
          {RULES.map(([icon, title, description]) => (
            <View key={title} style={styles.rule}>
              <View style={styles.icon}>
                <Ionicons name={icon} size={componentSizes.icon.md} color={colors.primary} />
              </View>
              <View style={styles.ruleText}>
                <Text style={styles.ruleTitle}>{title}</Text>
                <Text style={styles.ruleDescription}>{description}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.notice}>
          <Ionicons name="eye-off-outline" size={componentSizes.icon.sm} color={colors.info} />
          <Text style={styles.noticeText}>
            作答时只展示当前需要接续的一项，作者会在结果播放时揭晓。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: spacing.screenH,
    paddingBottom: spacing.xxlarge,
  },
  eyebrow: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  heading: {
    marginTop: spacing.small,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  intro: {
    marginTop: spacing.small,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  ruleList: {
    marginTop: spacing.xlarge,
    borderTopWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  rule: {
    flexDirection: 'row',
    paddingVertical: spacing.medium,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.borderLight,
  },
  icon: {
    width: componentSizes.avatar.md,
    height: componentSizes.avatar.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.small,
    backgroundColor: withAlpha(colors.primary, 0.08),
    marginRight: spacing.medium,
  },
  ruleText: { flex: 1, minWidth: 0 },
  ruleTitle: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  ruleDescription: {
    marginTop: spacing.tight,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.textSecondary,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xlarge,
    padding: spacing.medium,
    borderRadius: borderRadius.small,
    backgroundColor: withAlpha(colors.info, 0.08),
  },
  noticeText: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.small,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.text,
  },
});
