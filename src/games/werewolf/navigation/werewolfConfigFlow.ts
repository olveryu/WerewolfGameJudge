/** Pure route-to-flow mapping for Werewolf configuration. */

import { createStandardConfigRouteParser } from '@/features/navigation/model/standardRouteParsers';

import type { WerewolfConfigRouteParams, WerewolfConfigStackParamList } from './types';

export interface WerewolfConfigFlowStart {
  readonly initialRouteName: 'BoardPicker' | 'Config';
  readonly boardPickerParams: WerewolfConfigStackParamList['BoardPicker'];
  readonly configParams: WerewolfConfigStackParamList['Config'];
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
