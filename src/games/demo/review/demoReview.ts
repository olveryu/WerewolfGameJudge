/**
 * Demo本局复盘贡献：终局后对所有观看者开放（终局身份全公开），任何读者都
 * 可分享，打开前无需确认。TODO(gameplay): 有中止局（isAborted）或局中
 * 复盘时在这里按阶段补可用条件；有真实分享权限规则时改 sharing。
 */

import type { DemoState } from '@game-judge/game-engine/games/demo/public';

import type { RoomReviewContribution } from '@/features/room/review/types';

import { toDemoReviewDocument } from './toDemoReviewDocument';

/** The Demo review: available to every viewer once the game ended. */
export const demoReview: RoomReviewContribution<DemoState> = {
  resolve: ({ state, roomCode }) =>
    state.phase.kind === 'ended'
      ? {
          kind: 'available',
          document: toDemoReviewDocument({ state, roomCode }),
          sharing: { isAllowed: true },
          confirmation: null,
        }
      : { kind: 'notEnded' },
};
