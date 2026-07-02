/**
 * GameEngine registry types — the Strategy contract every game implements.
 *
 * A `GameEngine` bundles one game's authoritative pure logic:
 *   - Factory:   createInitialState (server builds the initial state from a validated config)
 *   - Command:   dispatch (route an inbound action to the game's pure handlers)
 *   - Strategy:  reduce + normalize (the game's own state machine, never werewolf's)
 *
 * Deliberately game-agnostic and dependency-free:
 *   - No zod here. Request-body validation lives at the api-worker boundary; an engine
 *     receives an already-typed `TConfig`.
 *   - No Cloudflare `Env` here. Runtime effects such as XP settlement live in the Worker
 *     effect registry and run only after the authoritative state is committed.
 *
 * The action type is a type parameter so each engine carries its OWN action union
 * (fib uses `FibAction`, never werewolf `StateAction`).
 */

import { type SideEffect, STANDARD_SIDE_EFFECTS } from '../../protocol/common';

/** Inbound command: a domain action name + its (engine-validated) payload. */
export interface GameAction {
  readonly actionType: string;
  readonly payload: unknown;
}

/** Context the platform shell passes to an engine when a room of its type is created. */
export interface CreateCtx {
  readonly roomCode: string;
  readonly hostUserId: string;
}

/**
 * Result of an engine handler — generic over the engine's action type.
 *
 * Mirrors werewolf `HandlerResult` semantics but parameterized so each engine reduces
 * with its own action union:
 * - `success`:   completed; has actions to apply + persist + broadcast
 * - `rejection`: business rejection; has actions (e.g. mark rejected) to persist + broadcast
 * - `error`:     precondition/infra failure; no actions, mapped to an error result
 *
 * Omitted/undefined `sideEffects` at the factory boundary means the platform default:
 * broadcast the committed state and mark it persisted. Pass `[]` only for an explicitly
 * effect-free result.
 */
export interface EngineSuccess<TAction> {
  readonly kind: 'success';
  readonly actions: readonly TAction[];
  readonly sideEffects: readonly SideEffect[];
  readonly reason?: string;
  /** `undefined` = platform default; `null` = broadcast without lastAction. */
  readonly broadcastAction?: string | null;
}

export interface EngineRejection<TAction> {
  readonly kind: 'rejection';
  readonly reason: string;
  readonly actions: readonly TAction[];
  readonly sideEffects: readonly SideEffect[];
  /** `undefined` = platform default; `null` = broadcast without lastAction. */
  readonly broadcastAction?: string | null;
}

export interface EngineError {
  readonly kind: 'error';
  readonly reason: string;
}

export type EngineResult<TAction> = EngineSuccess<TAction> | EngineRejection<TAction> | EngineError;

export interface AfterReduceContext<TAction> {
  readonly trigger: GameAction;
  readonly result: EngineSuccess<TAction>;
  readonly nowMs: number;
}

export function engineSuccess<TAction>(
  actions: readonly TAction[],
  sideEffects: readonly SideEffect[] = STANDARD_SIDE_EFFECTS,
  reason?: string,
  broadcastAction?: string | null,
): EngineResult<TAction> {
  return { kind: 'success', actions, sideEffects, reason, broadcastAction };
}

export function engineRejection<TAction>(
  reason: string,
  actions: readonly TAction[] = [],
  sideEffects: readonly SideEffect[] = STANDARD_SIDE_EFFECTS,
  broadcastAction?: string | null,
): EngineResult<TAction> {
  return { kind: 'rejection', reason, actions, sideEffects, broadcastAction };
}

export function engineError<TAction = never>(reason: string): EngineResult<TAction> {
  return { kind: 'error', reason };
}

/**
 * One game's full authoritative logic = one Strategy.
 *
 * @typeParam TState  - the game's broadcast state blob (e.g. FibState)
 * @typeParam TAction - the game's own reducer action union (e.g. FibAction)
 * @typeParam TConfig - the validated create config (e.g. { numberOfPlayers })
 */
export interface GameEngine<TState, TAction, TConfig> {
  readonly gameType: string;

  /** Factory: build the authoritative initial state from a validated config. */
  createInitialState(config: TConfig, ctx: CreateCtx): TState;

  /** Command: route an inbound action to this game's pure handlers. */
  dispatch(state: TState, revision: number, action: GameAction): EngineResult<TAction>;

  /** Optional same-transaction pure follow-up after the initial actions reduce. */
  afterReduce?(state: TState, context: AfterReduceContext<TAction>): readonly TAction[];

  /** Strategy: this game's own reducer (pure, total). */
  reduce(state: TState, action: TAction): TState;

  /** Strategy: this game's own normalize + completeness guard. */
  normalize(state: TState): TState;
}
