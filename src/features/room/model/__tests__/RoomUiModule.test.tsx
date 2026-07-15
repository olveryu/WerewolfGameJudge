import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { RootStackParamList } from '@/navigation/types';

import type { RoomRecord } from '../RoomDirectory';
import { registerRoomUiModule, type RoomUiModule } from '../RoomUiModule';

const navigation = {} as NativeStackNavigationProp<RootStackParamList, 'Room'>;
const room: RoomRecord = {
  roomCode: '1234',
  roomId: 'room-1234',
  gameType: 'werewolf',
  hostUserId: 'host-1',
  createdAt: new Date('2026-07-15T00:00:00.000Z'),
};

const module: RoomUiModule<'werewolf'> = {
  gameType: 'werewolf',
  roomScreen: ({ room: resolvedRoom }) => <Text>{resolvedRoom.gameType}</Text>,
};

describe('registerRoomUiModule', () => {
  it('renders a concrete game screen after matching its registered identity', () => {
    const RoomScreen = registerRoomUiModule(module).roomScreen;
    const view = render(<RoomScreen room={room} entryReason={null} navigation={navigation} />);

    expect(view.getByText('werewolf')).toBeTruthy();
  });

  it('fails before rendering when the resolved room belongs to another game', () => {
    const RoomScreen = registerRoomUiModule(module).roomScreen;
    const mismatchedRoom: RoomRecord = { ...room, gameType: 'fibking' };

    expect(() =>
      render(<RoomScreen room={mismatchedRoom} entryReason={null} navigation={navigation} />),
    ).toThrow('[FAIL-FAST] Room 1234 resolved fibking through werewolf');
  });
});
