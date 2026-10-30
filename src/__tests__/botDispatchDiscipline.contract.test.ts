/**
 * Bot takeover dispatch discipline — client contract (#149 定版，步骤 6 收敛后形态).
 *
 * 房主命令只能以未接管身份派发：引擎的房主门（resolveHostActorId）拒绝
 * 一切 controlledSeat 非空的 actor，挂着接管座位发房主命令必然失败
 * （#149 在阿瓦隆修掉、drawguess 漏网的正是这一类缺陷）。因此每家的
 * 命令漏斗必须默认 controlledSeat: null，座位动作（以被接管机器人身份
 * 发出）只能由调用点显式传 `{ controlledSeat }`。
 *
 * 七家只有一种漏斗：平台 useReadyRoomSession.submit。各家房间 hook 不得
 * 再开自己的 `session.dispatch(command, …)` 漏斗；允许的直接 dispatch 只有
 * 系统性派发（阶段到期 expire、播报 ack、自动提交），它们不是命令漏斗。
 * 登记表按 GAME_TYPES 驱动：任何游戏（含未来新游戏）没有登记其房间 hook、
 * 或 hook 重新打开自有漏斗，CI 直接失败。
 */

import { GAME_TYPES, type GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..');

function readSource(relativePath: string): string {
  const fullPath = join(SRC_ROOT, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Expected source file to exist: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

/** 漏斗把当前接管座位当默认值的反模式（简写与显式自赋两种写法）。 */
const AMBIENT_CONTROLLED_SEAT_FUNNEL =
  /dispatch\(command, \{\s*controlledSeat(?::\s*controlledSeat)?,\s*label\s*\}\)/;

/** 每家经平台漏斗派发的源文件（房间 hook；storyrelay / pictionary 的阶段组件接收 submit 入参）。 */
const DISPATCH_SITES: Record<GameType, readonly string[]> = {
  werewolf: ['games/werewolf/room/hooks/useWerewolfRoomState.ts'],
  avalon: ['games/avalon/room/hooks/useAvalonRoomState.ts'],
  undercover: [
    'games/undercover/room/hooks/useUndercoverRoomState.ts',
    'games/undercover/room/hooks/useUndercoverRoundControls.ts',
  ],
  drawguess: ['games/drawguess/room/hooks/useDrawGuessRoomState.ts'],
  fibking: ['games/fibking/room/hooks/useFibRoomState.ts'],
  pictionary: [
    'games/pictionary/room/hooks/usePictionaryRoomState.ts',
    'games/pictionary/room/components/PictionaryTaskStage.tsx',
    'games/pictionary/room/components/PictionaryGalleryStage.tsx',
  ],
  storyrelay: [
    'games/storyrelay/room/hooks/useStoryRelayRoomState.ts',
    'games/storyrelay/room/components/StoryRelayStage.tsx',
    'games/storyrelay/room/components/StoryRelayTaskEditor.tsx',
  ],
  demo: ['games/demo/room/hooks/useDemoRoomState.ts'],
};

function expectSharedReadySessionSubmit(source: string): void {
  // The file either owns the platform submit (the room hook) or receives it
  // as an input (stage components); it never opens its own dispatch funnel.
  expect(source).toMatch(/useReadyRoomSession\(|ReadyRoomSession<[^>]+>\['submit'\]/);
  expect(source).not.toMatch(/useRoomCommandSubmission\(/);
  expect(source).not.toMatch(/session\.dispatch\(command/);
  expect(source).not.toMatch(AMBIENT_CONTROLLED_SEAT_FUNNEL);
}

describe('bot dispatch discipline — registration covers every game', () => {
  it('every GAME_TYPES entry has a registered dispatch site, and no extras', () => {
    expect(Object.keys(DISPATCH_SITES).sort()).toEqual([...GAME_TYPES].sort());
  });
});

describe('bot dispatch discipline — every command goes through the platform submit', () => {
  it('the platform submit defaults to the uncontrolled identity', () => {
    const shared = readSource('features/room/controllers/useReadyRoomSession.ts');
    expect(shared).toMatch(/controlledSeat: options\.controlledSeat \?\? null/);
  });

  for (const gameType of GAME_TYPES) {
    for (const file of DISPATCH_SITES[gameType]) {
      it(`${gameType}: ${file} dispatches only through useReadyRoomSession.submit`, () => {
        expectSharedReadySessionSubmit(readSource(file));
      });
    }
  }
});

describe('bot dispatch discipline — no game file reintroduces the ambient hang', () => {
  function collectProductionFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        if (entry === '__tests__' || entry === '__mocks__') continue;
        results.push(...collectProductionFiles(fullPath));
      } else if (
        (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
        !entry.includes('.test.') &&
        !entry.includes('.spec.') &&
        !entry.includes('.stories.')
      ) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it('the ambient controlledSeat funnel pattern appears nowhere under src/games', () => {
    const offenders = collectProductionFiles(join(SRC_ROOT, 'games')).filter((file) =>
      AMBIENT_CONTROLLED_SEAT_FUNNEL.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});

describe('bot dispatch discipline — drawguess seat actions pass the seat explicitly', () => {
  const screen = () => readSource('games/drawguess/room/DrawGuessRoomScreen.tsx');

  it('word choosing (a drawer seat action) passes controlledSeat explicitly', () => {
    expect(screen()).toMatch(
      /submit\(\s*'选择题目',\s*\{[^}]*\},\s*\{\s*controlledSeat\s*\},?\s*\)/,
    );
  });

  it('the drawing workspace exposes neither give-up nor host abort commands', () => {
    expect(screen()).not.toContain('drawguess.round.finish');
    expect(screen()).not.toContain('drawguess.game.abort');
  });
});
