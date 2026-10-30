/**
 * Game client shape — the one contract every game client must satisfy
 * (docs/game-client-convergence-design.md §8). Driven by GAME_TYPES, so a
 * new game is covered the moment it is registered.
 *
 * 1. `module.ts` goes through `defineClientGameModule` and never touches the
 *    link factory.
 * 2. The room-state hook (`room/hooks/use*RoomState.ts`, exactly one per
 *    game) composes the platform session and takeover controllers and never
 *    reaches for their primitives.
 * 3. Bots are a platform concept: no game (client or engine) synthesises a
 *    bot user id, and the shared bot occupant carries no `userId`.
 * 4. Game-owned pure interaction policy is legal; recomputing engine rules
 *    on the client is not. No game keeps a `room/seatTap/` or
 *    `room/executors/` tree.
 * 5. Deadlines are server facts: `useStageDeadline` never takes `isHost`, and
 *    the only countdown clock is the deadline's own tick.
 */

import { GAME_TYPES, type GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..', '..');
const ENGINE_GAMES_ROOT = join(SRC_ROOT, '..', 'packages', 'game-engine', 'src', 'games');

function readSource(relativePath: string): string {
  const fullPath = join(SRC_ROOT, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Expected source file to exist: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

function productionFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__' || entry === 'node_modules') continue;
      files.push(...productionFiles(full));
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec|stories)\./.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function roomStateHookPath(gameType: GameType): string {
  const hooksDir = join(SRC_ROOT, 'games', gameType, 'room', 'hooks');
  const matches = readdirSync(hooksDir).filter((name) => /^use\w+RoomState\.ts$/.test(name));
  if (matches.length !== 1) {
    throw new Error(
      `${gameType}: expected exactly one room/hooks/use*RoomState.ts, found ${matches.join(', ')}`,
    );
  }
  return `games/${gameType}/room/hooks/${matches[0]}`;
}

/** Hooks a room must not call directly: the platform composes them (useReadyRoomSession / useBotTakeover). */
const TAKEOVER_PRIMITIVES = [
  'useRoomBotControl(',
  'useBotTakeoverGuard(',
  'useBotTakeoverLongPress(',
  'useRoomLinkSnapshot(',
  'useRoomCommandSubmission(',
  'useAuthContext(',
] as const;

/** Bot id synthesis in any spelling: `bot-${seat}`, `'x-bot:…'`, `getXBotUserId`. */
const BOT_ID_SYNTHESIS = [/bot-\$\{/, /['`]\w*-bot:/, /\w+BotUserId\b/] as const;

const ENGINE_RULE_MODULES =
  /from '(@game-judge\/game-engine|\.\.\/)+.*\/(domain\/handlers|DeathCalculator|domain\/resolvers)/;

describe('game client shape (§8) — module definition', () => {
  it.each(GAME_TYPES)(
    '%s: module.ts uses defineClientGameModule and no RoomLinkFactory',
    (game) => {
      const source = readSource(`games/${game}/module.ts`);
      expect(source).toMatch(/defineClientGameModule</);
      expect(source).not.toMatch(/RoomLinkFactory/);
    },
  );
});

describe('game client shape (§8) — room-state hook composes the platform controllers', () => {
  it.each(GAME_TYPES)('%s: use*RoomState calls useReadyRoomSession and useBotTakeover', (game) => {
    const source = readSource(roomStateHookPath(game));
    expect(source).toMatch(/useReadyRoomSession\(/);
    expect(source).toMatch(/useBotTakeover\(\{/);
    expect(source).toMatch(/createRoomSeatPressHandler\(\{/);
  });

  it('no room file calls a takeover / session primitive directly', () => {
    const offenders: string[] = [];
    for (const game of GAME_TYPES) {
      for (const file of productionFiles(join(SRC_ROOT, 'games', game, 'room'))) {
        const source = readFileSync(file, 'utf8');
        for (const primitive of TAKEOVER_PRIMITIVES) {
          if (source.includes(primitive)) offenders.push(`${file}: ${primitive}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the platform composes the primitives exactly once', () => {
    const composed = readSource('features/room/controllers/useBotTakeover.ts');
    expect(composed).toMatch(/useRoomBotControl\(/);
    expect(composed).toMatch(/useBotTakeoverGuard\(/);
    expect(composed).toMatch(/useBotTakeoverLongPress\(/);
    const guard = readSource('features/room/controllers/useBotTakeoverGuard.ts');
    expect(guard).toMatch(/canControlBots: boolean;/);
    expect(guard).toMatch(/seatStillBot: boolean;/);
  });
});

describe('game client shape (§8) — bots are a platform concept', () => {
  it('no game client or engine source synthesises a bot user id', () => {
    const offenders: string[] = [];
    for (const file of [
      ...productionFiles(join(SRC_ROOT, 'games')),
      ...productionFiles(ENGINE_GAMES_ROOT),
    ]) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of BOT_ID_SYNTHESIS) {
        if (pattern.test(source)) offenders.push(`${file}: ${pattern.source}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the shared bot occupant and profile target carry no userId', () => {
    expect(readSource('features/room/model/RoomOccupant.ts')).toMatch(
      /\{ readonly kind: 'bot'; readonly seat: number \}/,
    );
    const profileTarget = readSource('features/room/model/getRoomProfileTarget.ts');
    expect(profileTarget).toMatch(/occupant: \{ kind: 'bot', seat \}/);
    expect(profileTarget).not.toMatch(/kind: 'bot'[^}]*userId/);
  });
});

describe('game client shape (§8) — client policy never recomputes engine rules', () => {
  it.each(GAME_TYPES)('%s: no room/seatTap or room/executors tree', (game) => {
    expect(existsSync(join(SRC_ROOT, 'games', game, 'room', 'seatTap'))).toBe(false);
    expect(existsSync(join(SRC_ROOT, 'games', game, 'room', 'executors'))).toBe(false);
  });

  it('policy and night modules import no engine rule modules', () => {
    const offenders: string[] = [];
    for (const game of GAME_TYPES) {
      for (const dir of ['policy', 'night']) {
        for (const file of productionFiles(join(SRC_ROOT, 'games', game, 'room', dir))) {
          if (ENGINE_RULE_MODULES.test(readFileSync(file, 'utf8'))) offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('game client shape (§8) — deadlines are server facts', () => {
  it('no useStageDeadline call takes isHost', () => {
    const offenders: string[] = [];
    for (const file of productionFiles(join(SRC_ROOT, 'games'))) {
      const source = readFileSync(file, 'utf8');
      for (const call of source.matchAll(/useStageDeadline\(\{[\s\S]*?\}\)/g)) {
        if (/\bisHost\b/.test(call[0])) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no game owns a countdown clock besides the deadline tick', () => {
    const offenders: string[] = [];
    for (const file of productionFiles(join(SRC_ROOT, 'games'))) {
      const source = readFileSync(file, 'utf8');
      if (/useNowMs\(|new Date\(\)\.getTime\(\) - .*deadline/.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
