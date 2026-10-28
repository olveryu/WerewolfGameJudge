/**
 * Contract a game supplies to get a schema-driven config screen.
 *
 * The game owns its data: the engine schema, how to read the current config out
 * of an authoritative lobby snapshot, the typed update command, the creation
 * payload and failure copy. The shared screen owns presentation, create/edit
 * orchestration, inline validation, reset and submission. Games that need a
 * control the schema kinds cannot express plug in a `fieldRenderers` entry or
 * an `Extra` block; neither may bypass `schema` validation.
 */

import type {
  AnyConfigFieldSpec,
  ConfigFieldValue,
  GameConfigSchema,
} from '@game-judge/game-engine/platform/config/configSchema';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type React from 'react';

import type { StandardConfigRouteParams } from '@/features/navigation/model/standardRouteParsers';
import type { DispatchOutcome } from '@/platform/realtime/types';

export interface ConfigFieldRendererProps {
  readonly spec: AnyConfigFieldSpec;
  readonly value: ConfigFieldValue;
  readonly onChange: (value: ConfigFieldValue) => void;
  /** Inline validation message for this field, or null. */
  readonly issueMessage: string | null;
  readonly testID: string;
}

export type ConfigFieldRenderer = React.ComponentType<ConfigFieldRendererProps>;

/** Blocks submission until an asynchronous precondition (e.g. a word inventory) is ready. */
export interface ConfigSubmitGate {
  readonly isReady: boolean;
  readonly blockedTitle: string;
  readonly blockedMessage: string;
}

export interface GameConfigScreenDefinition<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TConfig extends object,
> {
  readonly schema: GameConfigSchema<TConfig>;
  readonly parseRouteParams: (params: unknown) => StandardConfigRouteParams<TGameType>;
  /** Current config of an editable lobby, or null when the state is not editable. */
  readonly readConfig: (state: TState) => TConfig | null;
  readonly buildUpdateCommand: (config: TConfig) => TCommand;
  /** Creation payload; defaults to the config object itself. */
  readonly buildCreateConfig?: (config: TConfig) => Readonly<Record<string, unknown>>;
  readonly getFailureMessage: (result: DispatchOutcome<TState>) => string;
  /** Error-pipeline label for creation failures, e.g. `创建谁是卧底房间`. */
  readonly creationLabel: string;
  /** Footer summary line; defaults to `共 N 人` from `numberOfPlayers` when present. */
  readonly summary?: (config: TConfig) => string;
  readonly fieldRenderers?: { readonly [K in keyof TConfig]?: ConfigFieldRenderer };
  /** Rendered below the form inside the scrolling content. */
  readonly Extra?: React.ComponentType<{ readonly config: TConfig }>;
  /** Hook evaluated on every render with the current config; must follow the rules of hooks. */
  readonly useSubmitGate?: (config: TConfig) => ConfigSubmitGate;
}
