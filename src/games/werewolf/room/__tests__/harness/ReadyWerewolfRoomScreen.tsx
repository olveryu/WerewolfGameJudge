/** Ready-session adapter for game-owned room UI tests. */

import type React from 'react';
import { useMemo } from 'react';

import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/GameUiModule';
import { WerewolfRoomContent } from '@/games/werewolf/room/WerewolfRoomScreen';

export const WerewolfRoomScreen: React.FC<GameRoomScreenProps> = (props) => {
  const entryController = useMemo<RoomEntryController>(
    () => ({
      isReady: true,
      isAuthRequired: false,
      loadingMessage: '房间已连接',
      showRetryButton: false,
      connection: {
        status: 'live',
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

  return <WerewolfRoomContent {...props} entryController={entryController} />;
};
