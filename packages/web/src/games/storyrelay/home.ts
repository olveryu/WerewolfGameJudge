/** Story relay contribution to the Home surface. */
import storyrelayArt from '@/assets/game-art/storyrelay.webp';
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import { lighten } from '@/theme/colorUtils';
import IconBookOutline from '~icons/ion/book-outline';

export const storyRelayHome = {
  mode: {
    displayName: '故事接龙',
    subtitle: '一人写一段，一起揭晓故事',
    Icon: IconBookOutline,
    tier: 'mini',
    gradient: [lighten(colors.third, 0.3), colors.third],
    artUrl: storyrelayArt,
  },
} satisfies GameHomeContribution;
