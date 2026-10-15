/** Undercover client plugin over shared navigation, room session, account and shell contracts. */
import {
  getUndercoverUserSeat,
  UNDERCOVER_STATE_CODEC,
  type UndercoverPublicCommand,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import { defineClientGameModule } from '@/games/model/defineClientGameModule';
import { colors } from '@/theme';

import undercoverArt from '../../../assets/game-art/undercover.jpg';
import { undercoverGameNavigation } from './navigation/undercoverGameNavigation';
import { UndercoverRoomScreen } from './room/UndercoverRoomScreen';
import { UndercoverConfigScreen } from './screens/UndercoverConfigScreen';
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
  ConfigScreen: UndercoverConfigScreen,
  GuideScreen: UndercoverRulesScreen,
  isUserSeated: (state, userId) => getUndercoverUserSeat(state, userId) !== null,
  canSwitchAccount: (state) => state.phase === 'lobby',
});
