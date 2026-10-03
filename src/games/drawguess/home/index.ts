/**
 * 你画我猜在首页的入口卡片。
 */
import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';

export const drawGuessHomeContribution = {
  mode: {
    displayName: '你画我猜',
    subtitle: '一人作画，其余人聊天框猜词',
    iconName: 'pencil-outline',
    tier: 'mini',
    playerLabel: '4–12人',
    durationLabel: '约23分钟',
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
