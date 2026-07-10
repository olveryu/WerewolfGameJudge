/** Pure contracts implemented by every game engine. */

import type { GameType } from '../protocol/gameTypes';
import type { BaseGameState } from '../protocol/roomSnapshot';

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

export interface CommandContext {
  readonly actorUserId: string;
  readonly controlledSeat: number | null;
  readonly nowMs: number;
  readonly commandId: string;
}

export type CommittedCommandOutcome =
  | { readonly kind: 'success'; readonly reason?: string }
  | { readonly kind: 'domainRejected'; readonly reason: string };

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

export interface GameEngineDefinition<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TConfig,
  TCommand extends GameCommand,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
> {
  readonly gameType: TGameType;
  readonly stateVersion: number;
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
