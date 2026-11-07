/**
 * The werewolf review contribution. The report exists from dawn (Day)
 * through the end of the game, so reading it mid-game is gated: the host
 * and spectators read it, a seated player only once the host granted the
 * seat (the engine's `nightReviewAllowedSeats`); only the host and granted
 * seats may export the image. Every reader confirms before opening — the
 * report carries every identity and can sway the sheriff election.
 */

import {
  type GameState,
  GameStatus,
  getWerewolfNightReview,
} from '@game-judge/game-engine/games/werewolf/public';

import type { RoomReviewContribution } from '@/features/room/review/types';

import { toWerewolfReviewDocument } from './toWerewolfReviewDocument';

export const werewolfReview: RoomReviewContribution<GameState> = {
  resolve: ({ state, viewer, roomCode }) => {
    if (state.status !== GameStatus.Day && state.status !== GameStatus.Ended) {
      return { kind: 'notEnded' };
    }
    const isGrantedSeat =
      viewer.seat !== null && (state.nightReviewAllowedSeats ?? []).includes(viewer.seat);
    if (!viewer.isHost && viewer.seat !== null && !isGrantedSeat) {
      return { kind: 'notPermitted', reason: '房主尚未向你开放复盘' };
    }
    const isEnded = state.status === GameStatus.Ended;
    return {
      kind: 'available',
      document: toWerewolfReviewDocument({
        review: getWerewolfNightReview(state),
        roomCode,
        gameSequence: state.gameSequence,
      }),
      sharing:
        viewer.isHost || isGrantedSeat
          ? { isAllowed: true }
          : { isAllowed: false, reason: '仅房主和已获授权的玩家可以分享战报' },
      confirmation: {
        title: '查看本局复盘？',
        message: isEnded
          ? '本局复盘包含全员身份和行动记录，请确认是否继续。'
          : '本局复盘包含全员身份和行动记录，查看后可能影响警长竞选，请确认是否继续。',
        confirmText: '确定查看',
      },
    };
  },
};
