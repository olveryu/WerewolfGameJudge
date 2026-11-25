/**
 * Werewolf view-model projection — the single place where viewer-relative
 * cropping of the authoritative GameState lives (AU-39).
 *
 * Pure function of (state, viewer): no IO, no mutation. The night is
 * projected as the current step's presentation plus per-seat statuses;
 * interaction state (drafts, pending confirmation, dialog visibility) is
 * the client's own and is not projected.
 *
 * @remarks Cropping rules:
 * - myRole: the viewer's own seat only.
 * - wolfPackSeats: the wolves the viewer may recognize in the current step.
 * - Seat visibleRole: the viewer's own seat, plus every bot seat when the
 *   viewer is the host (the judge reads bots' cards on their behalf).
 * - step: only what the current step shows this viewer.
 */

import { getBotDisplayName } from '../../../platform/room/getBotDisplayName';
import { buildSeatIdentityView } from '../../../platform/room/seatIdentity';
import type { StepPresentation } from '../../../platform/steps';
import {
  getWerewolfPersonalDaytimeViews,
  type WerewolfPersonalDaytimeView,
} from '../roles/personalDaytimeViews';
import { createTemplateFromRoles, type GameStatus, type GameTemplate, type RoleId } from './models';
import { getWerewolfUserSeat } from './playerHelpers';
import type { GameState } from './protocol/types';
import { projectWerewolfStep, type WerewolfStepSeatStatus } from './stepProjection';

export interface WerewolfViewer {
  /** The seat the viewer acts as: own seat, or a bot seat the host controls. */
  readonly seat: number | null;
  readonly isHost: boolean;
}

/** One occupied seat as a viewer may see it. */
export interface WerewolfSeatView {
  readonly seat: number;
  readonly displayName: string;
  readonly isBot: boolean;
  /** The seat's role when this viewer is entitled to it (own seat; bot seats for the host); else null. */
  readonly visibleRole: RoleId | null;
  /** The seat is a wolf the viewer may recognize in the current step. */
  readonly isWolfPackPeer: boolean;
  /** Public identity-viewing record for this seat. */
  readonly hasViewedRole: boolean;
}

export interface WerewolfViewModel {
  readonly status: GameStatus;
  readonly mySeat: number | null;
  readonly myRole: RoleId | null;
  /** The configured board as a template (name, player count, roles, rules). */
  readonly template: GameTemplate;
  readonly seats: readonly WerewolfSeatView[];
  /** Seats the viewer recognizes as wolves; null when the pack is not visible. */
  readonly wolfPackSeats: readonly number[] | null;
  /** Seats with a completed identity viewing (public, AU-19 basis). */
  readonly viewedSeats: readonly number[];
  readonly step: StepPresentation | null;
  readonly stepSeatStatuses: Readonly<Record<number, WerewolfStepSeatStatus>>;
  readonly canAcknowledgeStepBots: boolean;
  readonly stepProgressKind: 'vote' | 'confirmation' | null;
  /** Cards only this viewer may open on the day after the night. */
  readonly personalDaytimeViews: readonly WerewolfPersonalDaytimeView[];
  readonly day: {
    /** Elected sheriff seat from the final election result; null until elected. */
    readonly sheriffSeat: number | null;
    /** Seat of the user selected as MVP; null until a selection exists. */
    readonly mvpSeat: number | null;
  };
}

function listOccupiedSeats(state: GameState): number[] {
  const seats: number[] = [];
  for (const [seatStr, player] of Object.entries(state.players)) {
    if (player !== null) seats.push(Number.parseInt(seatStr, 10));
  }
  return seats.sort((a, b) => a - b);
}

function buildSeatViews(
  state: GameState,
  viewer: WerewolfViewer,
  wolfPackSeats: readonly number[] | null,
): WerewolfSeatView[] {
  return listOccupiedSeats(state).map((seat) => {
    const player = state.players[seat]!;
    if (state.roster[seat] == null) {
      throw new Error(`[FAIL-FAST] Werewolf seat ${seat} has game data without an occupant`);
    }
    const identity = buildSeatIdentityView(state.roster, seat, getBotDisplayName);
    return {
      seat,
      // Fallback matches the client seat board (`|| '玩家'`): an empty-string
      // profile name falls back too (bot names are never empty).
      displayName: identity.displayName || '玩家',
      isBot: identity.isBot,
      visibleRole:
        seat === viewer.seat || (viewer.isHost && identity.isBot) ? (player.role ?? null) : null,
      isWolfPackPeer: wolfPackSeats !== null && wolfPackSeats.includes(seat),
      hasViewedRole: state.roleViewedSeats.includes(seat),
    };
  });
}

export function getWerewolfViewModel(state: GameState, viewer: WerewolfViewer): WerewolfViewModel {
  const viewerSeat = viewer.seat;
  const step = projectWerewolfStep(state, viewerSeat, viewer.isHost);
  return {
    status: state.status,
    mySeat: viewerSeat,
    myRole: viewerSeat === null ? null : (state.players[viewerSeat]?.role ?? null),
    template: createTemplateFromRoles([...state.templateRoles]),
    seats: buildSeatViews(state, viewer, step.wolfPackSeats),
    wolfPackSeats: step.wolfPackSeats,
    viewedSeats: state.roleViewedSeats,
    step: step.step,
    stepSeatStatuses: step.seatStatuses,
    canAcknowledgeStepBots: step.canAcknowledgeBots,
    stepProgressKind: step.progressKind,
    personalDaytimeViews: getWerewolfPersonalDaytimeViews(state, viewerSeat),
    day: {
      sheriffSeat:
        state.sheriffElectionResult?.kind === 'elected'
          ? state.sheriffElectionResult.sheriffSeat
          : null,
      mvpSeat: state.mvpUserId ? getWerewolfUserSeat(state, state.mvpUserId) : null,
    },
  };
}
