// Rules reference for the Fashion Shadow multiplayer flow.

import {
  FASHION_INITIAL_ACTION_TOKENS,
  FASHION_ROUND_ACTION_TOKEN_RECOVERY,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FashionBackdrop } from '@/games/fashion-shadow/components/FashionBackdrop';
import { FashionHeader } from '@/games/fashion-shadow/components/FashionHeader';
import { parseFashionGuideRouteParams } from '@/games/fashion-shadow/navigation/fashionGameNavigation';
import type { RootStackParamList } from '@/navigation/types';
import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

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
      <FashionBackdrop />
      <FashionHeader
        title="时尚追凶规则"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />
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
            <Text key={round} style={styles.body}>
              {round}
            </Text>
          ))}
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>证据规则</Text>
          <Text style={styles.body}>
            每轮全员投票。赞成调查超过 50% 时，对应证据进入公共证据区；否则该证据永久消失。
          </Text>
          <Text style={styles.body}>
            公共证据在最终听证中可由所有玩家引用，不属于任何玩家的私人手牌。
          </Text>
          <Text style={styles.body}>
            V1《裁缝师傅的证词》一旦公开，会形成对品牌方高层的直接共犯关联；品牌方高层若想达成个人胜利，必须让反派凭其他公开证据被定罪。
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>交叉质询记录</Text>
          <Text style={styles.body}>
            每组交叉质询只有当组攻击方和防守方能提交正式论点；论点会实时同步并永久留在本局案件记录中。
          </Text>
          <Text style={styles.body}>
            正式论点可以引用此前已公开的证据，或引用当前轮正在调查的证据线索。已销毁且不属于当前轮的证据不能再次引用。
          </Text>
          <Text style={styles.body}>
            被选中参加该组质询时会消耗 1 枚行动代币；进入质询后记录论点本身不会重复扣代币。
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>行动代币</Text>
          <Text style={styles.body}>
            每名玩家开局 {FASHION_INITIAL_ACTION_TOKENS}{' '}
            枚。被选中参加交叉质询、公开讨论主动发言、主动提出交易和身份猜测都必须由服务端验证并扣除。
          </Text>
          <Text style={styles.body}>
            进入下一轮时每名玩家恢复 {FASHION_ROUND_ACTION_TOKEN_RECOVERY}{' '}
            枚，最多恢复到开局上限。公开讨论中每人每轮最多主动发言 2 次。
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>猜身份</Text>
          <Text style={styles.body}>
            调查投票阶段可选择消耗 1 枚行动代币猜测另一名玩家身份，每轮最多一次。
          </Text>
          <Text style={styles.body}>
            猜对会公开目标的隐藏秘密；猜错会使你下一轮不能参加交叉质询。连续两轮不能猜同一个目标。
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>秘密契约</Text>
          <Text style={styles.body}>
            工厂工人可在轮次结算后的交易阶段消耗 1 枚行动代币向另一名玩家提出契约。
          </Text>
          <Text style={styles.body}>
            买家接受只代表签署；工厂工人还必须确认履行。最终只有“已履行”契约，且对应买家达成胜利条件时，工厂工人才会通过契约获胜。
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>最终听证</Text>
          <Text style={styles.body}>
            四轮结束后所有玩家提交最终指控。至少要有 2
            张公共证据，而且票数最高且无并列的唯一被指控座位确为反派，才会形成定罪。
          </Text>
          <Text style={styles.body}>
            最终赢家不是简单按多数票决定；每个身份仍要分别检查自己的独立胜利条件。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: fashionShadowColors.background },
  content: { padding: spacing.screenH, gap: spacing.medium },
  card: {
    backgroundColor: fashionShadowColors.surfaceMuted,
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    padding: spacing.large,
    gap: spacing.small,
  },
  title: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.subtitle,
    fontWeight: typography.weights.bold,
  },
  body: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
});
