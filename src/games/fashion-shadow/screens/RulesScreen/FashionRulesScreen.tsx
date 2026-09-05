// Rules reference for the Fashion Shadow multiplayer flow.

import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { parseFashionGuideRouteParams } from '@/games/fashion-shadow/navigation/fashionGameNavigation';
import type { RootStackParamList } from '@/navigation/types';
import { borderRadius, colors, spacing, typography } from '@/theme';

const rounds = [
  '第 1 轮 · 深水埗 · S · 布料采购 / 标签造假',
  '第 2 轮 · 大埔 · E · 工厂排污',
  '第 3 轮 · 葵涌 · G · 物流 / 货柜瞒报',
  '第 4 轮 · 中环 · G · 顾问费 / 行贿 / 洗钱',
] as const;

export const FashionRulesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameGuide'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameGuide'>>();
  const insets = useSafeAreaInsets();
  parseFashionGuideRouteParams(route.params);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenHeader title="时尚追凶规则" onBack={() => navigation.goBack()} topInset={insets.top} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>核心流程</Text>
          <Text style={styles.body}>
            EVENT → CROSS_EXAMINATION → DISCUSSION → VOTE → PUBLIC_EVIDENCE → TRADE → NEXT_ROUND
          </Text>
          <Text style={styles.body}>四轮后进入 FINAL_HEARING → FINAL_VOTE → RESULT。</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>正式轮次</Text>
          {rounds.map((round) => (
            <Text key={round} style={styles.body}>{round}</Text>
          ))}
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>证据规则</Text>
          <Text style={styles.body}>每轮全员投票。赞成调查超过 50% 时，对应证据进入公共证据区；否则该证据永久消失。</Text>
          <Text style={styles.body}>公共证据在最终听证中可由所有玩家引用，不属于任何玩家的私人手牌。</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>行动代币</Text>
          <Text style={styles.body}>每名玩家开局 3 枚。交叉质询、主动发言、主动提出交易和身份猜测都必须由服务端验证并扣除。</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenH, gap: spacing.medium },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    gap: spacing.small,
  },
  title: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: typography.weights.bold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
});
