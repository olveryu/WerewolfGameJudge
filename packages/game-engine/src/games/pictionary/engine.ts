/** Concrete authoritative Pictionary engine definition. */

import {
  type CommandContext,
  commit,
  type CommonGameLifecycle,
  type CreateGameContext,
  type Decision,
  type GameEngineDefinition,
  reject,
  resolveHostActorId,
  resolveSystemActorEffectId,
  resolveUncontrolledUserActorId,
  resolveUserActorId,
} from '../../platform/engine';
import { PICTIONARY_GAME_TYPE, type PictionaryGameType } from '../../platform/protocol/gameTypes';
import {
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_GAME_IN_PROGRESS,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
} from '../../platform/protocol/reasons';
import { createSeededRng, shuffleArray } from '../../platform/random';
import {
  decideClearSeats,
  decideKickSeat,
  decideLeaveSeat,
  decideTakeSeat,
  findSeatByUserId,
  type SeatChange,
  type SeatOperationResult,
} from '../../platform/room/seating';
import type { PictionaryCommand } from './commands/types';
import type { PictionaryEvent } from './domain/events';
import { evolvePictionaryState } from './domain/evolve';
import {
  REASON_PICTIONARY_CONFIG_INVALID,
  REASON_PICTIONARY_GALLERY_MANUAL,
  REASON_PICTIONARY_OCCUPIED_SEAT_OUT_OF_RANGE,
  REASON_PICTIONARY_PHASE_INVALID,
  REASON_PICTIONARY_PHASE_NOT_EXPIRED,
  REASON_PICTIONARY_ROOM_NOT_FULL,
  REASON_PICTIONARY_TASK_ALREADY_SUBMITTED,
  REASON_PICTIONARY_TASK_INVALID,
  REASON_PICTIONARY_TEXT_INVALID,
  REASON_PICTIONARY_UPLOAD_INVALID,
} from './domain/reasons';
import type { PictionaryEffect } from './effects/types';
import { normalizePictionaryState } from './state/normalize';
import {
  getPictionaryExpectedKind,
  getPictionaryRelayStepCount,
  getPictionaryTaskForSeat,
  isPictionaryImplicitBotSeat,
  isPictionaryRoomFull,
  isValidPictionaryConfig,
  isValidPictionaryText,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_MAX_BYTES,
  PICTIONARY_DRAWING_WIDTH,
  type PictionaryChain,
  type PictionaryConfig,
  type PictionaryDrawingReservation,
  type PictionaryGalleryState,
  type PictionaryHumanSeat,
  type PictionaryMedia,
  type PictionaryProfileUpdate,
  type PictionarySeatProfile,
  type PictionaryState,
} from './state/types';
import { PICTIONARY_STATE_IDENTITY, PICTIONARY_STATE_VERSION } from './state/version';

type PictionaryDecision = Decision<PictionaryEvent, PictionaryEffect>;

function commitPictionary(events: readonly PictionaryEvent[]): PictionaryDecision {
  return commit({ events, broadcast: events.length === 0 ? 'none' : 'state' });
}

function requireLobby(state: PictionaryState): PictionaryDecision | null {
  return state.phase === 'lobby' ? null : reject(REASON_GAME_IN_PROGRESS);
}

function rejectSeatOperation(
  result: Extract<SeatOperationResult<PictionaryHumanSeat>, { kind: 'rejected' }>,
): PictionaryDecision {
  return reject(result.reason);
}

function seatChangesEvent(changes: readonly SeatChange<PictionaryHumanSeat>[]): PictionaryEvent {
  return { type: 'pictionary.seats.changed', changes };
}

function decideTakePictionarySeat(
  state: PictionaryState,
  seat: number,
  profile: PictionarySeatProfile,
  context: CommandContext,
): PictionaryDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const result = decideTakeSeat(
    state.realSeats,
    state.config.numberOfPlayers,
    seat,
    actor.value,
    (targetSeat): PictionaryHumanSeat => ({
      userId: actor.value,
      seat: targetSeat,
      profile: { ...profile },
    }),
  );
  return result.kind === 'rejected'
    ? rejectSeatOperation(result)
    : commitPictionary([seatChangesEvent(result.changes)]);
}

function decideLeavePictionarySeat(
  state: PictionaryState,
  context: CommandContext,
): PictionaryDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const result = decideLeaveSeat(state.realSeats, state.config.numberOfPlayers, actor.value);
  return result.kind === 'rejected'
    ? rejectSeatOperation(result)
    : commitPictionary([seatChangesEvent(result.changes)]);
}

function decideKickPictionarySeat(
  state: PictionaryState,
  seat: number,
  context: CommandContext,
): PictionaryDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (isPictionaryImplicitBotSeat(state, seat)) {
    return commitPictionary([{ type: 'pictionary.botSeat.excluded', seat }]);
  }
  const result = decideKickSeat(state.realSeats, state.config.numberOfPlayers, seat);
  if (result.kind === 'rejected') return rejectSeatOperation(result);
  const events: PictionaryEvent[] = [seatChangesEvent(result.changes)];
  if (state.fillEmptySeatsWithBots && !state.excludedBotSeats.includes(seat)) {
    events.push({ type: 'pictionary.botSeat.excluded', seat });
  }
  return commitPictionary(events);
}

function decideClearPictionarySeats(
  state: PictionaryState,
  context: CommandContext,
): PictionaryDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const result = decideClearSeats(state.realSeats, state.config.numberOfPlayers);
  if (result.kind === 'rejected') return rejectSeatOperation(result);
  const events: PictionaryEvent[] = [];
  if (result.changes.length > 0) events.push(seatChangesEvent(result.changes));
  if (state.fillEmptySeatsWithBots) {
    events.push({ type: 'pictionary.botFill.changed', isEnabled: false });
  }
  return commitPictionary(events);
}

function decideFillPictionaryBots(
  state: PictionaryState,
  context: CommandContext,
): PictionaryDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  return state.fillEmptySeatsWithBots && state.excludedBotSeats.length === 0
    ? commitPictionary([])
    : commitPictionary([{ type: 'pictionary.botFill.changed', isEnabled: true }]);
}

function decideUpdatePictionaryProfile(
  state: PictionaryState,
  profile: PictionaryProfileUpdate,
  context: CommandContext,
): PictionaryDecision {
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const seat = findSeatByUserId(state.realSeats, state.config.numberOfPlayers, actor.value);
  return seat === null
    ? reject(REASON_NOT_SEATED)
    : commitPictionary([{ type: 'pictionary.profile.updated', seat, profile: { ...profile } }]);
}

function decideUpdatePictionaryConfig(
  state: PictionaryState,
  config: PictionaryConfig,
  context: CommandContext,
): PictionaryDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (!isValidPictionaryConfig(config)) return reject(REASON_PICTIONARY_CONFIG_INVALID);
  if (Object.keys(state.realSeats).some((seat) => Number(seat) >= config.numberOfPlayers)) {
    return reject(REASON_PICTIONARY_OCCUPIED_SEAT_OUT_OF_RANGE);
  }
  return commitPictionary([{ type: 'pictionary.config.updated', config }]);
}

function durationDeadline(nowMs: number, durationSeconds: number | null): number | null {
  return durationSeconds === null ? null : nowMs + durationSeconds * 1_000;
}

function getAnswerDuration(state: PictionaryState, stepIndex: number): number | null {
  return getPictionaryExpectedKind(stepIndex) === 'drawing'
    ? state.config.drawingDurationSeconds
    : state.config.guessDurationSeconds;
}

function createRound(state: PictionaryState, context: CommandContext): PictionaryEvent {
  const roundId = `pictionary-round:${context.commandId}`;
  const seatOrder = shuffleArray(
    Array.from({ length: state.config.numberOfPlayers }, (_, seat) => seat),
    createSeededRng(`${context.randomSeed}:pictionary-relay`),
  );
  const chains: readonly PictionaryChain[] = seatOrder.map((originSeat) => ({
    id: `${roundId}:chain:${originSeat}`,
    originSeat,
    entries: [],
  }));
  return {
    type: 'pictionary.round.started',
    roundId,
    seatOrder,
    chains,
    deadlineAt: durationDeadline(context.nowMs, getAnswerDuration(state, 0)),
  };
}

function decideStartPictionaryRound(
  state: PictionaryState,
  context: CommandContext,
): PictionaryDecision {
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase !== 'lobby' && state.phase !== 'ended') {
    return reject(REASON_PICTIONARY_PHASE_INVALID);
  }
  if (!isPictionaryRoomFull(state)) return reject(REASON_PICTIONARY_ROOM_NOT_FULL);
  return commitPictionary([createRound(state, context)]);
}

function resolveSeatTask(
  state: PictionaryState,
  context: CommandContext,
  requiredPhase: 'answering' | 'settling',
):
  | {
      readonly seat: number;
      readonly task: NonNullable<ReturnType<typeof getPictionaryTaskForSeat>>;
    }
  | PictionaryDecision {
  if (state.phase !== requiredPhase) return reject(REASON_PICTIONARY_PHASE_INVALID);
  if (state.deadlineAt !== null && context.nowMs >= state.deadlineAt) {
    return reject(REASON_PICTIONARY_PHASE_NOT_EXPIRED);
  }
  const actor = resolveUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  let seat: number | null;
  if (context.controlledSeat === null) {
    seat = findSeatByUserId(state.realSeats, state.config.numberOfPlayers, actor.value);
  } else {
    if (actor.value !== state.hostUserId) return reject(REASON_NOT_HOST);
    if (!isPictionaryImplicitBotSeat(state, context.controlledSeat)) {
      return reject(REASON_CONTROLLED_SEAT_NOT_BOT);
    }
    seat = context.controlledSeat;
  }
  if (seat === null) return reject(REASON_NOT_SEATED);
  const task = getPictionaryTaskForSeat(state, seat);
  if (task === null) return reject(REASON_PICTIONARY_TASK_INVALID);
  if (task.chain.entries.length > state.stepIndex) {
    return reject(REASON_PICTIONARY_TASK_ALREADY_SUBMITTED);
  }
  return { seat, task };
}

function isDecision(value: ReturnType<typeof resolveSeatTask>): value is PictionaryDecision {
  return 'kind' in value;
}

function phaseChangedEvent(
  state: PictionaryState,
  phase: PictionaryState['phase'],
  stepIndex: number,
  deadlineAt: number | null,
  gallery: PictionaryGalleryState | null = null,
): PictionaryEvent {
  return { type: 'pictionary.phase.changed', phase, stepIndex, deadlineAt, gallery };
}

function hasResolvedCurrentStep(state: PictionaryState, additionalEntries = 0): boolean {
  const resolved = state.chains.reduce(
    (count, chain) => count + (chain.entries.length > state.stepIndex ? 1 : 0),
    0,
  );
  return resolved + additionalEntries === state.config.numberOfPlayers;
}

function transitionEvent(state: PictionaryState, nowMs: number): PictionaryEvent {
  return phaseChangedEvent(
    state,
    'transition',
    state.stepIndex,
    durationDeadline(nowMs, state.config.transitionDurationSeconds),
  );
}

function settlingEvent(state: PictionaryState): PictionaryEvent {
  return phaseChangedEvent(state, 'settling', state.stepIndex, null);
}

function decideSetPictionaryTaskReadiness(
  state: PictionaryState,
  isReady: boolean,
  context: CommandContext,
): PictionaryDecision {
  const resolved = resolveSeatTask(state, context, 'answering');
  if (isDecision(resolved)) return resolved;
  const wasReady = state.readySeats.includes(resolved.seat);
  if (wasReady === isReady) return commitPictionary([]);
  const events: PictionaryEvent[] = [
    { type: 'pictionary.task.readiness.changed', seat: resolved.seat, isReady },
  ];
  const readySeatCount = state.readySeats.length + (isReady ? 1 : -1);
  if (readySeatCount === state.config.numberOfPlayers) {
    events.push(settlingEvent(state));
  }
  return commitPictionary(events);
}

function decideSubmitPictionaryText(
  state: PictionaryState,
  text: string,
  context: CommandContext,
): PictionaryDecision {
  const resolved = resolveSeatTask(state, context, 'settling');
  if (isDecision(resolved)) return resolved;
  if (resolved.task.expectedKind !== 'text') return reject(REASON_PICTIONARY_TASK_INVALID);
  if (!isValidPictionaryText(text)) return reject(REASON_PICTIONARY_TEXT_INVALID);
  const events: PictionaryEvent[] = [
    {
      type: 'pictionary.task.submitted',
      chainId: resolved.task.chain.id,
      entry: {
        kind: 'text',
        id: `pictionary-entry:${context.commandId}`,
        authorSeat: resolved.seat,
        text,
        submittedAt: context.nowMs,
      },
      submissionId: null,
    },
  ];
  if (hasResolvedCurrentStep(state, 1)) events.push(transitionEvent(state, context.nowMs));
  return commitPictionary(events);
}

function decideReservePictionaryDrawing(
  state: PictionaryState,
  context: CommandContext,
): PictionaryDecision {
  const resolved = resolveSeatTask(state, context, 'settling');
  if (isDecision(resolved)) return resolved;
  if (resolved.task.expectedKind !== 'drawing') return reject(REASON_PICTIONARY_TASK_INVALID);
  if (state.reservations.some((reservation) => reservation.authorSeat === resolved.seat)) {
    return reject(REASON_PICTIONARY_TASK_ALREADY_SUBMITTED);
  }
  const reservation: PictionaryDrawingReservation = {
    submissionId: `pictionary-submission:${context.commandId}`,
    entryId: `pictionary-entry:${context.commandId}`,
    chainId: resolved.task.chain.id,
    authorSeat: resolved.seat,
    reservedAt: context.nowMs,
    uploadDeadlineAt: state.deadlineAt,
  };
  return commitPictionary([{ type: 'pictionary.drawing.reserved', reservation }]);
}

function isValidMedia(media: PictionaryMedia): boolean {
  return (
    media.objectKey.length > 0 &&
    media.contentType === 'image/png' &&
    media.width === PICTIONARY_DRAWING_WIDTH &&
    media.height === PICTIONARY_DRAWING_HEIGHT &&
    Number.isSafeInteger(media.byteLength) &&
    media.byteLength > 0 &&
    media.byteLength <= PICTIONARY_DRAWING_MAX_BYTES &&
    media.sha256.length > 0
  );
}

function decideCommitPictionaryDrawing(
  state: PictionaryState,
  submissionId: string,
  media: PictionaryMedia,
  context: CommandContext,
): PictionaryDecision {
  const actor = resolveSystemActorEffectId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase !== 'settling') {
    return reject(REASON_PICTIONARY_PHASE_INVALID);
  }
  const reservation = state.reservations.find((item) => item.submissionId === submissionId);
  if (reservation === undefined || !isValidMedia(media)) {
    return reject(REASON_PICTIONARY_UPLOAD_INVALID);
  }
  const events: PictionaryEvent[] = [
    {
      type: 'pictionary.task.submitted',
      chainId: reservation.chainId,
      entry: {
        kind: 'drawing',
        id: reservation.entryId,
        authorSeat: reservation.authorSeat,
        media,
        submittedAt: context.nowMs,
      },
      submissionId,
    },
  ];
  if (hasResolvedCurrentStep(state, 1)) events.push(transitionEvent(state, context.nowMs));
  return commitPictionary(events);
}

function decideSubmitEmptyPictionaryTask(
  state: PictionaryState,
  context: CommandContext,
): PictionaryDecision {
  const resolved = resolveSeatTask(state, context, 'settling');
  if (isDecision(resolved)) return resolved;
  if (state.reservations.some((reservation) => reservation.authorSeat === resolved.seat)) {
    return reject(REASON_PICTIONARY_TASK_ALREADY_SUBMITTED);
  }
  const events: PictionaryEvent[] = [
    {
      type: 'pictionary.task.submitted',
      chainId: resolved.task.chain.id,
      entry: {
        kind: 'missed',
        id: `pictionary-missed:${context.commandId}:${resolved.task.chain.id}`,
        authorSeat: resolved.seat,
        expectedKind: resolved.task.expectedKind,
      },
      submissionId: null,
    },
  ];
  if (hasResolvedCurrentStep(state, 1)) events.push(transitionEvent(state, context.nowMs));
  return commitPictionary(events);
}

function expireAnsweringPhase(state: PictionaryState): PictionaryDecision {
  return commitPictionary([settlingEvent(state)]);
}

function galleryStartEvent(state: PictionaryState, nowMs: number): PictionaryEvent {
  const isPlaying = state.config.galleryItemDurationSeconds !== null;
  return phaseChangedEvent(
    state,
    'gallery',
    state.stepIndex,
    durationDeadline(nowMs, state.config.galleryItemDurationSeconds),
    { chainIndex: 0, entryIndex: 0, isPlaying },
  );
}

function expireTransitionPhase(
  state: PictionaryState,
  context: CommandContext,
): PictionaryDecision {
  const nextStepIndex = state.stepIndex + 1;
  return nextStepIndex === getPictionaryRelayStepCount(state.config.numberOfPlayers)
    ? commitPictionary([galleryStartEvent(state, context.nowMs)])
    : commitPictionary([
        phaseChangedEvent(
          state,
          'answering',
          nextStepIndex,
          durationDeadline(context.nowMs, getAnswerDuration(state, nextStepIndex)),
        ),
      ]);
}

function nextGalleryPosition(
  state: PictionaryState,
  direction: 1 | -1,
): PictionaryGalleryState | null {
  if (state.gallery === null) return null;
  const chainCount = state.config.numberOfPlayers;
  const entryCount = state.stepIndex + 1;
  const current = state.gallery.chainIndex * entryCount + state.gallery.entryIndex;
  const next = current + direction;
  if (next < 0 || next >= chainCount * entryCount) return null;
  return {
    chainIndex: Math.floor(next / entryCount),
    entryIndex: next % entryCount,
    isPlaying: state.gallery.isPlaying,
  };
}

function updateGallery(
  state: PictionaryState,
  context: CommandContext,
  direction: 1 | -1,
): PictionaryDecision {
  if (state.phase !== 'gallery') return reject(REASON_PICTIONARY_PHASE_INVALID);
  const gallery = nextGalleryPosition(state, direction);
  if (gallery === null) {
    return direction === 1
      ? commitPictionary([phaseChangedEvent(state, 'ended', state.stepIndex, null, state.gallery)])
      : commitPictionary([]);
  }
  const deadlineAt = gallery.isPlaying
    ? durationDeadline(context.nowMs, state.config.galleryItemDurationSeconds)
    : null;
  return commitPictionary([
    phaseChangedEvent(state, 'gallery', state.stepIndex, deadlineAt, gallery),
  ]);
}

function decideExpirePictionaryPhase(
  state: PictionaryState,
  phaseRevision: number,
  context: CommandContext,
): PictionaryDecision {
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const actorSeat = findSeatByUserId(state.realSeats, state.config.numberOfPlayers, actor.value);
  if (actor.value !== state.hostUserId && actorSeat === null) {
    return reject(REASON_NOT_SEATED);
  }
  if (phaseRevision !== state.phaseRevision) return commitPictionary([]);
  if (state.deadlineAt === null || context.nowMs < state.deadlineAt) {
    return reject(REASON_PICTIONARY_PHASE_NOT_EXPIRED);
  }
  switch (state.phase) {
    case 'answering':
      return expireAnsweringPhase(state);
    case 'settling':
      return reject(REASON_PICTIONARY_PHASE_INVALID);
    case 'transition':
      return expireTransitionPhase(state, context);
    case 'gallery':
      return updateGallery(state, context, 1);
    case 'lobby':
    case 'ended':
      return reject(REASON_PICTIONARY_PHASE_INVALID);
  }
}

function decideFinishPictionaryPhase(
  state: PictionaryState,
  context: CommandContext,
): PictionaryDecision {
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase !== 'answering' || state.deadlineAt !== null) {
    return reject(REASON_PICTIONARY_PHASE_INVALID);
  }
  return expireAnsweringPhase(state);
}

function decidePausePictionaryGallery(
  state: PictionaryState,
  context: CommandContext,
): PictionaryDecision {
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase !== 'gallery' || state.gallery === null) {
    return reject(REASON_PICTIONARY_PHASE_INVALID);
  }
  return commitPictionary([
    phaseChangedEvent(state, 'gallery', state.stepIndex, null, {
      ...state.gallery,
      isPlaying: false,
    }),
  ]);
}

function decideResumePictionaryGallery(
  state: PictionaryState,
  context: CommandContext,
): PictionaryDecision {
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase !== 'gallery' || state.gallery === null) {
    return reject(REASON_PICTIONARY_PHASE_INVALID);
  }
  if (state.config.galleryItemDurationSeconds === null) {
    return reject(REASON_PICTIONARY_GALLERY_MANUAL);
  }
  return commitPictionary([
    phaseChangedEvent(
      state,
      'gallery',
      state.stepIndex,
      durationDeadline(context.nowMs, state.config.galleryItemDurationSeconds),
      { ...state.gallery, isPlaying: true },
    ),
  ]);
}

function decideMovePictionaryGallery(
  state: PictionaryState,
  context: CommandContext,
  direction: 1 | -1,
): PictionaryDecision {
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  return updateGallery(state, context, direction);
}

function decideReturnPictionaryToLobby(
  state: PictionaryState,
  context: CommandContext,
): PictionaryDecision {
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  return state.phase === 'ended'
    ? commitPictionary([{ type: 'pictionary.game.returnedToLobby' }])
    : reject(REASON_PICTIONARY_PHASE_INVALID);
}

function createInitialPictionaryState(
  config: PictionaryConfig,
  context: CreateGameContext,
): PictionaryState {
  if (!isValidPictionaryConfig(config)) throw new Error('Invalid Pictionary config');
  return normalizePictionaryState({
    ...PICTIONARY_STATE_IDENTITY,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    phase: 'lobby',
    phaseRevision: 0,
    config,
    realSeats: {},
    fillEmptySeatsWithBots: false,
    excludedBotSeats: [],
    roundNumber: 0,
    roundId: null,
    seatOrder: [],
    stepIndex: -1,
    deadlineAt: null,
    readySeats: [],
    reservations: [],
    chains: [],
    gallery: null,
  });
}

export function getPictionaryLifecycle(state: PictionaryState): CommonGameLifecycle {
  if (state.phase === 'lobby') return 'setup';
  if (state.phase === 'ended') return 'ended';
  return 'ongoing';
}

export function decidePictionaryCommand(
  state: PictionaryState,
  command: PictionaryCommand,
  context: CommandContext,
): PictionaryDecision {
  switch (command.type) {
    case 'room.seat.take':
      return decideTakePictionarySeat(state, command.seat, command.profile, context);
    case 'room.seat.leave':
      return decideLeavePictionarySeat(state, context);
    case 'room.seat.kick':
      return decideKickPictionarySeat(state, command.seat, context);
    case 'room.seat.clear':
      return decideClearPictionarySeats(state, context);
    case 'room.seat.fillBots':
      return decideFillPictionaryBots(state, context);
    case 'room.profile.update':
      return decideUpdatePictionaryProfile(state, command.profile, context);
    case 'pictionary.config.update':
      return decideUpdatePictionaryConfig(state, command.config, context);
    case 'pictionary.round.start':
    case 'pictionary.round.next':
      return decideStartPictionaryRound(state, context);
    case 'pictionary.task.ready.set':
      return decideSetPictionaryTaskReadiness(state, command.isReady, context);
    case 'pictionary.task.empty.submit':
      return decideSubmitEmptyPictionaryTask(state, context);
    case 'pictionary.text.submit':
      return decideSubmitPictionaryText(state, command.text, context);
    case 'pictionary.drawing.reserve':
      return decideReservePictionaryDrawing(state, context);
    case 'pictionary.drawing.commit':
      return decideCommitPictionaryDrawing(state, command.submissionId, command.media, context);
    case 'pictionary.phase.expire':
      return decideExpirePictionaryPhase(state, command.phaseRevision, context);
    case 'pictionary.phase.finish':
      return decideFinishPictionaryPhase(state, context);
    case 'pictionary.gallery.pause':
      return decidePausePictionaryGallery(state, context);
    case 'pictionary.gallery.resume':
      return decideResumePictionaryGallery(state, context);
    case 'pictionary.gallery.advance':
      return decideMovePictionaryGallery(state, context, 1);
    case 'pictionary.gallery.rewind':
      return decideMovePictionaryGallery(state, context, -1);
    case 'pictionary.game.returnToLobby':
      return decideReturnPictionaryToLobby(state, context);
  }
  const exhaustive: never = command;
  return exhaustive;
}

export const pictionaryEngine = {
  gameType: PICTIONARY_GAME_TYPE,
  stateVersion: PICTIONARY_STATE_VERSION,
  createInitialState: createInitialPictionaryState,
  decide: decidePictionaryCommand,
  evolve: evolvePictionaryState,
  normalize: normalizePictionaryState,
  getLifecycle: getPictionaryLifecycle,
} satisfies GameEngineDefinition<
  PictionaryGameType,
  PictionaryState,
  PictionaryConfig,
  PictionaryCommand,
  PictionaryEvent,
  PictionaryEffect
>;

export type PictionaryEngine = typeof pictionaryEngine;
