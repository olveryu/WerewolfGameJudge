/** Client game-module contract consumed by the room composition root. */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type React from 'react';

import type { RootStackParamList } from '@/navigation/types';
import type { RoomRecord } from '@/services/types/IRoomDirectoryService';

export type RoomEntryReason = 'created' | null;

export interface GameRoomScreenProps {
  readonly room: RoomRecord;
  readonly entryReason: RoomEntryReason;
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'Room'>;
}

export interface GameAccountStatsProps {
  readonly userId: string;
}

export interface GameUiModule<TGameType extends GameType = GameType> {
  readonly gameType: TGameType;
  readonly roomScreen: React.ComponentType<GameRoomScreenProps>;
  readonly accountStatsSection: React.ComponentType<GameAccountStatsProps>;
}
