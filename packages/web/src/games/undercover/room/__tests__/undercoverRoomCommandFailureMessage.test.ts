import { type UndercoverState } from '@game-judge/game-engine/games/undercover/public';
import { REASON_CONTROLLED_SEAT_NOT_BOT } from '@game-judge/game-engine/platform/protocol/reasons';

import { rejectedRoomCommand } from '@/test-utils/roomCommand';

import { getUndercoverRoomCommandFailureMessage } from '../undercoverRoomCommandFailureMessage';

describe('getUndercoverRoomCommandFailureMessage', () => {
  it('presents the shared chassis copy for a non-bot controlled seat', () => {
    // This map used to pin the game variant '该操作只能接管机器人座位'
    // under the platform code (a pre-normalization preservation). Audit
    // item B-2 rules chassis copy comes from the shared table only, so
    // the game map carries no entry for the platform code and the
    // sentence matches every other game.
    expect(
      getUndercoverRoomCommandFailureMessage(
        rejectedRoomCommand<UndercoverState>(REASON_CONTROLLED_SEAT_NOT_BOT, 'command-1'),
      ),
    ).toBe('只能接管机器人座位');
  });
});
