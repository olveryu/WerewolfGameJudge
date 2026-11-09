/** Draw & guess contribution to the Home surface. */
import drawguessArt from '@/assets/game-art/drawguess.webp';
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import { lighten } from '@/theme/colorUtils';
import IconPencilOutline from '~icons/ion/pencil-outline';

export const drawGuessHome = {
  mode: {
    displayName: '你画我猜',
    subtitle: '一人作画，其余人聊天框猜词',
    Icon: IconPencilOutline,
    tier: 'mini',
    gradient: [lighten(colors.success, 0.5), colors.success],
    artUrl: drawguessArt,
  },
} satisfies GameHomeContribution;
