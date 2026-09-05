/** FibKing create/edit configuration screen using the shared root navigation host. */

import Ionicons from '@expo/vector-icons/Ionicons';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';
import { parseFibConfigRouteParams } from '@/games/fibking/navigation/fibConfigRoute';
import type { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { colors, componentSizes } from '@/theme';

import { fibConfigStyles as styles } from './FibConfigScreen.styles';
import { useFibConfigScreenState } from './useFibConfigScreenState';

interface FibConfigScreenProps {
  readonly session: FibRoomSession;
}

export const FibConfigScreen: React.FC<FibConfigScreenProps> = ({ session }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameConfig'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameConfig'>>();
  const insets = useSafeAreaInsets();
  const params = parseFibConfigRouteParams(route.params);
  const state = useFibConfigScreenState({ params, navigation, session });

  return (
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID={TESTIDS.configScreenRoot}
    >
      <ScreenHeader title="瞎掰王设置" onBack={state.goBack} topInset={insets.top} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>{state.isEditMode ? '房间设置' : '创建房间'}</Text>
        <Text style={styles.title}>选择本局人数</Text>
        <Text style={styles.description}>默认 8 人，支持 4–20 人。</Text>

        <View style={styles.controlPanel}>
          <Text style={styles.controlLabel}>玩家人数</Text>
          <View style={styles.controlRow}>
            <Button
              variant="icon"
              size="lg"
              onPress={state.decrement}
              disabled={!state.canDecrement}
              style={styles.stepButton}
              accessibilityLabel="减少人数"
            >
              <Ionicons name="remove" size={componentSizes.icon.md} color={colors.text} />
            </Button>
            <TextInput
              value={state.playerCountText}
              onChangeText={state.onPlayerCountChange}
              keyboardType="number-pad"
              inputMode="numeric"
              selectTextOnFocus
              style={styles.input}
              accessibilityLabel="玩家人数"
              testID={TESTIDS.fibPlayerCountInput}
            />
            <Button
              variant="icon"
              size="lg"
              onPress={state.increment}
              style={styles.stepButton}
              accessibilityLabel="增加人数"
            >
              <Ionicons name="add" size={componentSizes.icon.md} color={colors.text} />
            </Button>
          </View>
        </View>

        <View style={styles.ruleBand}>
          <View style={styles.ruleRow}>
            <View style={styles.ruleIcon}>
              <Ionicons
                name="people-outline"
                size={componentSizes.icon.sm}
                color={colors.primary}
              />
            </View>
            <View style={styles.ruleText}>
              <Text style={styles.ruleTitle}>每轮三个身份</Text>
              <Text style={styles.ruleDescription}>
                1 位大聪明、1 位老实人，其余玩家都是瞎掰王。
              </Text>
            </View>
          </View>
          <View style={[styles.ruleRow, styles.ruleRowSpaced]}>
            <View style={styles.ruleIcon}>
              <Ionicons
                name="refresh-outline"
                size={componentSizes.icon.sm}
                color={colors.primary}
              />
            </View>
            <View style={styles.ruleText}>
              <Text style={styles.ruleTitle}>下一轮保留座位</Text>
              <Text style={styles.ruleDescription}>
                进行中可重新抽词或放弃游戏；公布答案后可直接进入下一轮，也可结束游戏返回大厅。
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
        <Button
          variant="primary"
          size="lg"
          onPress={state.submit}
          loading={state.isSubmitting}
          style={styles.submitButton}
          testID={TESTIDS.fibConfigSubmitButton}
        >
          {state.isEditMode ? '保存设置' : '创建房间'}
        </Button>
      </View>
    </SafeAreaView>
  );
};
