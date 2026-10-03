/** 你画我猜命令失败文案：覆盖开局门槛、平台级 reason 兜底与内部 reason。 */

import type { DrawGuessState } from '@game-judge/game-engine/games/drawguess/public';

import { rejectedRoomCommand } from '@/test-utils/roomCommand';

import { getDrawGuessRoomCommandFailureMessage } from '../drawGuessRoomCommandFailureMessage';

describe('getDrawGuessRoomCommandFailureMessage', () => {
  it('explains the full-room start requirement', () => {
    expect(
      getDrawGuessRoomCommandFailureMessage(
        rejectedRoomCommand<DrawGuessState>('请先坐满所有座位，或填充机器人。', 'command-0'),
      ),
    ).toBe('请先坐满所有座位，或填充机器人。');
  });

  it('delegates platform-level reason codes to the shared translator', () => {
    expect(
      getDrawGuessRoomCommandFailureMessage(
        rejectedRoomCommand<DrawGuessState>('room_initialization_conflict', 'command-1'),
      ),
    ).toBe('房间初始化冲突，请重新创建');
  });

  it('maps the internal words-dealt reason', () => {
    expect(
      getDrawGuessRoomCommandFailureMessage(
        rejectedRoomCommand<DrawGuessState>('题目已下发', 'command-2'),
      ),
    ).toBe('题目已下发');
  });
});
