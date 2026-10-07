/** 阿瓦隆命令失败文案：覆盖开局门槛、队员人数占位文案与刺杀相关 reason。 */

import type { AvalonState } from '@game-judge/game-engine/games/avalon/public';

import { rejectedRoomCommand } from '@/test-utils/roomCommand';

import { getAvalonRoomCommandFailureMessage } from '../avalonRoomCommandFailureMessage';

describe('getAvalonRoomCommandFailureMessage', () => {
  it('explains the full-room start requirement', () => {
    expect(
      getAvalonRoomCommandFailureMessage(
        rejectedRoomCommand<AvalonState>('请先坐满所有座位，或填充机器人。', 'command-0'),
      ),
    ).toBe('请先坐满所有座位，或填充机器人。');
  });

  it('passes through the team-size reason with the required count', () => {
    expect(
      getAvalonRoomCommandFailureMessage(
        rejectedRoomCommand<AvalonState>('队员人数必须为 3 人', 'command-1'),
      ),
    ).toBe('队员人数必须为 3 人');
  });

  it('maps the night-strike rejection', () => {
    expect(
      getAvalonRoomCommandFailureMessage(
        rejectedRoomCommand<AvalonState>('晚上阶段不能刺杀', 'command-2'),
      ),
    ).toBe('晚上阶段不能刺杀');
  });

  it('maps the good-must-succeed rejection', () => {
    expect(
      getAvalonRoomCommandFailureMessage(
        rejectedRoomCommand<AvalonState>('好人只能出成功牌', 'command-3'),
      ),
    ).toBe('好人只能出成功牌');
  });

  it('delegates platform-level reason codes to the shared translator', () => {
    expect(
      getAvalonRoomCommandFailureMessage(
        rejectedRoomCommand<AvalonState>('room_initialization_conflict', 'command-4'),
      ),
    ).toBe('房间初始化冲突，请重新创建');
  });
});
