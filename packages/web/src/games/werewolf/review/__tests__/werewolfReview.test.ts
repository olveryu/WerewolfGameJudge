/**
 * werewolfReview tests — the host-only-or-granted-seat gate. The host and
 * explicitly authorized seats may read it during Day and after the game ends.
 * Every reader confirms first, and a Day confirmation warns that the report
 * can sway the sheriff election.
 */
import {
  type GameState,
  GameStatus,
  getWerewolfNightReview,
} from '@game-judge/game-engine/games/werewolf/public';

import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { RoomReviewDocument } from '@/features/room/review/types';
import { makeSettledNightState } from '@/test-utils/werewolfNightReview';

import { toWerewolfReviewDocument } from '../toWerewolfReviewDocument';
import { werewolfReview } from '../werewolfReview';

const ROOM_CODE = '1234';
const HOST: RoomViewer = { userId: 'host-1', isHost: true, seat: 0 };
const SPECTATOR: RoomViewer = { userId: 'spectator-1', isHost: false, seat: null };
const NOT_PERMITTED = { kind: 'notPermitted', reason: '房主尚未向你开放复盘' };
const DAY_CONFIRMATION = {
  title: '查看本局复盘？',
  message: '本局复盘包含全员身份和行动记录，查看后可能影响警长竞选，请确认是否继续。',
  confirmText: '确定查看',
};
const ENDED_CONFIRMATION = {
  title: '查看本局复盘？',
  message: '本局复盘包含全员身份和行动记录，请确认是否继续。',
  confirmText: '确定查看',
};

function seatedViewer(seat: number): RoomViewer {
  return { userId: `uid-${seat}`, isHost: false, seat };
}

function resolveFor(state: GameState, viewer: RoomViewer) {
  return werewolfReview.resolve({ state, viewer, roomCode: ROOM_CODE });
}

/** The document the contribution hands over: the builder over the engine's review. */
function documentFor(state: GameState): RoomReviewDocument {
  return toWerewolfReviewDocument({
    review: getWerewolfNightReview(state),
    roomCode: ROOM_CODE,
    gameSequence: state.gameSequence,
  });
}

describe('werewolfReview', () => {
  it.each([
    GameStatus.Unseated,
    GameStatus.Seated,
    GameStatus.Assigned,
    GameStatus.Ready,
    GameStatus.Ongoing,
  ])('is notEnded before Day (%s), for every viewer', (status) => {
    const state = makeSettledNightState({ status, nightReviewAllowedSeats: [1] });

    for (const viewer of [HOST, SPECTATOR, seatedViewer(1), seatedViewer(2)]) {
      expect(resolveFor(state, viewer)).toEqual({ kind: 'notEnded' });
    }
  });

  it('is available to the host, who may share it', () => {
    const state = makeSettledNightState();

    expect(resolveFor(state, HOST)).toEqual({
      kind: 'available',
      document: documentFor(state),
      sharing: { isAllowed: true },
      confirmation: DAY_CONFIRMATION,
    });
  });

  it('does not permit an unseated spectator to read the review', () => {
    const state = makeSettledNightState({ nightReviewAllowedSeats: [1] });

    expect(resolveFor(state, SPECTATOR)).toEqual(NOT_PERMITTED);
  });

  it('is available to a seat the host granted, which may share it', () => {
    const state = makeSettledNightState({ nightReviewAllowedSeats: [1, 2] });

    expect(resolveFor(state, seatedViewer(2))).toEqual({
      kind: 'available',
      document: documentFor(state),
      sharing: { isAllowed: true },
      confirmation: DAY_CONFIRMATION,
    });
  });

  it('is notPermitted for a seated player the host has not granted during Day', () => {
    expect(resolveFor(makeSettledNightState(), seatedViewer(1))).toEqual(NOT_PERMITTED);
    expect(
      resolveFor(makeSettledNightState({ nightReviewAllowedSeats: [] }), seatedViewer(1)),
    ).toEqual(NOT_PERMITTED);
    expect(
      resolveFor(makeSettledNightState({ nightReviewAllowedSeats: [2] }), seatedViewer(1)),
    ).toEqual(NOT_PERMITTED);
  });

  it('requires host authorization even after the game has ended', () => {
    const state = makeSettledNightState({
      status: GameStatus.Ended,
      nightReviewAllowedSeats: [],
    });

    expect(resolveFor(state, seatedViewer(1))).toEqual(NOT_PERMITTED);
    expect(resolveFor(state, SPECTATOR)).toEqual(NOT_PERMITTED);
  });

  it('allows an authorized seat to read and share after the game has ended', () => {
    const state = makeSettledNightState({
      status: GameStatus.Ended,
      nightReviewAllowedSeats: [1],
    });

    expect(resolveFor(state, seatedViewer(1))).toEqual({
      kind: 'available',
      document: documentFor(state),
      sharing: { isAllowed: true },
      confirmation: ENDED_CONFIRMATION,
    });
  });

  it('confirms first, warning about the sheriff election only during Day', () => {
    const endedState = makeSettledNightState({ status: GameStatus.Ended });
    const day = resolveFor(makeSettledNightState(), HOST);
    const ended = resolveFor(endedState, HOST);
    if (day.kind !== 'available' || ended.kind !== 'available') {
      throw new Error('expected the review to be available during Day and once ended');
    }

    expect(day.confirmation).toEqual(DAY_CONFIRMATION);
    expect(ended.confirmation).toEqual(ENDED_CONFIRMATION);
    expect(day.confirmation).not.toEqual(ended.confirmation);
    expect(day.confirmation?.message).toContain('警长竞选');
    expect(ended.confirmation?.message).not.toContain('警长竞选');
    expect(ended.document).toEqual(documentFor(endedState));
  });

  it('resolves purely: the same input yields an equal result and leaves the state as it was', () => {
    const state = makeSettledNightState({ nightReviewAllowedSeats: [1] });
    const before: unknown = JSON.parse(JSON.stringify(state));

    for (const viewer of [HOST, SPECTATOR, seatedViewer(1), seatedViewer(2)]) {
      expect(resolveFor(state, viewer)).toEqual(resolveFor(state, viewer));
    }
    expect(state).toEqual(before);
  });
});
