/**
 * Werewolf view-model projection — the single place where viewer-relative
 * cropping of the authoritative GameState lives (AU-39).
 *
 * Pure function of (state, viewerSeat): no IO, no mutation, no computation
 * moved from handlers. confirmStatus is still computed by confirmContext and
 * stored on state; this module only decides whether the given viewer is the
 * seat that status belongs to. Interaction state (seat selection highlight,
 * schema disabled reasons, action drafts) is deliberately NOT projected
 * here — it stays in the client interaction layer.
 *
 * @remarks Cropping rules, each mirroring the client seam it replaces:
 * - myRole / myEffectiveRole: the viewer's own seat only; the effective role
 *   applies the bottom-card derivation (getBottomCardEffectiveRole) as-is.
 * - Wolf visibility (wolfPackSeats): replicates determineActionerState's
 *   showWolves branch structure exactly, including the matching-role branch
 *   NOT applying the bottom-card wolf-vote exclusion (that exclusion applies
 *   to seat highlighting, vote submission, and progression instead).
 * - Seat visibleRole: only the viewer's own seat exposes a role. Wolf pack
 *   peers are flagged (isWolfPackPeer), never role-named — the seat board
 *   shows a highlight only, and the hiddenWolf confirm status lists seats.
 * - night.reveals: at most one entry (the current groupConfirm step). Each
 *   viewer learns only their own subject status; ackedSeats is public (it
 *   drives the confirm badges every viewer sees).
 */

import { getBotDisplayName } from '../../../platform/room/getBotDisplayName';
import { isBotOccupant } from '../../../platform/room/seating';
import {
  type ActionSchema,
  canRoleSeeWolves,
  doesRoleParticipateInWolfVote,
  GameStatus,
  isWolfRole,
  type RoleId,
  type SchemaId,
} from './models';
import { resolveCurrentNightStep } from './nightStep';
import {
  getBottomCardEffectiveRole,
  getWerewolfUserSeat,
  getWerewolfViewedSeats,
  isBottomCardWolfVoteExcluded,
  resolveNightStepActor,
} from './playerHelpers';
import type { ConfirmStatus, GameState } from './protocol/types';
import type { CurrentNightResults } from './resolvers/types';

// =============================================================================
// View types
// =============================================================================

/** One occupied seat as a viewer may see it. */
export interface WerewolfSeatView {
  readonly seat: number;
  readonly displayName: string;
  readonly isBot: boolean;
  /** The seat's role when this viewer is entitled to it (own seat); else null. */
  readonly visibleRole: RoleId | null;
  /** The seat is a wolf the viewer may recognize during the wolf meeting. */
  readonly isWolfPackPeer: boolean;
  /** Public identity-viewing record for this seat. */
  readonly hasViewedRole: boolean;
}

/** The current groupConfirm reveal, cropped to one viewer. */
export interface WerewolfRevealView {
  readonly stepId: SchemaId;
  /** Seats that have acknowledged this reveal (public progress). */
  readonly ackedSeats: readonly number[];
  /** Whether the viewer has already acknowledged. */
  readonly hasAcked: boolean;
  /** Whether the viewer is a subject of this reveal (hypnotized / converted / lover). */
  readonly isSubject: boolean;
  /** cupidLoversReveal only: the other lover's seat, visible to lovers only. */
  readonly partnerSeat: number | null;
  /** piperHypnotizedReveal only: the full hypnotized list, visible to the hypnotized only. */
  readonly subjectSeats: readonly number[] | null;
}

export interface WerewolfNightView {
  /** Kind of the current step's action schema; null outside the night flow. */
  readonly stepSchemaKind: ActionSchema['kind'] | null;
  /** The step's confirm status, only for the viewer it belongs to. */
  readonly confirmStatus: ConfirmStatus | null;
  /** Zero or one reveal views (only the current groupConfirm step is live). */
  readonly reveals: readonly WerewolfRevealView[];
  /** Wolf votes by seat, only while the viewer may see the wolf meeting. */
  readonly wolfVotesBySeat: Readonly<Record<string, number>> | null;
}

export interface WerewolfViewModel {
  readonly status: GameStatus;
  readonly mySeat: number | null;
  readonly myRole: RoleId | null;
  /** Own role after the bottom-card derivation (thief / treasureMaster). */
  readonly myEffectiveRole: RoleId | null;
  readonly seats: readonly WerewolfSeatView[];
  /** Seats the viewer recognizes as wolves; null when the pack is not visible. */
  readonly wolfPackSeats: readonly number[] | null;
  /** Seats with a completed identity viewing (public, AU-19 basis). */
  readonly viewedSeats: readonly number[];
  readonly night: WerewolfNightView;
  readonly day: {
    /** Elected sheriff seat from the final election result; null until elected. */
    readonly sheriffSeat: number | null;
    /** Seat of the user selected as MVP; null until a selection exists. */
    readonly mvpSeat: number | null;
  };
}

// =============================================================================
// Current step derivation (same source as the client: night plan + index)
// =============================================================================

interface CurrentStep {
  readonly roleId: RoleId;
  readonly schema: ActionSchema;
}

function resolveCurrentStep(state: GameState): CurrentStep | null {
  if (state.status !== GameStatus.Ongoing) return null;
  const current = resolveCurrentNightStep(state);
  if (!current) return null;
  return { roleId: current.step.roleId, schema: current.schema };
}

// =============================================================================
// Wolf visibility (determineActionerState's showWolves, branch-for-branch)
// =============================================================================

function deriveShowWolves(args: {
  readonly myRole: RoleId | null;
  readonly currentActionRole: RoleId | null;
  readonly schema: ActionSchema | null;
  readonly results: CurrentNightResults | undefined;
}): boolean {
  const { myRole, currentActionRole, schema, results } = args;
  if (!currentActionRole || !myRole) return false;

  const isWolfMeeting = schema?.kind === 'wolfVote' && schema.meeting?.canSeeEachOther === true;
  if (!isWolfMeeting) return false;

  const effectiveRole = getBottomCardEffectiveRole(myRole, results);

  // Matching-role branch: the bottom-card exclusion is not applied here.
  if (effectiveRole === currentActionRole) {
    return doesRoleParticipateInWolfVote(effectiveRole);
  }

  // Wolf-meeting branch for participating wolves of another role.
  if (!isWolfRole(effectiveRole)) return false;
  if (isBottomCardWolfVoteExcluded(myRole)) return false;
  return doesRoleParticipateInWolfVote(effectiveRole);
}

function deriveWolfPackSeats(
  state: GameState,
  occupiedSeats: readonly number[],
  showWolves: boolean,
): readonly number[] | null {
  if (!showWolves) return null;
  const pack: number[] = [];
  for (const seat of occupiedSeats) {
    const player = state.players[seat]!;
    if (!player.role) continue;
    const effectiveRole = getBottomCardEffectiveRole(player.role, state.currentNightResults);
    if (
      isWolfRole(effectiveRole) &&
      canRoleSeeWolves(effectiveRole) &&
      !isBottomCardWolfVoteExcluded(player.role)
    ) {
      pack.push(seat);
    }
  }
  return pack;
}

// =============================================================================
// Seat views
// =============================================================================

function listOccupiedSeats(state: GameState): number[] {
  const seats: number[] = [];
  for (const [seatStr, player] of Object.entries(state.players)) {
    if (player !== null) seats.push(Number.parseInt(seatStr, 10));
  }
  return seats.sort((a, b) => a - b);
}

function buildSeatViews(
  state: GameState,
  occupiedSeats: readonly number[],
  viewerSeat: number | null,
  wolfPackSeats: readonly number[] | null,
): WerewolfSeatView[] {
  return occupiedSeats.map((seat) => {
    const player = state.players[seat]!;
    const occupant = state.roster[seat];
    if (occupant == null) {
      throw new Error(`[FAIL-FAST] Werewolf seat ${seat} has game data without an occupant`);
    }

    let displayName: string;
    let isBot: boolean;
    if (isBotOccupant(occupant)) {
      isBot = true;
      displayName = getBotDisplayName(seat);
    } else {
      isBot = false;
      // Fallback matches the client seat board (`|| '玩家'`): an empty-string
      // profile name falls back too, not just a missing profile.
      displayName = state.playerProfiles[occupant.userId]?.displayName || '玩家';
    }

    return {
      seat,
      displayName,
      isBot,
      visibleRole: seat === viewerSeat ? (player.role ?? null) : null,
      isWolfPackPeer: wolfPackSeats !== null && wolfPackSeats.includes(seat),
      hasViewedRole: player.hasViewedRole,
    };
  });
}

// =============================================================================
// Confirm status gating (the status belongs to exactly one actor seat)
// =============================================================================

function deriveConfirmStatus(
  state: GameState,
  step: CurrentStep | null,
  viewerSeat: number | null,
): ConfirmStatus | null {
  const status = state.confirmStatus;
  if (!status || !step || step.schema.kind !== 'confirm' || viewerSeat === null) return null;
  if (step.roleId !== status.role) return null;
  const actor = resolveNightStepActor(state, status.role);
  return actor !== null && actor.seat === viewerSeat ? status : null;
}

// =============================================================================
// Group confirm reveals (schema -> ack family is the single mapping)
// =============================================================================

function ackSeatsForStep(state: GameState, stepId: SchemaId): readonly number[] {
  switch (stepId) {
    case 'awakenedGargoyleConvertReveal':
      return state.conversionRevealAcks;
    case 'seedWolfInfectReveal':
      return state.seedWolfInfectionRevealAcks;
    case 'cupidLoversReveal':
      return state.cupidLoversRevealAcks;
    case 'piperHypnotizedReveal':
      return state.piperRevealAcks;
    default:
      throw new Error(`Unknown groupConfirm step: ${stepId}`);
  }
}

function buildRevealView(
  state: GameState,
  step: CurrentStep | null,
  viewerSeat: number | null,
): WerewolfRevealView | null {
  if (!step || step.schema.kind !== 'groupConfirm') return null;
  const stepId = step.schema.id;
  const ackedSeats = ackSeatsForStep(state, stepId);

  let isSubject = false;
  let partnerSeat: number | null = null;
  let subjectSeats: readonly number[] | null = null;

  if (viewerSeat !== null) {
    switch (stepId) {
      case 'piperHypnotizedReveal':
        isSubject = state.hypnotizedSeats.includes(viewerSeat);
        subjectSeats = isSubject ? state.hypnotizedSeats : null;
        break;
      case 'awakenedGargoyleConvertReveal':
        isSubject = state.convertedSeat === viewerSeat;
        break;
      case 'cupidLoversReveal': {
        const lovers = state.loverSeats;
        if (lovers && lovers.includes(viewerSeat)) {
          isSubject = true;
          partnerSeat = lovers[0] === viewerSeat ? lovers[1] : lovers[0];
        }
        break;
      }
      case 'seedWolfInfectReveal': {
        const result = state.seedWolfInfectionResult;
        isSubject = result?.outcome === 'converted' && result.targetSeat === viewerSeat;
        break;
      }
      default:
        throw new Error(`Unknown groupConfirm step: ${stepId}`);
    }
  }

  return {
    stepId,
    ackedSeats,
    hasAcked: viewerSeat !== null && ackedSeats.includes(viewerSeat),
    isSubject,
    partnerSeat,
    subjectSeats,
  };
}

// =============================================================================
// Entry point
// =============================================================================

/**
 * Builds the cropped view model for one viewer.
 * @param state Authoritative game state (single source of truth).
 * @param viewerSeat Seat of the viewer (the client's effectiveSeat: own seat,
 *   or a bot seat the host is controlling); null for spectators without a seat.
 */
export function getWerewolfViewModel(
  state: GameState,
  viewerSeat: number | null,
): WerewolfViewModel {
  const myPlayer = viewerSeat === null ? null : (state.players[viewerSeat] ?? null);
  const myRole = myPlayer?.role ?? null;
  const myEffectiveRole =
    myRole === null ? null : getBottomCardEffectiveRole(myRole, state.currentNightResults);

  const step = resolveCurrentStep(state);
  const showWolves = deriveShowWolves({
    myRole,
    currentActionRole: step?.roleId ?? null,
    schema: step?.schema ?? null,
    results: state.currentNightResults,
  });

  const occupiedSeats = listOccupiedSeats(state);
  const wolfPackSeats = deriveWolfPackSeats(state, occupiedSeats, showWolves);
  const reveal = buildRevealView(state, step, viewerSeat);

  return {
    status: state.status,
    mySeat: viewerSeat,
    myRole,
    myEffectiveRole,
    seats: buildSeatViews(state, occupiedSeats, viewerSeat, wolfPackSeats),
    wolfPackSeats,
    viewedSeats: getWerewolfViewedSeats(state.players),
    night: {
      stepSchemaKind: step?.schema.kind ?? null,
      confirmStatus: deriveConfirmStatus(state, step, viewerSeat),
      reveals: reveal ? [reveal] : [],
      wolfVotesBySeat: showWolves ? (state.currentNightResults?.wolfVotesBySeat ?? null) : null,
    },
    day: {
      sheriffSeat:
        state.sheriffElectionResult?.kind === 'elected'
          ? state.sheriffElectionResult.sheriffSeat
          : null,
      mvpSeat: state.mvpUserId ? getWerewolfUserSeat(state, state.mvpUserId) : null,
    },
  };
}
