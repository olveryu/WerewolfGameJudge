import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  exitRoomFlow,
  replaceWithCreatedRoom,
  returnToActiveRoom,
} from '@/features/room/navigation/roomFlowNavigation';
import type { RootStackParamList } from '@/navigation/types';

function createNavigation() {
  return {
    replace: jest.fn(),
    popTo: jest.fn(),
  } as unknown as NativeStackNavigationProp<RootStackParamList>;
}

describe('roomFlowNavigation', () => {
  it('pops the complete room flow before returning Home', () => {
    const navigation = createNavigation();

    exitRoomFlow(navigation);

    expect(navigation.popTo).toHaveBeenCalledWith('Home');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('replaces the create flow so it cannot remain below the room', () => {
    const navigation = createNavigation();

    replaceWithCreatedRoom(navigation, '4321');

    expect(navigation.replace).toHaveBeenCalledWith('Room', {
      roomCode: '4321',
      entryReason: 'created',
    });
    expect(navigation.popTo).not.toHaveBeenCalled();
  });

  it('pops an edit flow back to the existing room', () => {
    const navigation = createNavigation();

    returnToActiveRoom(navigation, '4321');

    expect(navigation.popTo).toHaveBeenCalledWith('Room', { roomCode: '4321' });
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('rejects malformed room codes before mutating navigation', () => {
    const navigation = createNavigation();

    expect(() => replaceWithCreatedRoom(navigation, 'room-4321')).toThrow();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
