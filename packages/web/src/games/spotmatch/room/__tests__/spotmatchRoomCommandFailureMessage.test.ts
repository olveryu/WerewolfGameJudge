/** 一眼成对命令失败文案：覆盖开局门槛、阶段门与平台级 reason 兜底。 */

import type { SpotmatchState } from '@game-judge/game-engine/games/spotmatch/public';

import { rejectedRoomCommand } from '@/test-utils/roomCommand';

import { getSpotmatchRoomCommandFailureMessage } from '../spotmatchRoomCommandFailureMessage';

describe('getSpotmatchRoomCommandFailureMessage', () => {
  it('explains the full-room start requirement', () => {
    expect(
      getSpotmatchRoomCommandFailureMessage(
        rejectedRoomCommand<SpotmatchState>('spotmatch_room_not_full', 'command-0'),
      ),
    ).toBe('请先坐满所有座位。');
  });

  it('delegates platform-level reason codes to the shared translator', () => {
    expect(
      getSpotmatchRoomCommandFailureMessage(
        rejectedRoomCommand<SpotmatchState>('room_initialization_conflict', 'command-1'),
      ),
    ).toBe('房间初始化冲突，请重新创建');
  });

  it('explains an outdated restart confirmation', () => {
    expect(
      getSpotmatchRoomCommandFailureMessage(
        rejectedRoomCommand<SpotmatchState>('spotmatch_stale_restart', 'command-2'),
      ),
    ).toBe('本局状态已改变，请重新确认是否重新开始');
  });
});
