/** Story Relay Home contribution; pure text relay is the only available game. */
import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';
import { colors } from '@/theme';
import { lighten } from '@/theme/colorUtils';

import storyrelayArt from '../../../../assets/game-art/storyrelay.jpg';

export const storyRelayHomeContribution = {
  mode: {
    displayName: '故事接龙',
    subtitle: '一人写一段，一起揭晓故事',
    iconName: 'book-outline',
    tier: 'mini',
    gradient: [lighten(colors.third, 0.3), colors.third],
    art: storyrelayArt,
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
