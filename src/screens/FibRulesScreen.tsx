/**
 * FibRulesScreen — 瞎掰王 玩法说明 (static content).
 */
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { borderRadius, colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FibRules'>;

interface RuleItem {
  icon: string;
  title: string;
  body: string;
}

const RULES: RuleItem[] = [
  {
    icon: '🎯',
    title: '一句话玩法',
    body: '一个生僻词,只有一人知道真释义,其余人现编假释义。大聪明听完所有人发言,指认谁才是讲真话的「老实人」。发言、提问、指认全程线下面对面,手机只当裁判。',
  },
  {
    icon: '🔄',
    title: '本轮流程',
    body: '① 手机抽生僻词并分配身份(大聪明公开,老实人/瞎掰王隐藏);② 轮流口头给释义(老实人讲真话,瞎掰王现编);③ 大聪明只听不看,听完口头指认老实人;④ 手机公布真词/真释义/全部身份,当场对答案;⑤ host 随时重开,身份随机重分。',
  },
  {
    icon: '🔍',
    title: '大聪明 ×1(身份公开)',
    body: '看不到词与释义。仔细听每个人给的释义,找出谁在讲真话 = 老实人。听完后口头指认。',
  },
  {
    icon: '😇',
    title: '老实人 ×1(身份隐藏)',
    body: '手机显示词 + 真释义。必须讲真话,但可以演技装成在瞎掰。',
  },
  {
    icon: '🤥',
    title: '瞎掰王 ×其余(身份隐藏)',
    body: '手机只显示词,无释义。临场编一个像样的假释义,带偏大聪明。',
  },
  {
    icon: '📱',
    title: '手机怎么用',
    body: '只负责抽词 + 真释义、分身份、查看本人内容、最后公布。其余线下进行。host 也是玩家,可随时重开。查看时背着人,看完即收。',
  },
];

const FibRulesScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <ScreenHeader
        title="瞎掰王 · 玩法说明"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {RULES.map((rule) => (
          <View key={rule.title} style={styles.card}>
            <Text style={styles.cardTitle}>
              {rule.icon} {rule.title}
            </Text>
            <Text style={styles.cardBody}>{rule.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenH, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.medium,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.small,
  },
  cardTitle: {
    fontSize: typography.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  cardBody: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.textSecondary,
  },
});

export default FibRulesScreen;
