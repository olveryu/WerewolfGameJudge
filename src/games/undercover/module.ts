/** Undercover client plugin over shared navigation, room session, account and shell contracts. */
import {
  getUndercoverRoleCounts,
  getUndercoverUserSeat,
  isValidUndercoverConfig,
  UNDERCOVER_CONFIG_SCHEMA,
  UNDERCOVER_STATE_CODEC,
  type UndercoverPublicCommand,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';
import { colors } from '@/theme';

import undercoverArt from '../../../assets/game-art/undercover.jpg';
import {
  parseUndercoverConfigRouteParams,
  undercoverGameNavigation,
} from './navigation/undercoverGameNavigation';
import { getUndercoverRoomCommandFailureMessage } from './room/undercoverRoomCommandFailureMessage';
import { UndercoverRoomScreen } from './room/UndercoverRoomScreen';
import {
  UndercoverCategoryField,
  useUndercoverConfigSubmitGate,
} from './screens/UndercoverCategoryField';
import { UndercoverRulesScreen } from './screens/UndercoverRulesScreen';

export const createUndercoverUiModule = defineClientGameModule<
  'undercover',
  UndercoverState,
  UndercoverPublicCommand
>({
  gameType: 'undercover',
  home: {
    mode: {
      displayName: '谁是卧底',
      subtitle: '线下指人投票，房主揭晓',
      iconName: 'finger-print-outline',
      tier: 'mini',
      gradient: [colors.textSecondary, colors.text],
      art: undercoverArt,
    },
    spotlight: null,
    announcementTabs: [],
  },
  stateCodec: UNDERCOVER_STATE_CODEC,
  navigation: undercoverGameNavigation,
  RoomScreen: UndercoverRoomScreen,
  config: (define) =>
    define({
      schema: UNDERCOVER_CONFIG_SCHEMA,
      parseRouteParams: parseUndercoverConfigRouteParams,
      readConfig: (state) => (state.phase === 'lobby' ? state.config : null),
      buildUpdateCommand: (config) => ({ type: 'undercover.config.update', config }),
      getFailureMessage: getUndercoverRoomCommandFailureMessage,
      creationLabel: '创建谁是卧底房间',
      summary: (config) => {
        if (!isValidUndercoverConfig(config)) return `共 ${config.numberOfPlayers} 人`;
        const counts = getUndercoverRoleCounts(config.numberOfPlayers, config.hasBlank);
        return `平民 ${counts.civilian} 人 · 卧底 ${counts.undercover} 人 · 白板 ${counts.blank} 人`;
      },
      fieldRenderers: { category: UndercoverCategoryField },
      useSubmitGate: useUndercoverConfigSubmitGate,
    }),
  GuideScreen: UndercoverRulesScreen,
  isUserSeated: (state, userId) => getUndercoverUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase === 'lobby',
});
