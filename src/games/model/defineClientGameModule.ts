/**
 * Shared assembly factory for session-based client game modules.
 *
 * Moves the assembly skeleton that every session-based game module used to
 * hand-write into one implementation: create the room session, bind the
 * room account capability from the game's two seat predicates, bind the
 * config/guide navigation screens to the session, and fill the shared
 * defaults (empty account stats section, no product UI, no app overlay).
 * A game declares only its own data — codec, home, navigation, screens,
 * predicates — plus, for games with a room audio runtime, an `audio` block
 * whose room screen also receives the audio instance. Games with a custom
 * client runtime instead of a bare session (Werewolf) do not use this
 * factory.
 *
 * The public signature is generic over the game's command type so each
 * game's screens keep their precise session type. The implementation works
 * on the command-erased session (`object`): a room session dispatches any
 * command object at runtime, and the erased view is what lets the shared
 * room account capability — whose commands are a subset of every game's
 * public command union by engine construction — bind without per-game
 * wrapper code.
 */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type React from 'react';
import { createElement } from 'react';

import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';
import {
  bindGameNavigation,
  type GameNavigationDefinition,
  type SupportedGameNavigationRoute,
  type UnsupportedGameNavigationRoute,
} from '@/features/navigation/model/GameNavigationContribution';
import type { GameAudioPreviewContribution } from '@/features/product/model/GameAudioPreview';
import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { createSessionRoomAccountCapability } from '@/features/room/session/SessionRoomAccountCapability';
import type { RoomSessionClient } from '@/features/room/session/types';
import type { ClientGameModule } from '@/games/model/ClientGameCatalog';
import type { ClientGameModuleDependencies } from '@/games/model/ClientGamePlugin';
import type { AudioService } from '@/services/infra/AudioService';

const EmptyAccountStatsSection: React.FC<{ readonly userId: string }> = () => null;

const EMPTY_PRODUCT_UI: GameProductUiContribution = {
  getAvatarDisplayName: () => null,
  getRevealEffectPresentation: () => null,
};

interface ClientGameModuleDefinitionBase<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
> {
  readonly gameType: TGameType;
  readonly stateCodec: GameStateCodec<TState>;
  readonly home: GameHomeContribution;
  readonly navigation: GameNavigationDefinition<
    TGameType,
    SupportedGameNavigationRoute,
    SupportedGameNavigationRoute,
    UnsupportedGameNavigationRoute
  >;
  readonly ConfigScreen: React.ComponentType<{
    readonly session: RoomSessionClient<TState, TCommand>;
  }>;
  readonly GuideScreen: React.ComponentType;
  readonly isUserSeated: (state: TState, userId: string) => boolean;
  readonly canSwitchAccount: (state: TState) => boolean;
}

export type ClientGameModuleDefinition<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TAudio = undefined,
> =
  | (ClientGameModuleDefinitionBase<TGameType, TState, TCommand> & {
      readonly RoomScreen: React.ComponentType<
        GameRoomScreenProps<TGameType> & {
          readonly session: RoomSessionClient<TState, TCommand>;
        }
      >;
      readonly audio?: undefined;
    })
  | (ClientGameModuleDefinitionBase<TGameType, TState, TCommand> & {
      readonly RoomScreen: React.ComponentType<
        GameRoomScreenProps<TGameType> & {
          readonly session: RoomSessionClient<TState, TCommand>;
          readonly audio: TAudio;
        }
      >;
      readonly audio: {
        readonly create: (audioService: AudioService) => TAudio;
        readonly preview: (audio: TAudio) => GameAudioPreviewContribution;
      };
    });

/** Assemble one session-based client game module from its game-owned parts. */
export function defineClientGameModule<
  const TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TAudio = undefined,
>(
  definition: ClientGameModuleDefinition<TGameType, TState, TCommand, TAudio>,
): (dependencies: ClientGameModuleDependencies) => ClientGameModule<TGameType> {
  return buildClientGameModule(definition);
}

function buildClientGameModule<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TAudio,
>(
  definition: ClientGameModuleDefinition<TGameType, TState, object, TAudio>,
): (dependencies: ClientGameModuleDependencies) => ClientGameModule<TGameType> {
  return ({ sessionFactory, audioService }) => {
    const session = sessionFactory.create<TState, object>({
      stateCodec: definition.stateCodec,
    });
    const roomAccount = createSessionRoomAccountCapability<TGameType, TState>({
      gameType: definition.gameType,
      session,
      isUserSeated: definition.isUserSeated,
      canSwitchAccount: definition.canSwitchAccount,
    });

    function BoundConfigScreen() {
      return createElement(definition.ConfigScreen, { session });
    }

    const shared = {
      gameType: definition.gameType,
      home: definition.home,
      navigation: bindGameNavigation(definition.navigation, {
        config: BoundConfigScreen,
        guide: definition.GuideScreen,
      }),
      roomAccount,
      productUi: EMPTY_PRODUCT_UI,
      accountStatsSection: EmptyAccountStatsSection,
      appOverlay: null,
    };

    if (definition.audio !== undefined) {
      const audio = definition.audio.create(audioService);
      const AudioRoomScreen = definition.RoomScreen;
      function BoundRoomScreen(props: GameRoomScreenProps<TGameType>) {
        return createElement(AudioRoomScreen, { ...props, session, audio });
      }
      return {
        ...shared,
        roomScreen: BoundRoomScreen,
        audioPreview: definition.audio.preview(audio),
      };
    }

    const SessionRoomScreen = definition.RoomScreen;
    function BoundRoomScreen(props: GameRoomScreenProps<TGameType>) {
      return createElement(SessionRoomScreen, { ...props, session });
    }
    return {
      ...shared,
      roomScreen: BoundRoomScreen,
      audioPreview: null,
    };
  };
}
