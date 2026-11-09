/**
 * Game-owned pages (`/game/:gameType/config/:mode/:roomCode?`, `/game/:gameType/guide/:roomCode?`):
 * resolves the game's client module and renders the page its navigation binds for the route
 * kind, after the game validated the route params.
 */
import { parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { Suspense } from 'react';
import { useParams } from 'react-router';

import { LoadingScreen } from '@/components/LoadingScreen';
import type { GameNavigationRouteKind } from '@/features/navigation/model/GameNavigationContribution';
import { useClientGameModule } from '@/games/clientModules';

function GameRouteScreen({ routeKind }: { readonly routeKind: GameNavigationRouteKind }) {
  const params = useParams();
  const gameType = parseGameType(params.gameType);
  const capability = useClientGameModule(gameType).navigation[routeKind];
  if (capability.kind === 'unsupported') {
    throw new Error(`[FAIL-FAST] ${gameType} does not support ${routeKind} navigation`);
  }
  capability.parseParams(params);
  return <capability.Screen />;
}

export function GameConfigRoutePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GameRouteScreen routeKind="config" />
    </Suspense>
  );
}

export function GameGuideRoutePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GameRouteScreen routeKind="guide" />
    </Suspense>
  );
}
