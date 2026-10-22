import {
  type FibState,
  REASON_FIB_GAME_NOT_ENDED,
  REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
} from '@game-judge/game-engine/games/fibking/public';
import { REASON_CONTROLLED_SEAT_NOT_BOT } from '@game-judge/game-engine/platform/protocol/reasons';

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
    ).toBe('目标人数之外的座位仍有真人入座，请先让这些玩家离座或换到空位');
  });

  it('presents the shared chassis copy for a non-bot controlled seat', () => {
    // This map used to pin '你还没有入座' here — a pre-normalization
    // preservation: the rejection once arrived as not_seated, whose copy
    // that is. After normalization the trigger is "the takeover target
    // is not a bot", which the not_seated sentence misdescribes. Audit
    // item B-2 rules chassis copy comes from the shared table only, so
    // the game map carries no entry for the platform code.
    expect(
      getFibRoomCommandFailureMessage(
        rejectedRoomCommand<FibState>(REASON_CONTROLLED_SEAT_NOT_BOT, 'command-3'),
      ),
    ).toBe('只能接管机器人座位');
  });

  it('delegates shared room rejection reasons to the shared translator', () => {
    expect(
      getFibRoomCommandFailureMessage(rejectedRoomCommand<FibState>('not_host', 'command-2')),
    ).toBe('仅房主可以执行此操作');
  });
});
