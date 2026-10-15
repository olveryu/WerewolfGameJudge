/**
 * 你画我猜在首页的入口卡片。
 */
import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';
import { colors } from '@/theme';
import { lighten } from '@/theme/colorUtils';

export const drawGuessHomeContribution = {
  mode: {
    displayName: '你画我猜',
    subtitle: '一人作画，其余人聊天框猜词',
    iconName: 'pencil-outline',
    tier: 'mini',
    gradient: [lighten(colors.success, 0.5), colors.success],
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
