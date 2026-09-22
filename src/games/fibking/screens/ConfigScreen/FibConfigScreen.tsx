/** FibKing create/edit configuration screen using the shared root navigation host. */

import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GameScreen, GameScreenContent, GameScreenFooter } from '@/components/GameScreen';
import { GameSettingsStepper } from '@/components/GameSettings';
import { gameSettingsStyles } from '@/components/GameSettings.styles';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';
import { parseFibConfigRouteParams } from '@/games/fibking/navigation/fibConfigRoute';
import type { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';

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
    <GameScreen
      testID={TESTIDS.configScreenRoot}
      header={<ScreenHeader title="瞎掰王设置" onBack={state.goBack} topInset={insets.top} />}
      footer={
        <GameScreenFooter>
          <Text style={gameSettingsStyles.summary}>共 {state.playerCountText} 人</Text>
          <Button
            variant="primary"
            size="lg"
            onPress={state.submit}
            loading={state.isSubmitting}
            testID={TESTIDS.fibConfigSubmitButton}
          >
            {state.isEditMode ? '保存设置' : '创建房间'}
          </Button>
        </GameScreenFooter>
      }
    >
      <GameScreenContent contentContainerStyle={gameSettingsStyles.content}>
        <View style={gameSettingsStyles.section}>
          <GameSettingsStepper
            label="玩家人数"
            onDecrement={state.decrement}
            onIncrement={state.increment}
            isDecrementDisabled={!state.canDecrement}
            value={state.playerCountText}
            onChangeText={state.onPlayerCountChange}
            testID={TESTIDS.fibPlayerCountInput}
          />
          <Text style={gameSettingsStyles.hint}>支持 4–20 人</Text>
        </View>

        <View style={gameSettingsStyles.section}>
          <Text style={gameSettingsStyles.label}>身份分配</Text>
          <Text style={gameSettingsStyles.hint}>1 位大聪明、1 位老实人，其余玩家都是瞎掰王。</Text>
        </View>
      </GameScreenContent>
    </GameScreen>
  );
};
