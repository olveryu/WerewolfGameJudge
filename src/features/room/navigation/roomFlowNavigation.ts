/** Canonical root-stack transitions for room creation and room-owned subflows. */

import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';

type RoomFlowNavigation = NativeStackNavigationProp<RootStackParamList>;

export function replaceWithCreatedRoom(navigation: RoomFlowNavigation, roomCode: string): void {
  navigation.replace('Room', {
    roomCode: parseRoomCode(roomCode),
    entryReason: 'created',
  });
}

export function returnToActiveRoom(navigation: RoomFlowNavigation, roomCode: string): void {
  navigation.popTo('Room', { roomCode: parseRoomCode(roomCode) });
}
