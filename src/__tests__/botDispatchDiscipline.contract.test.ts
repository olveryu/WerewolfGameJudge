/**
 * Bot takeover dispatch discipline — client contract (#149 定版).
 *
 * 房主命令只能以未接管身份派发：引擎的房主门（resolveHostActorId）拒绝
 * 一切 controlledSeat 非空的 actor，挂着接管座位发房主命令必然失败
 * （#149 在阿瓦隆修掉、drawguess 漏网的正是这一类缺陷）。因此每家的
 * 通用 submit 漏斗默认必须是 controlledSeat: null，座位动作（以被接管
 * 机器人身份发出）只能由调用点显式传。本 contract 以源码扫描钉住这条
 * 纪律，登记表按 GAME_TYPES 驱动：任何游戏（含未来新游戏）没有登记
 * 其漏斗形态、或漏斗回退成「默认挂当前接管座位」，CI 直接失败。
 *
 * 登记的三种等价形态（按各家现状事实登记，不是三套标准）：
 * - parameterized-submit：submit 第三参 control 默认 null，座位动作
 *   显式传（avalon / undercover / drawguess）。
 * - hardcoded-null-submit：漏斗写死 null，该家不存在经漏斗发出的座位
 *   动作（fibking / pictionary / storyrelay；storyrelay 的 Stage 组件
 *   另有一个同形态漏斗，一并登记）。
 * - werewolf 两件：WerewolfGameClient 接口按方法区分——座位动作方法
 *   带显式 controlledSeat 参数、房主方法无此参数（结构上不可能挂）；
 *   其 runtime 管道 dispatchWerewolfCommand 把 controlledSeat 收为
 *   必填参数转发，同样不设默认。
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

type DispatchForm =
  | 'parameterized-submit'
  | 'hardcoded-null-submit'
  | 'werewolf-client-interface'
  | 'werewolf-actions-plumbing';

interface DispatchSiteRegistration {
  readonly file: string;
  readonly form: DispatchForm;
}

const DISPATCH_SITES: Record<GameType, readonly DispatchSiteRegistration[]> = {
  werewolf: [
    { file: 'games/werewolf/runtime/WerewolfGameClient.ts', form: 'werewolf-client-interface' },
    { file: 'games/werewolf/runtime/werewolfGameActions.ts', form: 'werewolf-actions-plumbing' },
  ],
  avalon: [{ file: 'games/avalon/room/hooks/useAvalonRoomState.ts', form: 'parameterized-submit' }],
  undercover: [
    {
      file: 'games/undercover/room/hooks/useUndercoverRoundControls.ts',
      form: 'parameterized-submit',
    },
  ],
  drawguess: [
    { file: 'games/drawguess/room/hooks/useDrawGuessRoomState.ts', form: 'parameterized-submit' },
  ],
  fibking: [
    { file: 'games/fibking/room/hooks/useFibRoomScreenState.ts', form: 'hardcoded-null-submit' },
  ],
  pictionary: [
    {
      file: 'games/pictionary/room/hooks/usePictionaryRoomScreenState.ts',
      form: 'hardcoded-null-submit',
    },
  ],
  storyrelay: [
    {
      file: 'games/storyrelay/room/hooks/useStoryRelayRoomState.ts',
      form: 'hardcoded-null-submit',
    },
    {
      file: 'games/storyrelay/room/components/StoryRelayStage.tsx',
      form: 'hardcoded-null-submit',
    },
  ],
  demo: [{ file: 'games/demo/room/hooks/useDemoRoomState.ts', form: 'parameterized-submit' }],
};

function expectParameterizedSubmit(source: string): void {
  expect(source).toMatch(
    /const submit = \(label: string, command: \w+, control: number \| null = null\)/,
  );
  expect(source).toMatch(/session\.dispatch\(command, \{ controlledSeat: control, label \}\)/);
  expect(source).not.toMatch(AMBIENT_CONTROLLED_SEAT_FUNNEL);
}

function expectHardcodedNullSubmit(source: string): void {
  expect(source).toMatch(/session\.dispatch\(command, \{ controlledSeat: null, label \}\)/);
  expect(source).not.toMatch(AMBIENT_CONTROLLED_SEAT_FUNNEL);
}

function expectWerewolfClientInterface(source: string): void {
  // 座位动作方法：controlledSeat 是显式参数（可为 null 表示本人）。
  expect(source).toMatch(/markViewedRole\(controlledSeat: number \| null\)/);
  expect(source).toMatch(/submitRevealAck\(controlledSeat: number \| null\)/);
  expect(source).toMatch(/registerSheriffCandidate\(controlledSeat: number \| null\)/);
  expect(source).toMatch(/submitGroupConfirmAck\(controlledSeat: number \| null\)/);
  // 房主方法：签名里根本没有 controlledSeat，结构上不可能挂接管座位。
  expect(source).toMatch(/advanceSheriffElection\(\)/);
  expect(source).toMatch(/endSheriffElectionBySelfDestruct\(\)/);
  expect(source).toMatch(/postProgression\(\)/);
}

function expectWerewolfActionsPlumbing(source: string): void {
  // 管道把 controlledSeat 收为必填参数逐次转发，不设任何默认。
  expect(source).toMatch(/command: WerewolfPublicCommand,\s+controlledSeat: number \| null,/);
  expect(source).not.toMatch(/controlledSeat: number \| null\s*=/);
}

const FORM_ASSERTIONS: Record<DispatchForm, (source: string) => void> = {
  'parameterized-submit': expectParameterizedSubmit,
  'hardcoded-null-submit': expectHardcodedNullSubmit,
  'werewolf-client-interface': expectWerewolfClientInterface,
  'werewolf-actions-plumbing': expectWerewolfActionsPlumbing,
};

describe('bot dispatch discipline — registration covers every game', () => {
  it('every GAME_TYPES entry has a registered dispatch site, and no extras', () => {
    expect(Object.keys(DISPATCH_SITES).sort()).toEqual([...GAME_TYPES].sort());
  });
});

describe('bot dispatch discipline — submit funnels default to uncontrolled', () => {
  for (const gameType of GAME_TYPES) {
    for (const site of DISPATCH_SITES[gameType]) {
      it(`${gameType}: ${site.file} follows the ${site.form} form`, () => {
        FORM_ASSERTIONS[site.form](readSource(site.file));
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
    expect(screen()).toMatch(/submit\(\s*'选择题目',\s*\{[^}]*\},\s*controlledSeat,?\s*\)/);
  });

  it('giving up the round (a drawer seat action) passes controlledSeat explicitly', () => {
    expect(screen()).toMatch(
      /submit\(\s*'放弃本轮',\s*\{ type: 'drawguess\.round\.finish' \},\s*controlledSeat,?\s*\)/,
    );
  });
});
