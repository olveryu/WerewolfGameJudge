/**
 * FibRulesScreen — 瞎掰王 玩法说明 (static content).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { borderRadius, colors, componentSizes, spacing, typography, withAlpha } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FibRules'>;
type RuleIconName = React.ComponentProps<typeof Ionicons>['name'];

interface RuleItem {
  iconName: RuleIconName;
  iconColor: string;
  title: string;
  body: string;
}

interface RuleSection {
  title: string;
  items: readonly RuleItem[];
}

const RULE_SECTIONS: readonly RuleSection[] = [
  {
    title: '玩法流程',
    items: [
      {
        iconName: 'flag-outline',
        iconColor: colors.primary,
        title: '一句话玩法',
        body: '一个人知道真释义，其余人现场编假释义。大聪明听完后找出讲真话的老实人。',
      },
      {
        iconName: 'chatbubble-ellipses-outline',
        iconColor: colors.warning,
        title: '线下发言',
        body: '手机只分配身份和公布答案。发言、提问、指认都在线下面对面完成。',
      },
      {
        iconName: 'refresh-outline',
        iconColor: colors.success,
        title: '下一轮',
        body: '公布答案后房主点下一轮，保留座位并重新抽词、重新分配身份。',
      },
    ],
  },
  {
    title: '身份说明',
    items: [
      {
        iconName: 'search-outline',
        iconColor: colors.primary,
        title: '大聪明 ×1',
        body: '身份公开。能看到词，看不到真释义；听完所有解释后口头指认老实人。',
      },
      {
        iconName: 'checkmark-circle-outline',
        iconColor: colors.god,
        title: '老实人 ×1',
        body: '身份隐藏。能看到词和真释义，需要讲真话，也可以演得像在瞎掰。',
      },
      {
        iconName: 'create-outline',
        iconColor: colors.wolf,
        title: '瞎掰王 ×其余',
        body: '身份隐藏。只能看到词，临场编一个像真的假释义来带偏大聪明。',
      },
    ],
  },
  {
    title: '手机使用',
    items: [
      {
        iconName: 'eye-outline',
        iconColor: colors.primary,
        title: '查看身份',
        body: '玩家只看自己的身份内容。查看时背着其他人，看完就收起手机。',
      },
      {
        iconName: 'phone-portrait-outline',
        iconColor: colors.textSecondary,
        title: '房主也是玩家',
        body: '房主只多一个操作权限，仍然正常入座、查看身份、参与发言。',
      },
    ],
  },
];

const FibRulesScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenHeader
        title="瞎掰王 · 玩法说明"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xlarge }]}
        showsVerticalScrollIndicator={false}
      >
        {RULE_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            {section.items.map((item) => (
              <View key={item.title} style={styles.ruleCard}>
                <View
                  style={[styles.iconShell, { backgroundColor: withAlpha(item.iconColor, 0.12) }]}
                >
                  <Ionicons
                    name={item.iconName}
                    size={componentSizes.icon.md}
                    color={item.iconColor}
                  />
                </View>
                <View style={styles.ruleText}>
                  <Text style={styles.ruleTitle}>{item.title}</Text>
                  <Text style={styles.ruleBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.medium,
  },
  section: {
    marginBottom: spacing.medium,
  },
  sectionHeader: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.small,
    marginLeft: spacing.tight,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.small,
    gap: spacing.small,
  },
  iconShell: {
    width: componentSizes.avatar.xs,
    height: componentSizes.avatar.xs,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleText: {
    flex: 1,
    minWidth: 0,
  },
  ruleTitle: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  ruleBody: {
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.5,
    color: colors.textSecondary,
    marginTop: spacing.tight,
  },
});

export default FibRulesScreen;
