import {
  type FibState,
  REASON_FIB_GAME_NOT_ENDED,
  REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
} from '@game-judge/game-engine/games/fibking/public';

import { rejectedRoomCommand } from '@/test-utils/roomCommand';

import { getFibRoomCommandFailureMessage } from '../fibRoomCommandFailureMessage';

describe('getFibRoomCommandFailureMessage', () => {
  it('explains a stale end-game request', () => {
    expect(
      getFibRoomCommandFailureMessage(
        rejectedRoomCommand<FibState>(REASON_FIB_GAME_NOT_ENDED, 'command-0'),
      ),
    ).toBe('当前游戏尚未结束');
  });

  it('explains how to resolve a rejected config shrink', () => {
    expect(
      getFibRoomCommandFailureMessage(
        rejectedRoomCommand<FibState>(REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE, 'command-1'),
      ),
    ).toBe('目标人数之外仍有真人入座，请先让这些玩家离座或换到保留座位');
  });

  it('delegates shared room rejection reasons to the shared translator', () => {
    expect(
      getFibRoomCommandFailureMessage(rejectedRoomCommand<FibState>('not_host', 'command-2')),
    ).toBe('仅房主可以执行此操作');
  });
});
