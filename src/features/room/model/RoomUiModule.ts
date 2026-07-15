/** Game-neutral room-screen contribution consumed by the room resolver. */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type React from 'react';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { RootStackParamList } from '@/navigation/types';

export type RoomEntryReason = 'created' | null;

export interface GameRoomScreenProps {
  readonly room: RoomRecord;
  readonly entryReason: RoomEntryReason;
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'Room'>;
}

export interface RoomUiModule<TGameType extends GameType = GameType> {
  readonly gameType: TGameType;
  readonly roomScreen: React.ComponentType<GameRoomScreenProps>;
}
