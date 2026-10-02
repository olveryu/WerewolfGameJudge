/** Story Relay Home contribution; pure text relay is the only available game. */
import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';

export const storyRelayHomeContribution = {
  mode: {
    displayName: '故事接龙',
    subtitle: '一人写一段，一起揭晓故事',
    iconName: 'book-outline',
    tier: 'mini',
    playerLabel: '4–20人',
    durationLabel: '约15分钟',
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
