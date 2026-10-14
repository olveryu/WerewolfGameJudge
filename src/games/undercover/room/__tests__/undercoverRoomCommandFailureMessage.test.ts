import { type UndercoverState } from '@game-judge/game-engine/games/undercover/public';
import { REASON_CONTROLLED_SEAT_NOT_BOT } from '@game-judge/game-engine/platform/protocol/reasons';

import { rejectedRoomCommand } from '@/test-utils/roomCommand';

import { getUndercoverRoomCommandFailureMessage } from '../undercoverRoomCommandFailureMessage';

describe('getUndercoverRoomCommandFailureMessage', () => {
  it('keeps the game copy for a non-bot controlled seat under the platform code', () => {
    // The engine used to reject with the game-local bot code; the
    // normalized platform code must present the same sentence.
    expect(
      getUndercoverRoomCommandFailureMessage(
        rejectedRoomCommand<UndercoverState>(REASON_CONTROLLED_SEAT_NOT_BOT, 'command-1'),
      ),
    ).toBe('该操作只能接管机器人座位');
  });
});
