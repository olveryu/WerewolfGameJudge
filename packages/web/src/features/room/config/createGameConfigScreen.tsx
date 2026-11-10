/**
 * Builds the config page for one session-based game: `${displayName}设置` header with a reset
 * action, the schema form plus the game's optional Extra block, and a footer with the summary
 * line and the create/save button (disabled while the form has an issue or the gate is closed).
 */
import './GameConfigPage.css';

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { ComponentType } from 'react';
import { useParams } from 'react-router';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { roomPath } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomLink } from '@/platform/realtime/types';
import { TESTIDS } from '@/testids';
import IconTrashOutline from '~icons/ion/trash-outline';

import { GameConfigForm } from './GameConfigForm';
import { describeDefaultSummary } from './gameConfigFormModel';
import type { GameConfigScreenDefinition } from './GameConfigScreenDefinition';
import { useGameConfigScreenState } from './useGameConfigScreenState';

export type GameConfigScreen<
  TState extends BaseGameState<string>,
  TCommand extends object,
> = ComponentType<{ readonly session: RoomLink<TState, TCommand> }>;

/**
 * Handed to a game module's `config` callback so the game declares its definition once and
 * `TConfig` is inferred from `schema`; the module factory supplies gameType and displayName.
 */
export type GameConfigDefiner<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
> = <TConfig extends object>(
  definition: GameConfigScreenDefinition<TGameType, TState, TCommand, TConfig>,
) => GameConfigScreen<TState, TCommand>;

function createGameConfigScreen<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TConfig extends object,
>(
  gameType: TGameType,
  displayName: string,
  definition: GameConfigScreenDefinition<TGameType, TState, TCommand, TConfig>,
): GameConfigScreen<TState, TCommand> {
  const Extra = definition.Extra;
  const summary = definition.summary ?? describeDefaultSummary;

  function GameConfigPage({ session }: { readonly session: RoomLink<TState, TCommand> }) {
    const params = definition.parseRouteParams(useParams());
    const state = useGameConfigScreenState({ gameType, definition, session, params });
    const summaryText = summary(state.config);
    return (
      <div className="game-config-page" data-testid={TESTIDS.configScreenRoot}>
        <ScreenHeader
          title={`${displayName}设置`}
          parentPath={params.mode === 'create' ? '/games' : roomPath(params.roomCode)}
          backTestId={TESTIDS.configBackButton}
        >
          <IconButton
            label="重置配置"
            icon={<IconTrashOutline aria-hidden />}
            onClick={state.reset}
            data-testid={TESTIDS.gameConfigReset(gameType)}
          />
        </ScreenHeader>
        <main className="game-config-body" data-testid={TESTIDS.gameConfigScreenRoot(gameType)}>
          <GameConfigForm
            gameType={gameType}
            schema={definition.schema}
            config={state.config}
            countDrafts={state.countDrafts}
            issue={state.issue}
            fieldRenderers={definition.fieldRenderers}
            onFieldChange={state.setFieldValue}
            onCountDraftChange={state.setCountDraft}
            onStepCount={state.stepCount}
          />
          {Extra !== undefined && (
            <div className="game-settings-section">
              <Extra config={state.config} />
            </div>
          )}
        </main>
        <footer className="game-config-footer">
          {summaryText !== null && <p className="game-settings-summary">{summaryText}</p>}
          <Button
            size="lg"
            className="game-config-submit"
            disabled={!state.canSubmit}
            loading={state.isSubmitting}
            onClick={state.submit}
            data-testid={TESTIDS.gameConfigSubmit(gameType)}
          >
            {state.isEditMode ? '保存设置' : '创建房间'}
          </Button>
        </footer>
      </div>
    );
  }
  GameConfigPage.displayName = `${displayName}ConfigPage`;
  return GameConfigPage;
}

export function createGameConfigDefiner<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
>(gameType: TGameType, displayName: string): GameConfigDefiner<TGameType, TState, TCommand> {
  return (definition) => createGameConfigScreen(gameType, displayName, definition);
}
