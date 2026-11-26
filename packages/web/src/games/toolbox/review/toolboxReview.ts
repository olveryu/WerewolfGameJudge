/** 聚会工具没有终局与复盘：每次使用结束直接回到准备。 */

import type { ToolboxView } from '@game-judge/game-engine/games/toolbox/public';

import type { RoomReviewContribution } from '@/features/room/review/types';

export const toolboxReview: RoomReviewContribution<ToolboxView> = {
  resolve: () => ({ kind: 'notEnded' }),
};
