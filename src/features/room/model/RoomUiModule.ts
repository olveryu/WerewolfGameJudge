/** Game-neutral room-screen contribution consumed by the room resolver. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { createElement } from 'react';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { RootStackParamList } from '@/navigation/types';

export type RoomEntryReason = 'created' | null;

export interface GameRoomScreenProps<TGameType extends string = GameType> {
  readonly room: RoomRecord<TGameType>;
  readonly entryReason: RoomEntryReason;
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'Room'>;
}

export interface RoomUiModule<TGameType extends string = GameType> {
  readonly gameType: TGameType;
  readonly roomScreen: React.ComponentType<GameRoomScreenProps<TGameType>>;
}

/** Production-erased room UI after a canonical catalog registration. */
export interface RegisteredRoomUiModule<TGameType extends GameType = GameType> {
  readonly gameType: TGameType;
  readonly roomScreen: React.ComponentType<GameRoomScreenProps>;
}

export function registerRoomUiModule<TGameType extends GameType>(
  module: RoomUiModule<TGameType>,
): RegisteredRoomUiModule<TGameType> {
  const GameRoomScreen = module.roomScreen;
  const RegisteredRoomScreen: React.FC<GameRoomScreenProps> = (props) => {
    if (props.room.gameType !== module.gameType) {
      throw new Error(
        `[FAIL-FAST] Room ${props.room.roomCode} resolved ${props.room.gameType} through ${module.gameType}`,
      );
    }
    const room: RoomRecord<TGameType> = {
      ...props.room,
      gameType: module.gameType,
    };
    return createElement(GameRoomScreen, { ...props, room });
  };

  return { gameType: module.gameType, roomScreen: RegisteredRoomScreen };
}
