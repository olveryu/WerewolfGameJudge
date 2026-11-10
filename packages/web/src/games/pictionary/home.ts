/** Pictionary contribution to the Home surface. */
import pictionaryArt from '@/assets/game-art/pictionary.webp';
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import { lighten } from '@/theme/colorUtils';
import IconBrushOutline from '~icons/ion/brush-outline';

export const pictionaryHome = {
  mode: {
    displayName: '你画我猜接龙',
    subtitle: '画与猜轮流传递，结局一起揭晓',
    Icon: IconBrushOutline,
    tier: 'mini',
    gradient: [lighten(colors.god, 0.5), colors.god],
    artUrl: pictionaryArt,
  },
} satisfies GameHomeContribution;
