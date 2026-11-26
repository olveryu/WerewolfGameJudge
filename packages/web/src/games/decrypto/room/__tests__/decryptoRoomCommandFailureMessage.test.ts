/** 解码战命令失败文案：覆盖开局门槛、阶段门与平台级 reason 兜底。 */

import type { DecryptoState } from '@game-judge/game-engine/games/decrypto/public';

import { rejectedRoomCommand } from '@/test-utils/roomCommand';

import { getDecryptoRoomCommandFailureMessage } from '../decryptoRoomCommandFailureMessage';

describe('getDecryptoRoomCommandFailureMessage', () => {
  it('explains the full-room start requirement', () => {
    expect(
      getDecryptoRoomCommandFailureMessage(
        rejectedRoomCommand<DecryptoState>('decrypto_room_not_full', 'command-0'),
      ),
    ).toBe('请先坐满所有座位。');
  });

  it('delegates platform-level reason codes to the shared translator', () => {
    expect(
      getDecryptoRoomCommandFailureMessage(
        rejectedRoomCommand<DecryptoState>('room_initialization_conflict', 'command-1'),
      ),
    ).toBe('房间初始化冲突，请重新创建');
  });
});
