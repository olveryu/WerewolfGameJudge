/**
 * Shared assembly for session-based client game modules. A game declares its data — codec,
 * navigation definition, screens, predicates and its review — and this factory creates the room
 * session, binds the room-account capability, and binds the config, guide and notepad pages, the
 * app overlay and the room screen to that one session.
 */
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { type ComponentType, createElement } from 'react';

import {
  bindGameNavigation,
  type GameNavigationDefinition,
  type GameNavigationRouteDefinition,
  type SupportedGameNavigationRoute,
} from '@/features/navigation/model/GameNavigationContribution';
import {
  createGameConfigDefiner,
  type GameConfigDefiner,
  type GameConfigScreen,
} from '@/features/room/config/createGameConfigScreen';
import { createLinkRoomAccountCapability } from '@/features/room/link/LinkRoomAccountCapability';
import { type GameRoomScreenProps, registerRoomUiModule } from '@/features/room/model/RoomUiModule';
import type { RoomReviewContribution } from '@/features/room/review/types';
import type {
  ClientGameModule,
  ClientGameModuleDependencies,
} from '@/games/model/ClientGameModule';
import type { RoomLink } from '@/platform/realtime/types';
import type { AudioService } from '@/services/infra/AudioService';

type BoundRoomScreenProps<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
> = GameRoomScreenProps<TGameType> & {
  readonly session: RoomLink<TState, TCommand>;
  readonly review: RoomReviewContribution<TState>;
};

interface ClientGameModuleDefinitionBase<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
> {
  readonly gameType: TGameType;
  /** Name in page titles (「${displayName}设置」). */
  readonly displayName: string;
  readonly stateCodec: GameStateCodec<TState>;
  /** Config and guide are pages; the notepad is a page exactly when `NotepadScreen` binds one. */
  readonly navigation: GameNavigationDefinition<
    TGameType,
    SupportedGameNavigationRoute,
    SupportedGameNavigationRoute,
    GameNavigationRouteDefinition
  >;
  /**
   * Lobby configuration page, bound to the room session. Schema-driven games build it through
   * the definer; a game with its own flow (werewolf: board picker → roles → rules) ignores the
   * definer and returns its own page.
   */
  readonly config: (
    define: GameConfigDefiner<TGameType, TState, TCommand>,
  ) => GameConfigScreen<TState, TCommand>;
  /** The guide page; receives the session for games whose guide reads the room. */
  readonly GuideScreen: ComponentType<{ readonly session: RoomLink<TState, TCommand> }>;
  /** The notepad page; `bindGameNavigation` fails fast unless the navigation declares it. */
  readonly NotepadScreen?: ComponentType<{ readonly session: RoomLink<TState, TCommand> }>;
  /** App-wide overlay over every page (werewolf: the AI chat bubble), bound to the session. */
  readonly AppOverlay?: ComponentType<{ readonly session: RoomLink<TState, TCommand> }>;
  /** The game's review: the room renders exactly this one. */
  readonly review: RoomReviewContribution<TState>;
  readonly isUserSeated: (state: TState, userId: string) => boolean;
  readonly canSwitchAccount: (state: TState) => boolean;
}

/**
 * A game with narration declares `audio`: its player is created once per module from the page's
 * audio service, and its room screen also receives that player.
 */
export type ClientGameModuleDefinition<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TAudio = undefined,
> = ClientGameModuleDefinitionBase<TGameType, TState, TCommand> &
  (
    | {
        readonly RoomScreen: ComponentType<BoundRoomScreenProps<TGameType, TState, TCommand>>;
        readonly audio?: undefined;
      }
    | {
        readonly RoomScreen: ComponentType<
          BoundRoomScreenProps<TGameType, TState, TCommand> & { readonly audio: TAudio }
        >;
        readonly audio: { readonly create: (audioService: AudioService) => TAudio };
      }
  );

/** Assembles one session-based client game module from its game-owned parts. */
export function defineClientGameModule<
  const TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
  TAudio = undefined,
>(
  definition: ClientGameModuleDefinition<TGameType, TState, TCommand, TAudio>,
): (dependencies: ClientGameModuleDependencies) => ClientGameModule<TGameType> {
  return ({ roomLinks, audioService }) => {
    // The command-erased session dispatches any command object: the room-account capability's
    // commands are a subset of every game's public command union by engine construction.
    const session = roomLinks.create<TState, object>(definition.stateCodec);
    const roomAccount = createLinkRoomAccountCapability<TGameType, TState>({
      gameType: definition.gameType,
      link: session,
      isUserSeated: definition.isUserSeated,
      canSwitchAccount: definition.canSwitchAccount,
    });
    const ConfigScreen = definition.config(
      createGameConfigDefiner(definition.gameType, definition.displayName),
    );
    function BoundConfigScreen() {
      return createElement(ConfigScreen, { session });
    }
    const GuideScreen = definition.GuideScreen;
    function BoundGuideScreen() {
      return createElement(GuideScreen, { session });
    }
    const { NotepadScreen } = definition;
    function BoundNotepadScreen() {
      if (NotepadScreen === undefined) {
        throw new Error(`[FAIL-FAST] ${definition.gameType} notepad screen is not bound`);
      }
      return createElement(NotepadScreen, { session });
    }
    const { AppOverlay } = definition;
    const appOverlay =
      AppOverlay === undefined
        ? null
        : function BoundAppOverlay() {
            return createElement(AppOverlay, { session });
          };
    const { review } = definition;
    let roomScreen: ComponentType<GameRoomScreenProps<TGameType>>;
    if (definition.audio === undefined) {
      const { RoomScreen } = definition;
      roomScreen = function BoundRoomScreen(props: GameRoomScreenProps<TGameType>) {
        return createElement(RoomScreen, { ...props, session, review });
      };
    } else {
      const { RoomScreen } = definition;
      const audio = definition.audio.create(audioService);
      roomScreen = function BoundRoomScreen(props: GameRoomScreenProps<TGameType>) {
        return createElement(RoomScreen, { ...props, session, review, audio });
      };
    }
    return {
      ...registerRoomUiModule({ gameType: definition.gameType, roomScreen }),
      navigation: bindGameNavigation(definition.navigation, {
        config: BoundConfigScreen,
        guide: BoundGuideScreen,
        ...(NotepadScreen === undefined ? {} : { notepad: BoundNotepadScreen }),
      }),
      roomAccount,
      appOverlay,
    };
  };
}
