/** Typed client game catalog fixture for React tests. */

import type React from 'react';

import type {
  GameAccountStatsProps,
  GameRoomScreenProps,
} from '@/features/room/model/GameUiModule';
import type { ClientGameCatalog } from '@/games/catalog';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';

const EmptyRoomScreen: React.FC<GameRoomScreenProps> = () => null;
const EmptyAccountStatsSection: React.FC<GameAccountStatsProps> = () => null;
const EmptyScreen: React.FC = () => null;

export function createTestClientGameCatalog(client: WerewolfGameClient): ClientGameCatalog {
  return {
    werewolf: {
      gameType: 'werewolf',
      client,
      roomScreen: EmptyRoomScreen,
      accountStatsSection: EmptyAccountStatsSection,
      appOverlay: null,
      screens: {
        boardPicker: EmptyScreen,
        config: EmptyScreen,
        encyclopedia: EmptyScreen,
        rules: EmptyScreen,
        notepad: EmptyScreen,
      },
    },
  };
}
