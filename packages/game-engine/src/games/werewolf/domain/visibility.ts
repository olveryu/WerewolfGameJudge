/**
 * Werewolf view-model projection — the single place where viewer-relative
 * cropping of the authoritative GameState lives (AU-39).
 *
 * Pure function of (state, viewer): no IO, no mutation. Everything the room
 * UI needs that is a *rule fact* (who acts now, which seats the actor may
 * pick, which bottom cards are legal, which rejection is mine, which reveal
 * I still owe) is derived here so no client computes rules. Interaction
 * state (drafts, pending confirmation, dialog visibility) is deliberately
 * NOT projected — it is the client's own.
 *
 * @remarks Cropping rules:
 * - myRole / myEffectiveRole: the viewer's own seat only; the effective role
 *   applies the bottom-card derivation (getBottomCardEffectiveRole) as-is.
 * - Wolf visibility (wolfPackSeats): participating wolves during a meeting
 *   that can see each other; the bottom-card wolf-vote exclusion keeps
 *   treasureMaster out of the pack but still lets them see it.
 * - Seat visibleRole: the viewer's own seat, plus every bot seat when the
 *   viewer is the host (the judge reads bots' cards on their behalf).
 * - night.isActioner: the rule half of the former client
 *   determineActionerState — groupConfirm until acked, matching effective
 *   role until the step's action is recorded (wolf roles stay actioners
 *   because a meeting allows revotes), participating wolves during a
 *   meeting.
 * - night.reveals: at most one entry (the current groupConfirm step). Each
 *   viewer learns only their own subject status; ackedSeats is public.
 * - night.pendingReveal / rejection / witchContext / wolfRobot /
 *   chooseCard / wolfVote: cropped to the viewer that owns them; everyone
 *   else sees null.
 */

import { getBotDisplayName } from '../../../platform/room/getBotDisplayName';
import { buildSeatIdentityView } from '../../../platform/room/seatIdentity';
import { isWolfRobotHunterStatusGatePending } from './handlers/stepTransitionGuards';
import {
  type ActionSchema,
  canRoleSeeWolves,
  createTemplateFromRoles,
  doesRoleParticipateInWolfVote,
  GameStatus,
  type GameTemplate,
  getSchema,
  isWolfRole,
  type RevealKind,
  type RoleId,
  type SchemaId,
} from './models';
import { TargetConstraint } from './models/roles/spec';
import { resolveCurrentNightStep } from './nightStep';
import {
  getBottomCardEffectiveRole,
  getWerewolfUserSeat,
  isBottomCardWolfVoteExcluded,
  resolveNightStepActor,
} from './playerHelpers';
import type { ConfirmStatus, GameState } from './protocol/types';
import { type BottomCardChoice, evaluateBottomCardChoice } from './resolvers/bottomCardChoice';
import { CONSTRAINT_REJECT_NOT_SELF } from './resolvers/constraintValidator';
import type { CurrentNightResults } from './resolvers/types';

// =============================================================================
// View types
// =============================================================================

/** Who is looking at the room: their own seat (null while unseated) and whether they host. */
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
  /** The seat is a wolf the viewer may recognize during the wolf meeting. */
  readonly isWolfPackPeer: boolean;
  /** Public identity-viewing record for this seat. */
  readonly hasViewedRole: boolean;
  /**
   * Why the actioner may not pick this seat in the current step; null when
   * pickable or when the viewer is not the actioner. Only the NotSelf
   * constraint is projected — faction-based constraints would leak roles.
   */
  readonly disabledReason: string | null;
}

/** The reveal acknowledgement the viewer still owes (state-driven re-entry after reload). */
export interface WerewolfPendingReveal {
  /** Schema of the recorded action that produced the reveal (the engine's ack key). */
  readonly schemaId: SchemaId;
  /** Reveal kind declared by that schema's ui — the key of the reveal data in state. */
  readonly revealKind: RevealKind;
}

/** The engine's rejection of the viewer's own last action. */
export interface WerewolfRejectionView {
  readonly rejectionId: string;
  readonly action: string;
  readonly reason: string;
}

/** The wolf meeting as a participating wolf sees it. */
export interface WerewolfWolfVoteView {
  /** Every wolf's current vote by seat; -1 is an empty vote. */
  readonly votes: Readonly<Record<string, number>>;
  /** The viewer's own vote; null until cast. */
  readonly myVote: number | null;
  /** When the step settles after every wolf voted; null until armed. */
  readonly deadlineAt: number | null;
}

/** Wolf robot's learned identity and the hunter-status gate, for the wolf robot only. */
export interface WerewolfWolfRobotView {
  readonly targetSeat: number;
  readonly learnedRoleId: RoleId;
  readonly canShootAsHunter: boolean | null;
  /** The learned-hunter status must be viewed before the night may progress. */
  readonly isHunterStatusGatePending: boolean;
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
  /** The current step's action schema; null outside the night flow. */
  readonly actionSchema: ActionSchema | null;
  /** The role whose step this is; null outside the night flow. */
  readonly currentActionRole: RoleId | null;
  /** Whether the viewer is expected to act in the current step. */
  readonly isActioner: boolean;
  /** The step's confirm status, only for the viewer it belongs to. */
  readonly confirmStatus: ConfirmStatus | null;
  /** Zero or one reveal views (only the current groupConfirm step is live). */
  readonly reveals: readonly WerewolfRevealView[];
  /** The wolf meeting, only while the viewer may see it. */
  readonly wolfVote: WerewolfWolfVoteView | null;
  /** The reveal ack the viewer owes; null when none. */
  readonly pendingReveal: WerewolfPendingReveal | null;
  /** The engine's rejection addressed to the viewer; null when none. */
  readonly rejection: WerewolfRejectionView | null;
  /** The witch's turn context, only for the acting witch. */
  readonly witchContext: GameState['witchContext'] | null;
  /** The wolf robot's learned identity, only for the wolf robot. */
  readonly wolfRobot: WerewolfWolfRobotView | null;
  /** The bottom-card deck with legality, only for the acting chooser. */
  readonly chooseCard: BottomCardChoice | null;
  /** The current actor hint addressed to the viewer's effective role; null otherwise. */
  readonly actorHint: NonNullable<NonNullable<GameState['ui']>['currentActorHint']> | null;
}

export interface WerewolfViewModel {
  readonly status: GameStatus;
  readonly mySeat: number | null;
  readonly myRole: RoleId | null;
  /** Own role after the bottom-card derivation (thief / treasureMaster). */
  readonly myEffectiveRole: RoleId | null;
  /** The configured board as a template (name, player count, roles, rules). */
  readonly template: GameTemplate;
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

function stepConstraints(step: CurrentStep | null): readonly TargetConstraint[] {
  if (!step) return [];
  const schema = step.schema;
  if (schema.kind === 'chooseSeat' || schema.kind === 'swap' || schema.kind === 'multiChooseSeat') {
    return schema.constraints;
  }
  return [];
}

function buildSeatViews(args: {
  readonly state: GameState;
  readonly occupiedSeats: readonly number[];
  readonly viewer: WerewolfViewer;
  readonly wolfPackSeats: readonly number[] | null;
  readonly step: CurrentStep | null;
  readonly isActioner: boolean;
}): WerewolfSeatView[] {
  const { state, occupiedSeats, viewer, wolfPackSeats, step, isActioner } = args;
  // The wolf robot keeps its learn step open only for the hunter-status gate;
  // once the reveal exists there is nothing left to pick.
  const constraints =
    isActioner && !(step?.schema.id === 'wolfRobotLearn' && state.wolfRobotReveal != null)
      ? stepConstraints(step)
      : [];
  return occupiedSeats.map((seat) => {
    const player = state.players[seat]!;
    const occupant = state.roster[seat];
    if (occupant == null) {
      throw new Error(`[FAIL-FAST] Werewolf seat ${seat} has game data without an occupant`);
    }

    const identity = buildSeatIdentityView(state.roster, seat, getBotDisplayName);
    const isOwnSeat = seat === viewer.seat;
    return {
      seat,
      // Fallback matches the client seat board (`|| '玩家'`): an empty-string
      // profile name falls back too (bot names are never empty).
      displayName: identity.displayName || '玩家',
      isBot: identity.isBot,
      visibleRole: isOwnSeat || (viewer.isHost && identity.isBot) ? (player.role ?? null) : null,
      isWolfPackPeer: wolfPackSeats !== null && wolfPackSeats.includes(seat),
      hasViewedRole: state.roleViewedSeats.includes(seat),
      disabledReason:
        isOwnSeat && constraints.includes(TargetConstraint.NotSelf)
          ? CONSTRAINT_REJECT_NOT_SELF
          : null,
    };
  });
}

// =============================================================================
// Actioner (the rule half of the former client determineActionerState)
// =============================================================================

function deriveIsActioner(args: {
  readonly state: GameState;
  readonly step: CurrentStep | null;
  readonly viewerSeat: number | null;
  readonly myRole: RoleId | null;
  readonly myEffectiveRole: RoleId | null;
}): boolean {
  const { state, step, viewerSeat, myRole, myEffectiveRole } = args;
  if (!step || viewerSeat === null || myRole === null || myEffectiveRole === null) return false;

  if (step.schema.kind === 'groupConfirm') {
    return !ackSeatsForStep(state, step.schema.id).includes(viewerSeat);
  }

  const isWolfMeeting =
    step.schema.kind === 'wolfVote' && step.schema.meeting?.canSeeEachOther === true;

  if (myEffectiveRole === step.roleId) {
    if (isWolfMeeting && doesRoleParticipateInWolfVote(myEffectiveRole)) return true;
    // Non-wolf roles are done once their step's action is recorded; wolf
    // roles track votes instead and keep acting (revote).
    if (
      !isWolfRole(myEffectiveRole) &&
      state.actions.some((action) => action.schemaId === step.schema.id)
    ) {
      return false;
    }
    return true;
  }

  if (isWolfMeeting && isWolfRole(myEffectiveRole)) {
    if (isBottomCardWolfVoteExcluded(myRole)) return false;
    return doesRoleParticipateInWolfVote(myEffectiveRole);
  }

  return false;
}

// =============================================================================
// Viewer-owned night facts
// =============================================================================

function derivePendingReveal(
  state: GameState,
  viewerSeat: number | null,
): WerewolfPendingReveal | null {
  if (viewerSeat === null || state.pendingRevealAcks.length === 0) return null;
  const action = [...state.actions]
    .reverse()
    .find((candidate) => state.pendingRevealAcks.includes(candidate.schemaId));
  if (action === undefined || action.actorSeat !== viewerSeat) return null;
  const schema = getSchema(action.schemaId);
  const revealKind = schema.kind !== 'compound' ? schema.ui?.revealKind : undefined;
  if (revealKind === undefined) return null;
  return { schemaId: action.schemaId, revealKind };
}

function deriveRejection(
  state: GameState,
  viewerSeat: number | null,
): WerewolfRejectionView | null {
  const rejected = state.actionRejected;
  if (!rejected || viewerSeat === null || rejected.targetSeat !== viewerSeat) return null;
  return { rejectionId: rejected.rejectionId, action: rejected.action, reason: rejected.reason };
}

function deriveWolfVote(
  state: GameState,
  viewerSeat: number | null,
  showWolves: boolean,
): WerewolfWolfVoteView | null {
  if (!showWolves) return null;
  const votes = state.currentNightResults?.wolfVotesBySeat ?? {};
  const myVote = viewerSeat === null ? undefined : votes[String(viewerSeat)];
  return {
    votes,
    myVote: myVote ?? null,
    deadlineAt: state.nightStep?.kind === 'inStep' ? (state.nightStep.stepDeadline ?? null) : null,
  };
}

function deriveWolfRobot(
  state: GameState,
  myEffectiveRole: RoleId | null,
): WerewolfWolfRobotView | null {
  const reveal = state.wolfRobotReveal;
  if (!reveal || myEffectiveRole !== 'wolfRobot') return null;
  return {
    targetSeat: reveal.targetSeat,
    learnedRoleId: reveal.learnedRoleId,
    canShootAsHunter: reveal.canShootAsHunter ?? null,
    isHunterStatusGatePending: isWolfRobotHunterStatusGatePending(state),
  };
}

function deriveChooseCard(
  state: GameState,
  step: CurrentStep | null,
  isActioner: boolean,
): BottomCardChoice | null {
  if (!isActioner || step?.schema.kind !== 'chooseCard') return null;
  const chooser = step.roleId;
  if (chooser !== 'thief' && chooser !== 'treasureMaster') {
    throw new Error(`[FAIL-FAST] chooseCard step owned by non-chooser role ${chooser}`);
  }
  const bottomCards = state.bottomCards;
  if (!bottomCards) {
    throw new Error('[FAIL-FAST] chooseCard step without bottom cards in state');
  }
  return evaluateBottomCardChoice(chooser, bottomCards);
}

function deriveActorHint(
  state: GameState,
  myEffectiveRole: RoleId | null,
): WerewolfNightView['actorHint'] {
  const hint = state.ui?.currentActorHint;
  if (!hint || myEffectiveRole === null || !hint.targetRoleIds.includes(myEffectiveRole)) {
    return null;
  }
  return hint;
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
 * @param viewer The seat the viewer acts as (own seat, or a bot seat the host
 *   controls; null for spectators) and whether the viewer hosts the room.
 */
export function getWerewolfViewModel(state: GameState, viewer: WerewolfViewer): WerewolfViewModel {
  const viewerSeat = viewer.seat;
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
  const isActioner = deriveIsActioner({ state, step, viewerSeat, myRole, myEffectiveRole });

  const occupiedSeats = listOccupiedSeats(state);
  const wolfPackSeats = deriveWolfPackSeats(state, occupiedSeats, showWolves);
  const reveal = buildRevealView(state, step, viewerSeat);

  return {
    status: state.status,
    mySeat: viewerSeat,
    myRole,
    myEffectiveRole,
    template: createTemplateFromRoles([...state.templateRoles]),
    seats: buildSeatViews({ state, occupiedSeats, viewer, wolfPackSeats, step, isActioner }),
    wolfPackSeats,
    viewedSeats: state.roleViewedSeats,
    night: {
      actionSchema: step?.schema ?? null,
      currentActionRole: step?.roleId ?? null,
      isActioner,
      confirmStatus: deriveConfirmStatus(state, step, viewerSeat),
      reveals: reveal ? [reveal] : [],
      wolfVote: deriveWolfVote(state, viewerSeat, showWolves),
      pendingReveal: derivePendingReveal(state, viewerSeat),
      rejection: deriveRejection(state, viewerSeat),
      witchContext:
        isActioner && step?.schema.id === 'witchAction' ? (state.witchContext ?? null) : null,
      wolfRobot: deriveWolfRobot(state, myEffectiveRole),
      chooseCard: deriveChooseCard(state, step, isActioner),
      actorHint: deriveActorHint(state, myEffectiveRole),
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
