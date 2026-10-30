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
 * whose room screen also receives the audio instance, and optional
 * `extras` for the contributions most games leave at their defaults
 * (product UI, account stats section, app overlay, notepad screen); the
 * session-bound extras receive the room session like the room screen.
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
  type GameNavigationRouteDefinition,
  type SupportedGameNavigationRoute,
} from '@/features/navigation/model/GameNavigationContribution';
import type { GameAudioPreviewContribution } from '@/features/product/model/GameAudioPreview';
import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';
import {
  createGameConfigDefiner,
  type GameConfigDefiner,
} from '@/features/room/config/createGameConfigScreen';
import { createLinkRoomAccountCapability } from '@/features/room/link/LinkRoomAccountCapability';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { ClientGameModule } from '@/games/model/ClientGameCatalog';
import type { ClientGameModuleDependencies } from '@/games/model/ClientGamePlugin';
import type { RoomLink } from '@/platform/realtime/types';
import type { AudioService } from '@/services/infra/AudioService';

const EmptyAccountStatsSection: React.FC<{ readonly userId: string }> = () => null;

const EMPTY_PRODUCT_UI: GameProductUiContribution = {
  getAvatarDisplayName: () => null,
  getRevealEffectPresentation: () => null,
};

interface ClientGameModuleDefinitionBase<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
> {
  readonly gameType: TGameType;
  readonly stateCodec: GameStateCodec<TState>;
  readonly home: GameHomeContribution;
  /**
   * Config and guide are always screens; the notepad route is a screen
   * only when `extras.navigationScreens.notepad` binds one (bindRoute
   * fails fast on a declared screen with no binding, or the reverse).
   */
  readonly navigation: GameNavigationDefinition<
    TGameType,
    SupportedGameNavigationRoute,
    SupportedGameNavigationRoute,
    GameNavigationRouteDefinition
  >;
  readonly GuideScreen: React.ComponentType;
  readonly isUserSeated: (state: TState, userId: string) => boolean;
  readonly canSwitchAccount: (state: TState) => boolean;
}

/** Lobby configuration: the game declares its schema-driven screen through the definer. */
interface ClientGameModuleConfigDefinition<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
> {
  readonly config: (
    define: GameConfigDefiner<TGameType, TState, TCommand>,
  ) => React.ComponentType<{ readonly session: RoomLink<TState, TCommand> }>;
}

/** Session-bound screen: receives the room session like the room screen. */
type SessionScreen<
  TState extends BaseGameState<string>,
  TCommand extends object,
> = React.ComponentType<{ readonly session: RoomLink<TState, TCommand> }>;

/** Contributions most games leave at the shared defaults. */
export interface ClientGameModuleExtras<
  TState extends BaseGameState<string>,
  TCommand extends object,
> {
  readonly productUi?: GameProductUiContribution;
  readonly accountStatsSection?: React.ComponentType<{ readonly userId: string }>;
  /** App-wide overlay mounted outside the room (e.g. XP toasts); session-bound. */
  readonly appOverlay?: SessionScreen<TState, TCommand>;
  readonly navigationScreens?: {
    /** Notepad route screen; the navigation definition must declare the route as a screen. */
    readonly notepad?: SessionScreen<TState, TCommand>;
  };
}

interface ClientGameModuleExtrasDefinition<
  TState extends BaseGameState<string>,
  TCommand extends object,
> {
  readonly extras?: ClientGameModuleExtras<TState, TCommand>;
}

export type ClientGameModuleDefinition<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TAudio = undefined,
> = ClientGameModuleConfigDefinition<TGameType, TState, TCommand> &
  ClientGameModuleExtrasDefinition<TState, TCommand> &
  (
    | (ClientGameModuleDefinitionBase<TGameType, TState> & {
        readonly RoomScreen: React.ComponentType<
          GameRoomScreenProps<TGameType> & {
            readonly session: RoomLink<TState, TCommand>;
          }
        >;
        readonly audio?: undefined;
      })
    | (ClientGameModuleDefinitionBase<TGameType, TState> & {
        readonly RoomScreen: React.ComponentType<
          GameRoomScreenProps<TGameType> & {
            readonly session: RoomLink<TState, TCommand>;
            readonly audio: TAudio;
          }
        >;
        readonly audio: {
          readonly create: (audioService: AudioService) => TAudio;
          readonly preview: (audio: TAudio) => GameAudioPreviewContribution;
        };
      })
  );

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
    const session = sessionFactory.create<TState, object>(definition.stateCodec);
    const roomAccount = createLinkRoomAccountCapability<TGameType, TState>({
      gameType: definition.gameType,
      link: session,
      isUserSeated: definition.isUserSeated,
      canSwitchAccount: definition.canSwitchAccount,
    });

    const ConfigScreen = definition.config(
      createGameConfigDefiner(definition.gameType, definition.home.mode.displayName),
    );
    function BoundConfigScreen() {
      return createElement(ConfigScreen, { session });
    }
    const extras = definition.extras ?? {};
    const NotepadScreen = extras.navigationScreens?.notepad;
    function BoundNotepadScreen() {
      if (NotepadScreen === undefined) {
        throw new Error(`[FAIL-FAST] ${definition.gameType} notepad screen is not bound`);
      }
      return createElement(NotepadScreen, { session });
    }
    const AppOverlay = extras.appOverlay;
    function BoundAppOverlay() {
      if (AppOverlay === undefined) {
        throw new Error(`[FAIL-FAST] ${definition.gameType} app overlay is not bound`);
      }
      return createElement(AppOverlay, { session });
    }

    const shared = {
      gameType: definition.gameType,
      home: definition.home,
      navigation: bindGameNavigation(definition.navigation, {
        config: BoundConfigScreen,
        guide: definition.GuideScreen,
        ...(NotepadScreen === undefined ? {} : { notepad: BoundNotepadScreen }),
      }),
      roomAccount,
      productUi: extras.productUi ?? EMPTY_PRODUCT_UI,
      accountStatsSection: extras.accountStatsSection ?? EmptyAccountStatsSection,
      appOverlay: AppOverlay === undefined ? null : BoundAppOverlay,
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
