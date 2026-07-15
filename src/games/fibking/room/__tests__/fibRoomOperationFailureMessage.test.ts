import { REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE } from '@werewolf/game-engine/games/fibking/public';

import { getFibRoomOperationFailureMessage } from '../fibRoomOperationFailureMessage';

describe('getFibRoomOperationFailureMessage', () => {
  it('explains how to resolve a rejected config shrink', () => {
    expect(
      getFibRoomOperationFailureMessage({
        success: false,
        failureKind: 'rejected',
        commandId: 'command-1',
        reason: REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
      }),
    ).toBe('目标人数之外仍有真人入座，请先让这些玩家离座或换到保留座位');
  });

  it('delegates shared room rejection reasons to the shared translator', () => {
    expect(
      getFibRoomOperationFailureMessage({
        success: false,
        failureKind: 'rejected',
        commandId: 'command-2',
        reason: 'not_host',
      }),
    ).toBe('仅房主可以执行此操作');
  });
});
