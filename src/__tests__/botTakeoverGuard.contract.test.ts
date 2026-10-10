/**
 * Bot takeover guard — client contract.
 *
 * 接管释放是一条安全不变量（不得持有已失去资格的座位控制权），七个游戏
 * 统一走共享 useBotTakeoverGuard，不许手写等价 effect。守卫的两个策略
 * 输入（canControlBots / seatStillBot）均为必填，漏接在编译期暴露。
 * 各游戏的保持条件必须与入口 capability 的房主/阶段部分同源。
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..');

function readSource(relativePath: string): string {
  const fullPath = join(SRC_ROOT, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Expected source file to exist: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

describe('bot takeover guard contract', () => {
  it('the guard requires both policy inputs', () => {
    const guard = readSource('features/room/controllers/useBotTakeoverGuard.ts');
    expect(guard).toMatch(/canControlBots: boolean;/);
    expect(guard).toMatch(/seatStillBot: boolean;/);
    expect(guard).not.toMatch(/seatStillBot\?:/);
    expect(guard).not.toMatch(/canControlBots\?:/);
  });

  it('every game room hook routes takeover release through the shared guard', () => {
    const consumers = [
      'games/werewolf/hooks/useWerewolfRoom.ts',
      'games/avalon/room/hooks/useAvalonRoomState.ts',
      'games/drawguess/room/hooks/useDrawGuessRoomState.ts',
      'games/fibking/room/hooks/useFibRoomScreenState.ts',
      'games/pictionary/room/hooks/usePictionaryRoomScreenState.ts',
      'games/storyrelay/room/hooks/useStoryRelayRoomState.ts',
      'games/undercover/room/hooks/useUndercoverRoster.ts',
    ];
    for (const consumer of consumers) {
      const source = readSource(consumer);
      expect(source).toMatch(/useBotTakeoverGuard\(/);
      expect(source).toMatch(/seatStillBot:/);
    }
  });

  it('no migrated hook keeps a hand-written release effect', () => {
    const handWritten = [
      'games/fibking/room/hooks/useFibRoomScreenState.ts',
      'games/pictionary/room/hooks/usePictionaryRoomScreenState.ts',
      'games/storyrelay/room/hooks/useStoryRelayRoomState.ts',
      'games/undercover/room/hooks/useUndercoverRoster.ts',
    ];
    for (const file of handWritten) {
      expect(readSource(file)).not.toMatch(/useEffect\(\(\) => \{\s*if \(.*controlledSeat/);
    }
  });
});
