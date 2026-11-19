/** Pure route-to-flow mapping for Werewolf configuration. */

import { createStandardConfigRouteParser } from '@/features/navigation/model/standardRouteParsers';

import type {
  WerewolfBoardPickerParams,
  WerewolfConfigParams,
  WerewolfConfigRouteParams,
  WerewolfConfigStep,
} from './types';

export interface WerewolfConfigFlowStart {
  readonly initialRouteName: 'BoardPicker' | 'Config';
  readonly boardPickerParams: WerewolfBoardPickerParams | undefined;
  readonly configParams: WerewolfConfigParams | undefined;
}

/** 狼人杀在标准 create/edit 之外多一个带 roomCode 的 nominate mode。 */
export const parseWerewolfConfigRouteParams: (params: unknown) => WerewolfConfigRouteParams =
  createStandardConfigRouteParser({
    gameType: 'werewolf',
    displayName: 'Werewolf',
    extraRoomCodeModes: ['nominate'],
  });

export function getWerewolfConfigFlowStart(params: unknown): WerewolfConfigFlowStart {
  const routeParams = parseWerewolfConfigRouteParams(params);
  switch (routeParams.mode) {
    case 'create':
      return {
        initialRouteName: 'BoardPicker',
        boardPickerParams: undefined,
        configParams: undefined,
      };
    case 'edit': {
      const roomCode = routeParams.roomCode;
      return {
        initialRouteName: 'Config',
        boardPickerParams: { existingRoomCode: roomCode },
        configParams: { existingRoomCode: roomCode },
      };
    }
    case 'nominate': {
      const roomCode = routeParams.roomCode;
      const nominateMode = { roomCode };
      return {
        initialRouteName: 'BoardPicker',
        boardPickerParams: { nominateMode },
        configParams: { nominateMode },
      };
    }
  }
}

/** The `step` search param of a pushed flow step; absent on the flow's first page. */
export function parseWerewolfConfigStep(value: string | null): WerewolfConfigStep | null {
  if (value === null || value === 'BoardPicker' || value === 'Config' || value === 'Rules') {
    return value;
  }
  throw new Error(`[FAIL-FAST] Unknown Werewolf config step: ${value}`);
}
