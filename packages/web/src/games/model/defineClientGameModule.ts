/**
 * Shared assembly for session-based client game modules. A game declares its data — codec,
 * navigation definition, screens, predicates and its review — and this factory creates the room
 * session, binds the room-account capability, and binds the config and guide pages and the room
 * screen to that one session.
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

export interface ClientGameModuleDefinition<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
> {
  readonly gameType: TGameType;
  /** Name in page titles (「${displayName}设置」). */
  readonly displayName: string;
  readonly stateCodec: GameStateCodec<TState>;
  /** Config and guide are pages; this game has no notepad page. */
  readonly navigation: GameNavigationDefinition<
    TGameType,
    SupportedGameNavigationRoute,
    SupportedGameNavigationRoute,
    GameNavigationRouteDefinition
  >;
  readonly RoomScreen: ComponentType<
    GameRoomScreenProps<TGameType> & {
      readonly session: RoomLink<TState, TCommand>;
      readonly review: RoomReviewContribution<TState>;
    }
  >;
  /** Lobby configuration: the game declares its schema-driven page through the definer. */
  readonly config: (
    define: GameConfigDefiner<TGameType, TState, TCommand>,
  ) => GameConfigScreen<TState, TCommand>;
  /** The guide page; receives the session for games whose guide reads the room. */
  readonly GuideScreen: ComponentType<{ readonly session: RoomLink<TState, TCommand> }>;
  /** The game's review: the room renders exactly this one. */
  readonly review: RoomReviewContribution<TState>;
  readonly isUserSeated: (state: TState, userId: string) => boolean;
  readonly canSwitchAccount: (state: TState) => boolean;
}

/** Assembles one session-based client game module from its game-owned parts. */
export function defineClientGameModule<
  const TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TCommand extends object,
>(
  definition: ClientGameModuleDefinition<TGameType, TState, TCommand>,
): (dependencies: ClientGameModuleDependencies) => ClientGameModule<TGameType> {
  return ({ roomLinks }) => {
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
    const { RoomScreen, review } = definition;
    function BoundRoomScreen(props: GameRoomScreenProps<TGameType>) {
      return createElement(RoomScreen, { ...props, session, review });
    }
    return {
      ...registerRoomUiModule({ gameType: definition.gameType, roomScreen: BoundRoomScreen }),
      navigation: bindGameNavigation(definition.navigation, {
        config: BoundConfigScreen,
        guide: BoundGuideScreen,
      }),
      roomAccount,
    };
  };
}
