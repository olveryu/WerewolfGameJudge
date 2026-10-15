/** Demo命令失败文案：覆盖开局门槛、阶段门与平台级 reason 兜底。 */

import type { DemoState } from '@game-judge/game-engine/games/demo/public';

import { rejectedRoomCommand } from '@/test-utils/roomCommand';

import { getDemoRoomCommandFailureMessage } from '../demoRoomCommandFailureMessage';

describe('getDemoRoomCommandFailureMessage', () => {
  it('explains the full-room start requirement', () => {
    expect(
      getDemoRoomCommandFailureMessage(
        rejectedRoomCommand<DemoState>('demo_room_not_full', 'command-0'),
      ),
    ).toBe('请先坐满所有座位，或填充机器人。');
  });

  it('delegates platform-level reason codes to the shared translator', () => {
    expect(
      getDemoRoomCommandFailureMessage(
        rejectedRoomCommand<DemoState>('room_initialization_conflict', 'command-1'),
      ),
    ).toBe('房间初始化冲突，请重新创建');
  });

  it('explains the identity checkpoint', () => {
    expect(
      getDemoRoomCommandFailureMessage(
        rejectedRoomCommand<DemoState>('demo_not_all_viewed', 'command-2'),
      ),
    ).toBe('还有玩家未查看身份');
  });
});
