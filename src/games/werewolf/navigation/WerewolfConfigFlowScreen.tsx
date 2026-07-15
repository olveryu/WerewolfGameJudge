/** Werewolf-owned BoardPicker -> Config -> Rules navigation flow. */

import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { parseRoomCode } from '@werewolf/game-engine/platform/protocol/roomCode';
import type React from 'react';
import { useCallback } from 'react';

import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { BoardPickerScreen } from '@/games/werewolf/screens/BoardPickerScreen/BoardPickerScreen';
import { ConfigScreen } from '@/games/werewolf/screens/ConfigScreen/ConfigScreen';
import { GameRulesScreen } from '@/games/werewolf/screens/GameRulesScreen/GameRulesScreen';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme';

import type { WerewolfConfigStackParamList } from './types';
import { getWerewolfConfigFlowStart } from './werewolfConfigFlow';

const Stack = createNativeStackNavigator<WerewolfConfigStackParamList>();

interface WerewolfConfigFlowScreenProps {
  readonly client: WerewolfGameClient;
}

export const WerewolfConfigFlowScreen: React.FC<WerewolfConfigFlowScreenProps> = ({ client }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameConfig'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameConfig'>>();
  const start = getWerewolfConfigFlowStart(route.params);

  const handleExitFlow = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Home');
  }, [navigation]);

  const handleReturnToRoom = useCallback(
    (roomCode: string) => {
      navigation.popTo('Room', { roomCode: parseRoomCode(roomCode) });
    },
    [navigation],
  );

  const handleRoomCreated = useCallback(
    (roomCode: string) => {
      navigation.navigate('Room', {
        roomCode: parseRoomCode(roomCode),
        entryReason: 'created',
      });
    },
    [navigation],
  );

  return (
    <Stack.Navigator
      initialRouteName={start.initialRouteName}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'default',
      }}
    >
      <Stack.Screen name="BoardPicker" initialParams={start.boardPickerParams}>
        {() => <BoardPickerScreen onExitFlow={handleExitFlow} />}
      </Stack.Screen>
      <Stack.Screen name="Config" initialParams={start.configParams}>
        {() => (
          <ConfigScreen
            client={client}
            onExitFlow={handleExitFlow}
            onReturnToRoom={handleReturnToRoom}
            onRoomCreated={handleRoomCreated}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Rules" component={GameRulesScreen} />
    </Stack.Navigator>
  );
};
