jest.unmock('@react-navigation/native');

import {
  NavigationContainer,
  type RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { Pressable, Text } from 'react-native';

import type { WerewolfConfigStackParamList } from '@/games/werewolf/navigation/types';
import { WerewolfConfigFlowScreen } from '@/games/werewolf/navigation/WerewolfConfigFlowScreen';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { RootStackParamList } from '@/navigation/types';

interface BoardPickerProbeProps {
  readonly onExitFlow: () => void;
}

interface ConfigProbeProps {
  readonly onExitFlow: () => void;
  readonly onReturnToRoom: (roomCode: string) => void;
  readonly onRoomCreated: (roomCode: string) => void;
}

const mockBoardPickerProps: { current: BoardPickerProbeProps | null } = { current: null };
const mockConfigProps: { current: ConfigProbeProps | null } = { current: null };
const mockNestedNavigation: {
  current: NativeStackNavigationProp<WerewolfConfigStackParamList, 'BoardPicker'> | null;
} = { current: null };

jest.mock('@/games/werewolf/screens/BoardPickerScreen/BoardPickerScreen', () => {
  const navigation = jest.requireActual<typeof import('@react-navigation/native')>(
    '@react-navigation/native',
  );
  return {
    BoardPickerScreen: (props: BoardPickerProbeProps) => {
      mockBoardPickerProps.current = props;
      mockNestedNavigation.current =
        navigation.useNavigation<
          NativeStackNavigationProp<WerewolfConfigStackParamList, 'BoardPicker'>
        >();
      return null;
    },
  };
});

jest.mock('@/games/werewolf/screens/ConfigScreen/ConfigScreen', () => ({
  ConfigScreen: (props: ConfigProbeProps) => {
    mockConfigProps.current = props;
    return null;
  },
}));

jest.mock('@/games/werewolf/screens/GameRulesScreen/GameRulesScreen', () => ({
  GameRulesScreen: () => null,
}));

const RootStack = createNativeStackNavigator<RootStackParamList>();
const mockClient = {} as WerewolfGameClient;

const HomeProbe: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Home'>>();
  return (
    <>
      <Pressable
        testID="open-config"
        onPress={() => navigation.navigate('GameConfig', { gameType: 'werewolf', mode: 'create' })}
      >
        <Text testID="home-probe">Home</Text>
      </Pressable>
      <Pressable
        testID="open-room"
        onPress={() => navigation.navigate('Room', { roomCode: '2468' })}
      >
        <Text>Room</Text>
      </Pressable>
    </>
  );
};

const RoomProbe: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Room'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Room'>>();
  return (
    <>
      <Text testID="room-probe">
        {route.params.roomCode}:{route.params.entryReason}
      </Text>
      <Pressable
        testID="open-edit-config"
        onPress={() =>
          navigation.navigate('GameConfig', {
            gameType: 'werewolf',
            mode: 'edit',
            roomCode: route.params.roomCode,
          })
        }
      >
        <Text>Edit</Text>
      </Pressable>
      <Pressable testID="leave-room" onPress={() => navigation.goBack()}>
        <Text>Leave</Text>
      </Pressable>
    </>
  );
};

function renderFlow() {
  return render(
    <NavigationContainer>
      <RootStack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Home" component={HomeProbe} />
        <RootStack.Screen name="GameConfig">
          {() => <WerewolfConfigFlowScreen client={mockClient} />}
        </RootStack.Screen>
        <RootStack.Screen name="Room" component={RoomProbe} />
      </RootStack.Navigator>
    </NavigationContainer>,
  );
}

describe('WerewolfConfigFlowScreen root boundary', () => {
  beforeEach(() => {
    mockBoardPickerProps.current = null;
    mockConfigProps.current = null;
    mockNestedNavigation.current = null;
  });

  it('exits the initial nested route through the root callback', async () => {
    const screen = renderFlow();
    fireEvent.press(screen.getByTestId('open-config'));
    await waitFor(() => expect(mockBoardPickerProps.current).not.toBeNull());

    act(() => mockBoardPickerProps.current?.onExitFlow());

    await waitFor(() => expect(screen.getByTestId('home-probe')).toBeVisible());
  });

  it('carries the confirmed room code across the nested-to-root boundary', async () => {
    const screen = renderFlow();
    fireEvent.press(screen.getByTestId('open-config'));
    await waitFor(() => expect(mockNestedNavigation.current).not.toBeNull());

    act(() => mockNestedNavigation.current?.popTo('Config', { presetName: '预女猎白' }));
    await waitFor(() => expect(mockConfigProps.current).not.toBeNull());
    act(() => mockConfigProps.current?.onRoomCreated('7777'));

    await waitFor(() => expect(screen.getByTestId('room-probe')).toHaveTextContent('7777:created'));
    fireEvent.press(screen.getByTestId('leave-room'));
    await waitFor(() => expect(screen.getByTestId('home-probe')).toBeVisible());
  });

  it('returns an edit flow to its existing root room', async () => {
    const screen = renderFlow();
    fireEvent.press(screen.getByTestId('open-room'));
    await waitFor(() => expect(screen.getByTestId('room-probe')).toHaveTextContent('2468:'));

    fireEvent.press(screen.getByTestId('open-edit-config'));
    await waitFor(() => expect(mockConfigProps.current).not.toBeNull());
    act(() => mockConfigProps.current?.onReturnToRoom('2468'));

    await waitFor(() => expect(screen.getByTestId('room-probe')).toBeVisible());
  });
});
