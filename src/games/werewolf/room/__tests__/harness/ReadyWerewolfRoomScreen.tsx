/** Ready-session adapter for game-owned room UI tests: mounts the room content on the active mock. */

import type React from 'react';
import { useMemo } from 'react';

import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { WerewolfRoomContent } from '@/games/werewolf/room/WerewolfRoomScreen';

import { getActiveRoomMock } from './activeRoomMock';

export const WerewolfRoomScreen: React.FC<GameRoomScreenProps<'werewolf'>> = (props) => {
  const mock = getActiveRoomMock();
  const entryController = useMemo<RoomEntryController>(
    () => ({
      isReady: true,
      loadingMessage: '房间已连接',
      showRetryButton: false,
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
        presence: new Set<string>(),
        onRetryNow: () => {
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

  return (
    <WerewolfRoomContent
      {...props}
      entryController={entryController}
      session={mock.session}
      audio={mock.audio}
    />
  );
};
