/** FibKing rules content hosted by the shared game-guide root route. */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  typography,
  withAlpha,
} from '@/theme';

interface RuleItemProps {
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly title: string;
  readonly description: string;
}

const RuleItem: React.FC<RuleItemProps> = ({ icon, title, description }) => (
  <View style={styles.ruleItem}>
    <View style={styles.ruleIcon}>
      <Ionicons name={icon} size={componentSizes.icon.sm} color={colors.primary} />
    </View>
    <View style={styles.ruleText}>
      <Text style={styles.ruleTitle}>{title}</Text>
      <Text style={styles.ruleDescription}>{description}</Text>
    </View>
  </View>
);

export const FibRulesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameGuide'>>();
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID={TESTIDS.fibRulesScreenRoot}
    >
      <ScreenHeader
        title="瞎掰王玩法"
        onBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
            return;
          }
          navigation.navigate('Home');
        }}
        topInset={insets.top}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>游戏目标</Text>
        <Text style={styles.heading}>真假释义，只能相信描述</Text>
        <Text style={styles.intro}>
          每轮所有玩家看到同一个词。老实人知道真实释义，瞎掰王编造释义，大聪明根据描述判断真相。
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>三个身份</Text>
          <RuleItem
            icon="search-outline"
            title="大聪明"
            description="能看到本轮词语，但看不到真实释义。听完描述后判断谁说的是真话。"
          />
          <RuleItem
            icon="checkmark-circle-outline"
            title="老实人"
            description="能看到词语和真实释义。用自己的话准确描述，但不能直接念出答案。"
          />
          <RuleItem
            icon="sparkles-outline"
            title="瞎掰王"
            description="能看到词语，但看不到真实释义。编出听起来可信的解释。"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>一轮流程</Text>
          <RuleItem
            icon="eye-outline"
            title="查看身份"
            description="每位玩家确认自己的身份和可见信息。"
          />
          <RuleItem
            icon="chatbubbles-outline"
            title="依次描述"
            description="玩家围绕词语给出解释，大聪明公开身份并听取所有描述。"
          />
          <RuleItem
            icon="refresh-outline"
            title="重新抽词（可选）"
            description="当前词语不合适时，房主可作废本轮并重新抽词、分配身份；已出现的词语不会重复。"
          />
          <RuleItem
            icon="flag-outline"
            title="公布答案"
            description="房主结束本轮，公开真实释义、老实人与所有身份。"
          />
          <RuleItem
            icon="refresh-outline"
            title="下一轮"
            description="座位保持不变，系统抽取新词并重新分配身份。"
          />
          <RuleItem
            icon="stop-circle-outline"
            title="结束游戏"
            description="答案公布后返回大厅并保留当前座位，可以调整玩家或房间设置。"
          />
          <RuleItem
            icon="stop-circle-outline"
            title="放弃游戏（可选）"
            description="答案公布前也可返回大厅；当前座位和已出现的词语记录都会保留。"
          />
        </View>

        <View style={styles.notice}>
          <Ionicons
            name="information-circle-outline"
            size={componentSizes.icon.sm}
            color={colors.info}
          />
          <Text style={styles.noticeText}>
            大聪明在本轮开始后公开；老实人身份直到公布答案才公开。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.large,
    paddingBottom: spacing.xxlarge,
  },
  kicker: {
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.4,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  heading: {
    marginTop: spacing.tight,
    fontSize: typography.heading,
    lineHeight: typography.heading * 1.3,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  intro: {
    marginTop: spacing.small,
    fontSize: typography.body,
    lineHeight: typography.body * 1.65,
    color: colors.textSecondary,
  },
  section: {
    marginTop: spacing.xlarge,
  },
  sectionTitle: {
    paddingBottom: spacing.small,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
    fontSize: typography.subtitle,
    lineHeight: typography.subtitle * 1.4,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.medium,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.borderLight,
  },
  ruleIcon: {
    width: componentSizes.avatar.md,
    height: componentSizes.avatar.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.small,
    backgroundColor: withAlpha(colors.primary, 0.08),
    marginRight: spacing.medium,
  },
  ruleText: {
    flex: 1,
    minWidth: 0,
  },
  ruleTitle: {
    fontSize: typography.body,
    lineHeight: typography.body * 1.45,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  ruleDescription: {
    marginTop: spacing.tight,
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.6,
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
    lineHeight: typography.secondary * 1.55,
    color: colors.text,
  },
});
