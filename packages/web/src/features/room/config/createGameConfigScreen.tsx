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
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { confirmAction } from '@/features/room/confirm';
import { roomPath } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomLink } from '@/platform/realtime/types';
import { TESTIDS } from '@/testids';
import IconTrashOutline from '~icons/ion/trash-outline';

import { GameConfigForm } from './GameConfigForm';
import { describeDefaultSummary } from './gameConfigFormModel';
import type { GameConfigScreenDefinition } from './GameConfigScreenDefinition';
import { useGameConfigScreenState } from './useGameConfigScreenState';

export interface GameConfigDialog {
  readonly roomCode: string;
  readonly onClose: () => void;
}

export type GameConfigScreen<
  TState extends BaseGameState<string>,
  TCommand extends object,
> = ComponentType<{
  readonly session: RoomLink<TState, TCommand>;
  readonly dialog?: GameConfigDialog;
}>;

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

  function GameConfigPage({
    session,
    dialog,
  }: {
    readonly session: RoomLink<TState, TCommand>;
    readonly dialog?: GameConfigDialog;
  }) {
    const routeParams = useParams();
    const params =
      dialog === undefined
        ? definition.parseRouteParams(routeParams)
        : { gameType, mode: 'edit' as const, roomCode: dialog.roomCode };
    const state = useGameConfigScreenState({
      gameType,
      definition,
      session,
      params,
      ...(dialog === undefined ? {} : { onEditSaved: dialog.onClose }),
    });
    const summaryText = summary(state.config);
    const form = (
      <>
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
      </>
    );
    const submit = (
      <>
        {dialog !== undefined && !state.isEditAvailable && (
          <p role="status">房间状态或权限已变化，不能保存设置。</p>
        )}
        {summaryText !== null && <p className="game-settings-summary">{summaryText}</p>}
        <Button
          size="lg"
          fullWidth
          disabled={!state.canSubmit}
          loading={state.isSubmitting}
          onClick={state.submit}
          data-testid={TESTIDS.gameConfigSubmit(gameType)}
        >
          {state.isEditMode ? '保存设置' : '创建房间'}
        </Button>
      </>
    );
    if (dialog !== undefined) {
      const requestClose = () => {
        if (state.isSubmitting) return;
        if (state.isDirty)
          confirmAction({
            label: '放弃修改？',
            body: '还没有保存此次修改。',
            onConfirm: dialog.onClose,
          });
        else dialog.onClose();
      };
      return (
        <RoomDialog title="房间设置" onClose={requestClose} dismissOnEscape footer={submit}>
          <IconButton
            label="重置配置"
            icon={<IconTrashOutline aria-hidden />}
            onClick={state.reset}
            disabled={!state.isEditAvailable || state.isSubmitting}
            data-testid={TESTIDS.gameConfigReset(gameType)}
          />
          {form}
        </RoomDialog>
      );
    }
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
          {form}
        </main>
        <footer className="game-config-footer">{submit}</footer>
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
