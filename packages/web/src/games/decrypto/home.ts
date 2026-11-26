/** 解码战 contribution to the Home surface. */
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import { lighten } from '@/theme/colorUtils';
import IconGameControllerOutline from '~icons/ion/game-controller-outline';

export const decryptoHome = {
  mode: {
    displayName: '解码战',
    subtitle: '传递线索，破解对手密码',
    Icon: IconGameControllerOutline,
    tier: 'mini',
    gradient: [lighten(colors.primary, 0.45), colors.primary],
  },
} satisfies GameHomeContribution;
