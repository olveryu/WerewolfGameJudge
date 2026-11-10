/**
 * createDrawGuessStageHud: the information bar for word select, drawing and round end, built
 * from real engine states; lobby and the final ranking are not stage content.
 */
import {
  DEFAULT_DRAWGUESS_CONFIG,
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_WORD_SELECT_SECONDS,
  type DrawGuessCommand,
  drawGuessEngine,
  type DrawGuessState,
  getDrawGuessViewModel,
} from '@game-judge/game-engine/games/drawguess/public';

import { seatSource, seatViewModel } from '@/test-utils/roomSeat';

import {
  createDrawGuessStageHud,
  DRAWGUESS_BOT_DRAWER_URGENT_SECONDS,
  type DrawGuessStageHudInput,
} from '../drawGuessStageHud';

type CommandContext = Parameters<typeof drawGuessEngine.decide>[2];

const NOW_MS = 1000;

/**
 * A four-seat game: the host sits at `hostSeat` and bots fill the rest. The drawer queue runs in
 * seat order, so seat 0 draws first.
 */
function playTo(hostSeat: number, target: 'lobby' | 'wordSelect' | 'drawing' | 'roundEnd') {
  let commandNumber = 0;
  let nowMs = NOW_MS;
  let state: DrawGuessState = drawGuessEngine.createInitialState(
    { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs, commandId: 'create' },
  );
  const apply = (command: DrawGuessCommand, context: CommandContext) => {
    const decision = drawGuessEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(drawGuessEngine.evolve, state);
  };
  const execution = () => {
    commandNumber += 1;
    return { nowMs, commandId: `command:${commandNumber}`, randomSeed: `seed:${commandNumber}` };
  };
  const asHost = (command: DrawGuessCommand, controlledSeat: number | null = null) =>
    apply(command, { actor: { kind: 'user', userId: 'host' }, controlledSeat, ...execution() });
  const asSystem = (command: DrawGuessCommand) =>
    apply(command, {
      actor: { kind: 'system', effectId: 'effect:test' },
      controlledSeat: null,
      ...execution(),
    });

  asHost({ type: 'room.seat.take', seat: hostSeat, profile: { displayName: '房主' } });
  asHost({ type: 'room.seat.fillBots' });
  if (target === 'lobby') return state;
  asHost({ type: 'drawguess.game.begin' });
  asSystem({
    type: 'drawguess.words.dealt',
    turnIndex: 0,
    choices: [
      { word: '大熊猫', pinyinInitials: 'd x m' },
      { word: '火锅', pinyinInitials: 'h g' },
      { word: '风筝', pinyinInitials: 'f z' },
    ],
  });
  if (target === 'wordSelect') return state;
  asHost(
    {
      type: 'drawguess.word.choose',
      word: '大熊猫',
      phaseRevision: state.phaseRevision,
      turnIndex: state.turnIndex,
    },
    hostSeat === 0 ? null : 0,
  );
  if (target === 'drawing') return state;
  if (state.phase.kind !== 'drawing') throw new Error('expected drawing');
  nowMs = state.phase.deadlineAt;
  asSystem({ type: 'drawguess.phase.settleExpired' });
  return state;
}

/** Seat 1 has guessed (success badge); the others carry no badge. */
const SEATS = seatSource([
  seatViewModel(0),
  seatViewModel(1, { statusBadge: { label: '已猜中', tone: 'success' } }),
  seatViewModel(2, { isBot: true }),
  seatViewModel(3, { isBot: true }),
]);

function hudInput(
  state: DrawGuessState,
  overrides: Partial<DrawGuessStageHudInput> = {},
): DrawGuessStageHudInput {
  const effectiveSeat = overrides.effectiveSeat === undefined ? 0 : overrides.effectiveSeat;
  return {
    state,
    viewModel: getDrawGuessViewModel(state, effectiveSeat, NOW_MS),
    effectiveSeat,
    remainingSeconds: 42,
    seats: SEATS,
    canTakeOverBots: true,
    controlledSeat: null,
    ...overrides,
  };
}

describe('createDrawGuessStageHud', () => {
  it('returns null outside the in-play phases', () => {
    expect(createDrawGuessStageHud(hudInput(playTo(0, 'lobby')))).toBeNull();
  });

  it('throws when an in-play phase has no remaining seconds', () => {
    expect(() =>
      createDrawGuessStageHud(hudInput(playTo(0, 'wordSelect'), { remainingSeconds: null })),
    ).toThrow('DrawGuess wordSelect stage has no remaining seconds');
  });

  it('shows the turn, a plain roster and the word select countdown', () => {
    const hud = createDrawGuessStageHud(hudInput(playTo(0, 'wordSelect')));
    expect(hud).toEqual({
      chips: [{ key: 'turn', label: '1/8 轮', detail: null, tone: 'neutral' }],
      roster: {
        chipLabel: '名单',
        title: '本轮玩家',
        groupTitles: { acting: '画手', pending: '等待', done: '已猜中' },
        actingSeat: 0,
        pendingLabel: '等待',
        isUrgent: false,
      },
      timer: { label: '选词', remainingSeconds: 42, totalSeconds: DRAWGUESS_WORD_SELECT_SECONDS },
    });
  });

  it('shows the word to the drawer with the score chip and the guessed count', () => {
    const hud = createDrawGuessStageHud(hudInput(playTo(0, 'drawing')));
    expect(hud?.chips).toEqual([
      { key: 'turn', label: '1/8 轮', detail: null, tone: 'neutral' },
      { key: 'word', label: '大熊猫', detail: '3 字', tone: 'accent' },
      { key: 'score', label: '我 0 分 · 本轮 +0', detail: null, tone: 'neutral' },
    ]);
    expect(hud?.roster?.chipLabel).toBe('已猜中 1/3');
    expect(hud?.roster?.groupTitles.pending).toBe('还在猜');
    expect(hud?.timer).toEqual({
      label: '作画',
      remainingSeconds: 42,
      totalSeconds: DRAWGUESS_DRAWING_DURATION_SECONDS,
    });
  });

  it('shows the pinyin-initial hint to a guesser', () => {
    const hud = createDrawGuessStageHud(hudInput(playTo(0, 'drawing'), { effectiveSeat: 2 }));
    expect(hud?.chips[1]).toEqual({ key: 'word', label: '_ _ _', detail: '3 字', tone: 'accent' });
  });

  it('omits the score chip for a spectator', () => {
    const hud = createDrawGuessStageHud(hudInput(playTo(0, 'drawing'), { effectiveSeat: null }));
    expect(hud?.chips.map((chip) => chip.key)).toEqual(['turn', 'word']);
  });

  it('shows only the turn and the round end countdown after the drawing', () => {
    const hud = createDrawGuessStageHud(hudInput(playTo(0, 'roundEnd')));
    expect(hud).toEqual({
      chips: [{ key: 'turn', label: '1/8 轮', detail: null, tone: 'neutral' }],
      roster: null,
      timer: { label: '结算', remainingSeconds: 42, totalSeconds: DRAWGUESS_ROUND_END_SECONDS },
    });
  });

  describe('bot drawer alert', () => {
    const almostOut = DRAWGUESS_BOT_DRAWER_URGENT_SECONDS - 1;

    it('marks the roster when a bot drawer nobody controls is running out of time', () => {
      const state = playTo(3, 'drawing');
      const hud = createDrawGuessStageHud(
        hudInput(state, { effectiveSeat: 3, remainingSeconds: almostOut }),
      );
      expect(hud?.roster?.isUrgent).toBe(true);
    });

    it('stays calm with time left, under control, without takeover rights, or a human drawer', () => {
      const botDrawer = playTo(3, 'drawing');
      const calm: Partial<DrawGuessStageHudInput>[] = [
        { remainingSeconds: DRAWGUESS_BOT_DRAWER_URGENT_SECONDS },
        { remainingSeconds: almostOut, controlledSeat: 0 },
        { remainingSeconds: almostOut, canTakeOverBots: false },
      ];
      for (const overrides of calm) {
        const hud = createDrawGuessStageHud(
          hudInput(botDrawer, { effectiveSeat: 3, ...overrides }),
        );
        expect(hud?.roster?.isUrgent).toBe(false);
      }
      const humanDrawer = createDrawGuessStageHud(
        hudInput(playTo(0, 'drawing'), { remainingSeconds: almostOut }),
      );
      expect(humanDrawer?.roster?.isUrgent).toBe(false);
    });
  });
});
