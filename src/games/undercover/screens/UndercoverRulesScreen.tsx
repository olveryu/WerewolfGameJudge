/** Undercover rules; explains only gameplay and the explicitly agreed offline voting flow. */
import { useNavigation } from '@react-navigation/native';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';

import { undercoverStyles as styles } from '../undercover.styles';

export function UndercoverRulesScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <ScreenHeader title="谁是卧底规则" topInset={insets.top} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>描述词语，找出不同的人</Text>
        <Text style={styles.text}>
          平民和卧底分别拿到两个相关但不同的词，词卡不显示所属阵营。白板没有词，但知道自己是白板。所有人确认词卡后开始描述，不能直接说出自己的词。
        </Text>
        <Text style={styles.text}>
          大家在线下指人投票。房主选择被投出的玩家并确认揭晓，该玩家立即出局。出局后仍可查看自己的词，不能继续参与描述和投票。
        </Text>
        <Text style={styles.title}>获胜条件</Text>
        <Text style={styles.text}>
          白板存活且场上只剩两人时，白板独赢。白板仍在且超过两人时继续游戏。没有存活白板后：卧底全部出局，平民获胜；卧底人数不少于平民，卧底获胜。
        </Text>
        <Text style={styles.text}>
          4 至 6 人配置 1 名卧底，7 至 9 人配置 2 名，10 至 12 人配置 3 名。启用白板至少需要 6
          人，白板替换一名平民。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
