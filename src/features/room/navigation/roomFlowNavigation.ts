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
