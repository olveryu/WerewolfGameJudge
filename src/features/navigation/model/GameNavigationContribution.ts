/** Game-owned root-route definitions and their bound client screens. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type React from 'react';

export type GameNavigationRouteKind = 'config' | 'guide' | 'notepad';

export interface SupportedGameNavigationRoute<TParams extends object = object> {
  readonly kind: 'screen';
  readonly parseParams: (params: unknown) => TParams;
}

export interface UnsupportedGameNavigationRoute {
  readonly kind: 'unsupported';
}

export type GameNavigationRouteDefinition =
  | SupportedGameNavigationRoute
  | UnsupportedGameNavigationRoute;

export interface GameNavigationDefinition<
  TGameType extends GameType = GameType,
  TConfig extends GameNavigationRouteDefinition = GameNavigationRouteDefinition,
  TGuide extends GameNavigationRouteDefinition = GameNavigationRouteDefinition,
  TNotepad extends GameNavigationRouteDefinition = GameNavigationRouteDefinition,
> {
  readonly gameType: TGameType;
  readonly config: TConfig;
  readonly guide: TGuide;
  readonly notepad: TNotepad;
}

export interface GameNavigationScreenCapability extends SupportedGameNavigationRoute {
  readonly Screen: React.ComponentType;
}

export type GameNavigationCapability =
  | GameNavigationScreenCapability
  | UnsupportedGameNavigationRoute;

export interface GameNavigationContribution<TGameType extends GameType = GameType> {
  readonly gameType: TGameType;
  readonly config: GameNavigationCapability;
  readonly guide: GameNavigationCapability;
  readonly notepad: GameNavigationCapability;
}

type SupportedRouteKeys<TDefinition extends GameNavigationDefinition> = {
  [TRouteKind in GameNavigationRouteKind]: TDefinition[TRouteKind] extends {
    readonly kind: 'screen';
  }
    ? TRouteKind
    : never;
}[GameNavigationRouteKind];

export type GameNavigationScreenBindings<TDefinition extends GameNavigationDefinition> = {
  readonly [TRouteKind in SupportedRouteKeys<TDefinition>]: React.ComponentType;
};

export function defineGameNavigation<
  const TGameType extends GameType,
  const TConfig extends GameNavigationRouteDefinition,
  const TGuide extends GameNavigationRouteDefinition,
  const TNotepad extends GameNavigationRouteDefinition,
>(
  definition: GameNavigationDefinition<TGameType, TConfig, TGuide, TNotepad>,
): GameNavigationDefinition<TGameType, TConfig, TGuide, TNotepad> {
  return definition;
}

function bindRoute(
  gameType: GameType,
  routeKind: GameNavigationRouteKind,
  definition: GameNavigationRouteDefinition,
  screenComponent: React.ComponentType | undefined,
): GameNavigationCapability {
  if (definition.kind === 'unsupported') {
    if (screenComponent !== undefined) {
      throw new Error(
        `[FAIL-FAST] ${gameType} binds a screen for unsupported ${routeKind} navigation`,
      );
    }
    return definition;
  }
  if (screenComponent === undefined) {
    throw new Error(`[FAIL-FAST] ${gameType} does not bind its ${routeKind} navigation screen`);
  }
  return { ...definition, Screen: screenComponent };
}

export function bindGameNavigation<TDefinition extends GameNavigationDefinition>(
  definition: TDefinition,
  screens: GameNavigationScreenBindings<TDefinition>,
): GameNavigationContribution<TDefinition['gameType']> {
  const screenBindings: Readonly<Partial<Record<GameNavigationRouteKind, React.ComponentType>>> =
    screens;

  return {
    gameType: definition.gameType,
    config: bindRoute(definition.gameType, 'config', definition.config, screenBindings.config),
    guide: bindRoute(definition.gameType, 'guide', definition.guide, screenBindings.guide),
    notepad: bindRoute(definition.gameType, 'notepad', definition.notepad, screenBindings.notepad),
  };
}
