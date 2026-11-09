/**
 * Game-owned pages (`/game/:gameType/config/:mode/:roomCode?`, `/game/:gameType/guide/:roomCode?`,
 * `/game/:gameType/notepad/:roomCode`):
 * resolves the game's client module and renders the page its navigation binds for the route
 * kind, after the game validated the route params.
 */
import { parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { Suspense } from 'react';
import { useParams } from 'react-router';

import { LoadingScreen } from '@/components/LoadingScreen';
import { RequireUser } from '@/features/auth/RequireUser';
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

/** Config pages create or edit a room as the signed-in user. */
export function GameConfigRoutePage() {
  return (
    <RequireUser loginSubtitle="选择登录方式以创建房间">
      {() => (
        <Suspense fallback={<LoadingScreen />}>
          <GameRouteScreen routeKind="config" />
        </Suspense>
      )}
    </RequireUser>
  );
}

export function GameGuideRoutePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GameRouteScreen routeKind="guide" />
    </Suspense>
  );
}

export function GameNotepadRoutePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GameRouteScreen routeKind="notepad" />
    </Suspense>
  );
}
