/** Pure contracts implemented by every game engine. */

import type { CommittedCommandOutcome } from '../protocol/commandResult';
import type { BaseGameState } from '../protocol/roomSnapshot';

export type { CommittedCommandOutcome } from '../protocol/commandResult';

export type CommonGameLifecycle = 'setup' | 'ongoing' | 'ended';

export interface GameCommand {
  readonly type: string;
}

export interface GameEvent {
  readonly type: string;
}

export interface GameEffect {
  readonly type: string;
}

export interface CreateGameContext {
  readonly roomCode: string;
  readonly hostUserId: string;
  readonly nowMs: number;
  readonly commandId: string;
}

export interface CommandExecutionContext {
  readonly nowMs: number;
  readonly commandId: string;
  readonly randomSeed: string;
}

export type CommandActor =
  | { readonly kind: 'user'; readonly userId: string }
  | { readonly kind: 'system'; readonly effectId: string };

export type CommandContext =
  | (CommandExecutionContext & {
      readonly actor: Extract<CommandActor, { readonly kind: 'user' }>;
      readonly controlledSeat: number | null;
    })
  | (CommandExecutionContext & {
      readonly actor: Extract<CommandActor, { readonly kind: 'system' }>;
      readonly controlledSeat: null;
    });

export type Decision<TEvent extends GameEvent, TEffect extends GameEffect> =
  | {
      readonly kind: 'commit';
      readonly events: readonly TEvent[];
      readonly effects: readonly TEffect[];
      readonly broadcast: 'state' | 'none';
      readonly outcome: CommittedCommandOutcome;
    }
  | {
      readonly kind: 'reject';
      readonly reason: string;
    };

/**
 * Chassis capabilities a game declares in its engine definition. This
 * interface is the single declaration source for every capability
 * switch: worker and client code that needs a switch derives it from
 * the engine definition (the client through the server projection),
 * never from a second declaration. Switches only say whether the game
 * hooks into a platform capability; they never assemble gameplay
 * (template red line). `capabilities.contract.test.ts` welds each
 * declaration to the wiring it claims.
 *
 * - `nightPhase`: the game runs a night segment (step progression +
 *   narration audio) after the host begins play.
 * - `botsAndTakeover`: roster bots — fill/clear seats, host long-press
 *   takeover, and the controlled-seat banner.
 * - `identityViewing`: dealing plus the identity-viewing checkpoint
 *   (every seat's view record, bots included, gates the start).
 * - `revealAnimation`: role-card reveal animation and equipped reveal
 *   effects; depends on `identityViewing`.
 * - `stageDeadline`: stage deadline countdown with silent expiry
 *   dispatch.
 * - `audioOrchestration`: BGM/sound queue orchestration with host ack.
 * - `wordLibrary`: the word-supply pipeline (generation, review, and
 *   publication workflow).
 * - `gallery`: work gallery / replay surfaces for created content.
 * - `hostConfig`: the in-room host configuration panel.
 * - `botTestScaffold`: the host-only manual bot test scaffold (bulk
 *   bot-advance actions such as mark-all-bots-viewed).
 */
export interface GameEngineCapabilities {
  readonly nightPhase: boolean;
  readonly botsAndTakeover: boolean;
  readonly identityViewing: boolean;
  readonly revealAnimation: boolean;
  readonly stageDeadline: boolean;
  readonly audioOrchestration: boolean;
  readonly wordLibrary: boolean;
  readonly gallery: boolean;
  readonly hostConfig: boolean;
  readonly botTestScaffold: boolean;
}

export interface GameEngineDefinition<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
  TConfig,
  TCommand extends GameCommand,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
> {
  readonly gameType: TGameType;
  readonly stateVersion: number;
  readonly capabilities: GameEngineCapabilities;
  createInitialState(config: TConfig, context: CreateGameContext): TState;
  decide(state: TState, command: TCommand, context: CommandContext): Decision<TEvent, TEffect>;
  evolve(state: TState, event: TEvent): TState;
  normalize(state: TState): TState;
  getLifecycle(state: TState): CommonGameLifecycle;
}

export type StateOf<TEngine> =
  TEngine extends GameEngineDefinition<
    infer _TGameType,
    infer TState,
    infer _TConfig,
    infer _TCommand,
    infer _TEvent,
    infer _TEffect
  >
    ? TState
    : never;

export type ConfigOf<TEngine> =
  TEngine extends GameEngineDefinition<
    infer _TGameType,
    infer _TState,
    infer TConfig,
    infer _TCommand,
    infer _TEvent,
    infer _TEffect
  >
    ? TConfig
    : never;

export type CommandOf<TEngine> =
  TEngine extends GameEngineDefinition<
    infer _TGameType,
    infer _TState,
    infer _TConfig,
    infer TCommand,
    infer _TEvent,
    infer _TEffect
  >
    ? TCommand
    : never;

export type EventOf<TEngine> =
  TEngine extends GameEngineDefinition<
    infer _TGameType,
    infer _TState,
    infer _TConfig,
    infer _TCommand,
    infer TEvent,
    infer _TEffect
  >
    ? TEvent
    : never;

export type EffectOf<TEngine> =
  TEngine extends GameEngineDefinition<
    infer _TGameType,
    infer _TState,
    infer _TConfig,
    infer _TCommand,
    infer _TEvent,
    infer TEffect
  >
    ? TEffect
    : never;
