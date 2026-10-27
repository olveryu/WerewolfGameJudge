/**
 * Builds the config screen component for one session-based game.
 *
 * Header: `${displayName}设置`, back, and a reset action that restores the
 * create defaults or the lobby's saved config. Body: GameConfigForm plus the
 * game's optional Extra block. Footer: summary line and the create/save button,
 * disabled while the form has an inline issue or the submit gate is closed.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GameScreen, GameScreenContent, GameScreenFooter } from '@/components/GameScreen';
import { gameSettingsStyles as styles } from '@/components/GameSettings.styles';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { RoomSessionClient } from '@/features/room/session/types';
import type { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { colors, componentSizes } from '@/theme';

import { GameConfigForm } from './GameConfigForm';
import { describeDefaultSummary } from './gameConfigFormModel';
import type { GameConfigScreenDefinition } from './GameConfigScreenDefinition';
import { type ConfigNavigation, useGameConfigScreenState } from './useGameConfigScreenState';

interface CreateGameConfigScreenInput<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TConfig extends object,
> {
  readonly gameType: TGameType;
  readonly displayName: string;
  readonly definition: GameConfigScreenDefinition<TGameType, TState, TCommand, TConfig>;
}

export function createGameConfigScreen<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TConfig extends object,
>({
  gameType,
  displayName,
  definition,
}: CreateGameConfigScreenInput<TGameType, TState, TCommand, TConfig>): React.ComponentType<{
  readonly session: RoomSessionClient<TState, TCommand>;
}> {
  const Extra = definition.Extra;
  const summary = definition.summary ?? describeDefaultSummary;

  function GameConfigScreen({
    session,
  }: {
    readonly session: RoomSessionClient<TState, TCommand>;
  }) {
    const navigation = useNavigation<ConfigNavigation>();
    const route = useRoute<RouteProp<RootStackParamList, 'GameConfig'>>();
    const params = definition.parseRouteParams(route.params);
    const insets = useSafeAreaInsets();
    const state = useGameConfigScreenState({ gameType, definition, session, params, navigation });
    const summaryText = summary(state.config);

    return (
      <GameScreen
        testID={TESTIDS.configScreenRoot}
        header={
          <ScreenHeader
            title={`${displayName}设置`}
            topInset={insets.top}
            onBack={state.goBack}
            backTestID={TESTIDS.configBackButton}
            headerRight={
              <Button
                variant="icon"
                onPress={state.reset}
                testID={TESTIDS.gameConfigReset(gameType)}
                accessibilityLabel="重置配置"
              >
                <Ionicons name="trash-outline" size={componentSizes.icon.md} color={colors.text} />
              </Button>
            }
          />
        }
      >
        <GameScreenContent
          contentContainerStyle={styles.content}
          testID={TESTIDS.gameConfigScreenRoot(gameType)}
        >
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
          {Extra === undefined ? null : (
            <View style={styles.section}>
              <Extra config={state.config} />
            </View>
          )}
        </GameScreenContent>
        <GameScreenFooter>
          {summaryText === null ? null : <Text style={styles.summary}>{summaryText}</Text>}
          <Button
            variant="primary"
            size="lg"
            onPress={state.submit}
            disabled={!state.canSubmit}
            loading={state.isSubmitting}
            testID={TESTIDS.gameConfigSubmit(gameType)}
          >
            {state.isEditMode ? '保存设置' : '创建房间'}
          </Button>
        </GameScreenFooter>
      </GameScreen>
    );
  }

  GameConfigScreen.displayName = `${displayName}ConfigScreen`;
  return GameConfigScreen;
}

/**
 * Handed to a game module's `config` callback so the game declares its
 * definition once and `TConfig` is inferred from `schema`; the module factory
 * supplies gameType and displayName.
 */
export type GameConfigDefiner<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
> = <TConfig extends object>(
  definition: GameConfigScreenDefinition<TGameType, TState, TCommand, TConfig>,
) => React.ComponentType<{ readonly session: RoomSessionClient<TState, TCommand> }>;

export function createGameConfigDefiner<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
>(gameType: TGameType, displayName: string): GameConfigDefiner<TGameType, TState, TCommand> {
  return (definition) => createGameConfigScreen({ gameType, displayName, definition });
}
