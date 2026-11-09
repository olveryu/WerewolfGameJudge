/**
 * Werewolf-owned BoardPicker → Config → Rules flow on the config page.
 *
 * The first step comes from the route mode; each later step is a history entry carrying only
 * `?step=<name>`, so Back and the browser go back one step. Step params live here in memory,
 * like a stack navigator's: ConfigScreen stays mounted (hidden) under a board picker or the
 * rules step it opened, which keeps its unsaved board. A page that lands mid-flow without those
 * params (a reload, a pasted link) restarts the flow at its first step.
 */
import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import { returnToActiveRoom, roomPath } from '@/features/room/navigation/roomFlowNavigation';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { BoardPickerScreen } from '@/games/werewolf/screens/BoardPickerScreen/BoardPickerScreen';
import { ConfigScreen } from '@/games/werewolf/screens/ConfigScreen/ConfigScreen';
import { GameRulesScreen } from '@/games/werewolf/screens/GameRulesScreen/GameRulesScreen';

import type { WerewolfConfigParams, WerewolfConfigStep, WerewolfRulesParams } from './types';
import { getWerewolfConfigFlowStart, parseWerewolfConfigStep } from './werewolfConfigFlow';

export function WerewolfConfigFlowScreen({ session }: { readonly session: WerewolfRoomSession }) {
  const start = getWerewolfConfigFlowStart(useParams());
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const stepParam = parseWerewolfConfigStep(searchParams.get('step'));
  const step = stepParam ?? start.initialRouteName;
  const [configParams, setConfigParams] = useState<WerewolfConfigParams | null>(
    start.initialRouteName === 'Config' ? (start.configParams ?? {}) : null,
  );
  const [rulesParams, setRulesParams] = useState<WerewolfRulesParams | null>(null);

  const boardPickerParams = start.boardPickerParams ?? {};
  const nominateMode = boardPickerParams.nominateMode;
  const existingRoomCode = boardPickerParams.existingRoomCode;
  const flowRoomCode = existingRoomCode ?? nominateMode?.roomCode;
  const exitPath = flowRoomCode === undefined ? '/games' : roomPath(flowRoomCode);
  /** A board picker pushed from ConfigScreen sits on top of it; the first-page picker does not. */
  const isConfigInStack = step !== 'BoardPicker' || stepParam !== null;

  if ((isConfigInStack && configParams === null) || (step === 'Rules' && rulesParams === null)) {
    return <Navigate to={location.pathname} replace />;
  }

  const pushStep = (next: WerewolfConfigStep, options?: { readonly replace: boolean }) => {
    setSearchParams({ step: next }, options);
  };

  /** Like a stack's popTo: back to the ConfigScreen below, or onto a new one. */
  const goToConfig = (params: WerewolfConfigParams) => {
    setConfigParams(params);
    if (stepParam === 'BoardPicker') {
      void navigate(-1);
      return;
    }
    // A nomination replaces its first-page picker, so Back from ConfigScreen leaves for the room.
    pushStep('Config', { replace: nominateMode !== undefined });
  };

  const handleReturnToRoom = (roomCode: string) => returnToActiveRoom(navigate, roomCode);

  return (
    <>
      {step === 'BoardPicker' && (
        <BoardPickerScreen
          exitPath={exitPath}
          onSelect={(presetName) =>
            goToConfig(
              nominateMode === undefined
                ? { presetName, existingRoomCode }
                : { presetName, nominateMode },
            )
          }
          onCustom={() =>
            goToConfig(
              nominateMode === undefined
                ? existingRoomCode === undefined
                  ? {}
                  : { existingRoomCode }
                : { nominateMode },
            )
          }
        />
      )}
      {isConfigInStack && configParams !== null && (
        <div hidden={step !== 'Config'}>
          <ConfigScreen
            session={session}
            params={configParams}
            exitPath={exitPath}
            onPickBoard={() => pushStep('BoardPicker')}
            onContinue={(params) => {
              setRulesParams(params);
              pushStep('Rules');
            }}
            onReturnToRoom={handleReturnToRoom}
          />
        </div>
      )}
      {step === 'Rules' && rulesParams !== null && configParams !== null && (
        <GameRulesScreen
          session={session}
          params={rulesParams}
          onRulesChange={(rules) => setConfigParams({ ...configParams, updatedRules: rules })}
        />
      )}
    </>
  );
}
