/**
 * 秘密希特勒本局复盘贡献：终局后对所有观看者开放（终局身份全公开），任何读者都
 * 可分享，打开前无需确认。中止、返回大厅及下一局均不提供上一局复盘。
 */

import type { SecrethitlerState } from '@game-judge/game-engine/games/secrethitler/public';

import type { RoomReviewContribution } from '@/features/room/review/types';

import { toSecrethitlerReviewDocument } from './toSecrethitlerReviewDocument';

/** The Secrethitler review: available to every viewer once the game ended. */
export const secrethitlerReview: RoomReviewContribution<SecrethitlerState> = {
  resolve: ({ state, roomCode }) =>
    state.phase.kind === 'ended'
      ? {
          kind: 'available',
          document: toSecrethitlerReviewDocument({ state, roomCode }),
          sharing: { isAllowed: true },
          confirmation: null,
        }
      : { kind: 'notEnded' },
};
