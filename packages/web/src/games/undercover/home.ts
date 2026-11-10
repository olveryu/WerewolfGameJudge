/** Undercover contribution to the Home surface. */
import undercoverArt from '@/assets/game-art/undercover.webp';
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import IconFingerPrintOutline from '~icons/ion/finger-print-outline';

export const undercoverHome = {
  mode: {
    displayName: '谁是卧底',
    subtitle: '线下指人投票，房主揭晓',
    Icon: IconFingerPrintOutline,
    tier: 'mini',
    gradient: [colors.textSecondary, colors.text],
    artUrl: undercoverArt,
  },
} satisfies GameHomeContribution;
