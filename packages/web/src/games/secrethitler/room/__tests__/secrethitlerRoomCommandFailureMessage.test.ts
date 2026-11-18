/** 秘密希特勒命令失败文案：覆盖开局门槛、阶段门与平台级 reason 兜底。 */

import type { SecrethitlerState } from '@game-judge/game-engine/games/secrethitler/public';

import { rejectedRoomCommand } from '@/test-utils/roomCommand';

import { getSecrethitlerRoomCommandFailureMessage } from '../secrethitlerRoomCommandFailureMessage';

describe('getSecrethitlerRoomCommandFailureMessage', () => {
  it('explains the full-room start requirement', () => {
    expect(
      getSecrethitlerRoomCommandFailureMessage(
        rejectedRoomCommand<SecrethitlerState>('secrethitler_room_not_full', 'command-0'),
      ),
    ).toBe('请先坐满所有座位。');
  });

  it('delegates platform-level reason codes to the shared translator', () => {
    expect(
      getSecrethitlerRoomCommandFailureMessage(
        rejectedRoomCommand<SecrethitlerState>('room_initialization_conflict', 'command-1'),
      ),
    ).toBe('房间初始化冲突，请重新创建');
  });

  it('explains the identity checkpoint', () => {
    expect(
      getSecrethitlerRoomCommandFailureMessage(
        rejectedRoomCommand<SecrethitlerState>('secrethitler_not_all_viewed', 'command-2'),
      ),
    ).toBe('还有玩家未查看身份');
  });
});
