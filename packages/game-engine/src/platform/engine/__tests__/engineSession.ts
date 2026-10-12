/**
 * Engine test harness (AU-44) — the one session-style driver for
 * engine tests.
 *
 * Target form (from the audit): tests exercise an engine through
 * authoritative commands only — never injecting progressed state —
 * running every command through decide → evolve → normalize, with
 * an optional persistence round-trip (JSON serialize + the game's
 * own parser) per command, which is the strictest existing form
 * (avalon). Games migrate their hand-rolled dispatch boilerplate to
 * this session; game-specific flows stay in each game's test files
 * as thin helpers over it.
 */

import { expect } from 'vitest';

import type { BaseGameState } from '../../protocol/roomSnapshot';
import type {
  CommandContext,
  CreateGameContext,
  Decision,
  GameCommand,
  GameEffect,
  GameEngineDefinition,
  GameEvent,
} from '../types';

export interface EngineSessionOptions<TState, TConfig> {
  /** The config handed to createInitialState. */
  readonly config: TConfig;
  /** Create-context overrides (roomCode / hostUserId / nowMs / commandId). */
  readonly create?: Partial<CreateGameContext>;
  /**
   * The game's own state parser. When given, every committed state
   * is JSON-round-tripped through it, so a test can only ever hold
   * states the persistence layer would accept.
   */
  readonly parse?: (value: unknown) => TState;
  /**
   * Constant random seed for every command context. Suites whose
   * incumbent harness pinned one seed (storyrelay used 'round')
   * keep it, so seed-derived layouts stay identical.
   */
  readonly randomSeed?: string;
}

export interface EngineSession<
  TState,
  TCommand extends GameCommand,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
> {
  /** The current authoritative state. */
  readonly state: TState;
  /** Every effect committed so far, in order. */
  readonly effects: readonly TEffect[];
  /** The session clock (commands stamp it; tests may move it). */
  now(): number;
  setNow(nowMs: number): void;
  advance(ms: number): void;
  /** A user command context (deterministic ids/seeds per session). */
  context(userId?: string, controlledSeat?: number | null): CommandContext;
  /** A system command context (effect-driven completions). */
  systemContext(effectId: string): CommandContext;
  /** Decide + apply a command as a user; throws on reject. */
  send(command: TCommand, userId?: string, controlledSeat?: number | null): TState;
  /** Decide + apply a command with an explicit context; throws on reject. */
  sendAs(command: TCommand, context: CommandContext): TState;
  /** Raw decision as a user, without applying it. */
  decide(
    command: TCommand,
    userId?: string,
    controlledSeat?: number | null,
  ): Decision<TEvent, TEffect>;
  /** Raw decision with an explicit context, without applying it. */
  decideAs(command: TCommand, context: CommandContext): Decision<TEvent, TEffect>;
  /** Assert a command rejects with exactly this reason. */
  expectReject(
    command: TCommand,
    reason: string,
    userId?: string,
    controlledSeat?: number | null,
  ): void;
}

export function createEngineSession<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
  TConfig,
  TCommand extends GameCommand,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
>(
  engine: GameEngineDefinition<TGameType, TState, TConfig, TCommand, TEvent, TEffect>,
  options: EngineSessionOptions<TState, TConfig>,
): EngineSession<TState, TCommand, TEvent, TEffect> {
  let nowMs = options.create?.nowMs ?? 1000;
  let commandNumber = 0;
  let state: TState = engine.createInitialState(options.config, {
    roomCode: '1234',
    hostUserId: 'host',
    commandId: 'create',
    ...options.create,
    nowMs,
  });
  const effects: TEffect[] = [];

  const nextExecution = () => {
    // Matches the incumbent avalon/drawguess harness pairing:
    // command N carries seed N+1.
    const commandId = `command:${commandNumber++}`;
    return { nowMs, commandId, randomSeed: options.randomSeed ?? `seed:${commandNumber}` };
  };

  const context = (userId = 'host', controlledSeat: number | null = null): CommandContext => ({
    actor: { kind: 'user', userId },
    controlledSeat,
    ...nextExecution(),
  });

  const systemContext = (effectId: string): CommandContext => ({
    actor: { kind: 'system', effectId },
    controlledSeat: null,
    ...nextExecution(),
  });

  const decideAs = (command: TCommand, ctx: CommandContext) => engine.decide(state, command, ctx);

  const sendAs = (command: TCommand, ctx: CommandContext) => {
    const decision = decideAs(command, ctx);
    const next = applyDecision(engine, state, decision, options.parse);
    state = next;
    if (decision.kind === 'commit') effects.push(...decision.effects);
    return state;
  };

  return {
    get state() {
      return state;
    },
    effects,
    now: () => nowMs,
    setNow: (next: number) => {
      nowMs = next;
    },
    advance: (ms: number) => {
      nowMs += ms;
    },
    context,
    systemContext,
    send: (command, userId, controlledSeat) => sendAs(command, context(userId, controlledSeat)),
    sendAs,
    decide: (command, userId, controlledSeat) => decideAs(command, context(userId, controlledSeat)),
    decideAs,
    expectReject: (command, reason, userId, controlledSeat) => {
      expect(decideAs(command, context(userId, controlledSeat))).toEqual({
        kind: 'reject',
        reason,
      });
    },
  };
}

/**
 * Applies a decision to a state: throws on reject, otherwise
 * evolve-reduces the events, normalizes, and optionally
 * round-trips through the game's parser.
 */
export function applyDecision<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
  TConfig,
  TCommand extends GameCommand,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
>(
  engine: GameEngineDefinition<TGameType, TState, TConfig, TCommand, TEvent, TEffect>,
  state: TState,
  decision: Decision<TEvent, TEffect>,
  parse?: (value: unknown) => TState,
): TState {
  if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  const evolved = decision.events.reduce(engine.evolve, state);
  const normalized = engine.normalize(evolved);
  return parse === undefined ? normalized : parse(JSON.parse(JSON.stringify(normalized)));
}

/**
 * The stateless core of the session: decide + apply in one call.
 * Suites written in the functional dispatch style (state threaded
 * explicitly) route their local dispatch helper through this.
 */
export function dispatchCommand<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
  TConfig,
  TCommand extends GameCommand,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
>(
  engine: GameEngineDefinition<TGameType, TState, TConfig, TCommand, TEvent, TEffect>,
  state: TState,
  command: TCommand,
  context: CommandContext,
  parse?: (value: unknown) => TState,
): TState {
  return applyDecision(engine, state, engine.decide(state, command, context), parse);
}
