/** Canonical root-stack transitions for room creation and room-owned subflows. */

import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';

type RoomFlowNavigation = NativeStackNavigationProp<RootStackParamList>;

/** Removes the active room flow before returning to the existing Home route. */
export function exitRoomFlow(navigation: RoomFlowNavigation): void {
  navigation.popTo('Home');
}

export function replaceWithCreatedRoom(navigation: RoomFlowNavigation, roomCode: string): void {
  navigation.replace('Room', {
    roomCode: parseRoomCode(roomCode),
    entryReason: 'created',
  });
}

export function returnToActiveRoom(navigation: RoomFlowNavigation, roomCode: string): void {
  navigation.popTo('Room', { roomCode: parseRoomCode(roomCode) });
}

/** Reuse the current room or unmount the old room flow before resolving a different room. */
export function enterRoomFromAdmin(navigation: RoomFlowNavigation, roomCode: string): void {
  const params = { roomCode: parseRoomCode(roomCode) };
  const activeRoom = navigation.getState().routes.findLast((route) => route.name === 'Room');
  if (activeRoom === undefined) {
    navigation.navigate('Room', params);
    return;
  }
  if (activeRoom.params === undefined || !('roomCode' in activeRoom.params)) {
    throw new Error('[FAIL-FAST] Room route requires a room code');
  }
  if (activeRoom.params.roomCode === params.roomCode) {
    returnToActiveRoom(navigation, params.roomCode);
    return;
  }
  navigation.reset({
    index: 2,
    routes: [{ name: 'Home' }, { name: 'Admin' }, { name: 'Room', params }],
  });
}
