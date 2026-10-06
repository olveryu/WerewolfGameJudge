/** Ready-session adapter for game-owned room UI tests. */

import type React from 'react';
import { useMemo } from 'react';

import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { WerewolfRoomContent } from '@/games/werewolf/room/WerewolfRoomScreen';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';

const TEST_CLIENT = {} as WerewolfGameClient;

export const WerewolfRoomScreen: React.FC<GameRoomScreenProps<'werewolf'>> = (props) => {
  const entryController = useMemo<RoomEntryController>(
    () => ({
      isReady: true,
      isAuthRequired: false,
      loadingMessage: '房间已连接',
      showRetryButton: false,
      connection: {
        status: 'live',
        pendingCommandCount: 0,
        onManualReconnect: () => {
          throw new Error('Ready room UI test cannot request reconnect');
        },
      },
      retry: () => {
        throw new Error('Ready room UI test cannot retry entry');
      },
      requestExit: () => props.navigation.navigate('Home'),
    }),
    [props.navigation],
  );

  return <WerewolfRoomContent {...props} entryController={entryController} client={TEST_CLIENT} />;
};
