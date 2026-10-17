/**
 * Pictionary assembly over the shared relay chain machine.
 *
 * The machine (platform/room/relay) owns the flow logic; this module
 * binds it to Pictionary: its reason strings, its text rule (1..512
 * chars, stored verbatim, blank text allowed), its entry shapes
 * (text and missed here; drawings arrive through the reservation /
 * commit path Pictionary keeps its own), its previous-entry
 * projection (the full entry — Pictionary's task projection is the
 * privacy boundary and shows exactly the one previous entry), its
 * reservation gate (a reserved drawing already claims the seat's
 * submission), and its completion point — Pictionary settles in the
 * same decision that lands the final step's last entry, from the
 * frozen participant list, rewarding seats that authored a drawing
 * or a non-blank text. Entries land through this machine (text and
 * empty submissions) or through Pictionary's own drawing-commit
 * decision; both paths fire the one settlement assembled here. The
 * gallery is display only: entering it settles nothing.
 *
 * Pictionary persists its gallery position two-dimensionally
 * ({chainIndex, entryIndex}); the machine speaks a linear position.
 * The slice adapter converts on the way in and the phase-event
 * factory converts back on the way out, so the persisted shape
 * (state v9) never changes.
 */

import {
  buildGameCompletionPayload,
  type CommandContext,
  type GameCompletionPayload,
  reject,
} from '../../../platform/engine';
import { createRelayAssignment } from '../../../platform/room/relay/assignment';
import {
  expireRelayPhase,
  relayDeadline,
  type RelayExpireHooks,
} from '../../../platform/room/relay/clock';
import { controlRelayGallery } from '../../../platform/room/relay/gallery';
import { decideRelayTask, type RelayTaskHooks } from '../../../platform/room/relay/tasks';
import type {
  RelayEventKit,
  RelayGalleryControl,
  RelayGalleryState,
  RelayTaskCommand,
} from '../../../platform/room/relay/types';
import type { PictionaryCommand } from '../commands/types';
import type { PictionaryEffect } from '../effects/types';
import {
  getPictionaryExpectedKind,
  getPictionaryRelayStepCount,
  isValidPictionaryText,
  PICTIONARY_MAX_PLAYERS,
  PICTIONARY_MIN_PLAYERS,
  type PictionaryEntry,
  type PictionaryGalleryState,
  type PictionaryState,
} from '../state/types';
import { commitPictionary, type PictionaryDecision } from './decision';
import type { PictionaryEvent } from './events';
import {
  REASON_PICTIONARY_GALLERY_MANUAL,
  REASON_PICTIONARY_PHASE_INVALID,
  REASON_PICTIONARY_PHASE_NOT_EXPIRED,
  REASON_PICTIONARY_TASK_ALREADY_SUBMITTED,
  REASON_PICTIONARY_TASK_INVALID,
  REASON_PICTIONARY_TEXT_INVALID,
} from './reasons';

/** The shared machine's view of Pictionary state: every field as-is, gallery linearized. */
export type PictionaryRelaySlice = Omit<PictionaryState, 'gallery'> & {
  readonly gallery: RelayGalleryState | null;
};

function toLinearGallery(state: PictionaryState): RelayGalleryState | null {
  const gallery = state.gallery;
  if (gallery === null) return null;
  const entryCount = state.stepIndex + 1;
  return {
    position: gallery.chainIndex * entryCount + gallery.entryIndex,
    revealedPosition: gallery.revealedPosition,
    isPlaying: gallery.isPlaying,
    remainingMs: gallery.remainingMs,
  };
}

function fromLinearGallery(gallery: RelayGalleryState, stepIndex: number): PictionaryGalleryState {
  const entryCount = stepIndex + 1;
  return {
    chainIndex: Math.floor(gallery.position / entryCount),
    entryIndex: gallery.position % entryCount,
    isPlaying: gallery.isPlaying,
    revealedPosition: gallery.revealedPosition,
    remainingMs: gallery.remainingMs,
  };
}

/** Adapts authoritative state for the shared machine without touching the persisted shape. */
function toPictionaryRelaySlice(state: PictionaryState): PictionaryRelaySlice {
  return { ...state, gallery: toLinearGallery(state) };
}

/** Builds a phase event; the machine's linear gallery is stored back two-dimensionally. */
function pictionaryPhase(
  phase: PictionaryState['phase'],
  deadlineAt: number | null,
  stepIndex: number,
  gallery: RelayGalleryState | null,
): PictionaryEvent {
  return {
    type: 'pictionary.phase.changed',
    phase,
    stepIndex,
    deadlineAt,
    gallery: gallery === null ? null : fromLinearGallery(gallery, stepIndex),
  };
}

/** Binds the shared machine to Pictionary's reasons, shape, events and effects. */
function createPictionaryRelayKit(
  state: PictionaryState,
): RelayEventKit<PictionaryEntry, PictionaryEvent, PictionaryEffect> {
  return {
    reasons: {
      phase: REASON_PICTIONARY_PHASE_INVALID,
      task: REASON_PICTIONARY_TASK_INVALID,
      taskExpired: REASON_PICTIONARY_PHASE_NOT_EXPIRED,
      submitted: REASON_PICTIONARY_TASK_ALREADY_SUBMITTED,
      text: REASON_PICTIONARY_TEXT_INVALID,
      manual: REASON_PICTIONARY_GALLERY_MANUAL,
    },
    shape: {
      numberOfPlayers: state.config.numberOfPlayers,
      transitionDurationSeconds: state.config.transitionDurationSeconds,
      galleryItemDurationSeconds: state.config.galleryItemDurationSeconds,
    },
    commit: (events, effects = []) => commitPictionary(events, effects),
    phaseChanged: (phase, deadlineAt, stepIndex, gallery) =>
      pictionaryPhase(phase, deadlineAt, stepIndex, gallery),
    taskReady: (seat, isReady) => ({ type: 'pictionary.task.readiness.changed', seat, isReady }),
    entryAppended: (chainId, entry) => ({
      type: 'pictionary.task.submitted',
      chainId,
      entry,
      submissionId: null,
    }),
    roundCompleted: () => {
      // Pictionary has no round-completed event: round completion is
      // derived from the step index, and the settlement fires from
      // the task hooks (and the drawing-commit decision), so this
      // factory is unreachable.
      throw new Error('Pictionary has no round-completed event');
    },
    completionEffect: (payload) => ({ type: 'pictionary.game.completed', payload }),
  };
}

/**
 * Assembles Pictionary's one settlement payload for a completed
 * round: the frozen participant list supplies the humans (bot seats
 * carry no user id and drop out), narrowed to seats that authored a
 * drawing or a non-blank text across the round's chains — the entry
 * appended by the completing decision included, as it is not in the
 * chains yet. The participant list is frozen in rotation order; the
 * shared builder's input contract is seat order, so the humans are
 * sorted by seat here. Both completion paths (the shared task
 * machine's round-completed hook and the drawing-commit decision)
 * build the payload here so the settlement content exists exactly
 * once.
 */
export function buildPictionaryCompletionPayload(
  state: Pick<PictionaryState, 'roundId' | 'chains' | 'participants'>,
  appendedEntries: readonly PictionaryEntry[],
  nowMs: number,
): GameCompletionPayload {
  if (state.roundId === null) throw new Error('[FAIL-FAST] Completion requires a round');
  const authors = new Set(
    [...state.chains.flatMap((chain) => chain.entries), ...appendedEntries]
      .filter(
        (entry) =>
          entry.kind === 'drawing' || (entry.kind === 'text' && entry.text.trim().length > 0),
      )
      .map((entry) => entry.authorSeat),
  );
  return buildGameCompletionPayload({
    roundId: state.roundId,
    completedAt: nowMs,
    humans: [...state.participants]
      .sort((left, right) => left.seat - right.seat)
      .flatMap((participant) =>
        participant.userId !== null ? [{ seat: participant.seat, userId: participant.userId }] : [],
      ),
    includeSeat: (player) => authors.has(player.seat),
  });
}

/** Creates the persisted player permutation and Williams relay offsets for one round. */
export function createPictionaryAssignment(numberOfPlayers: number, randomSeed: string) {
  return createRelayAssignment(numberOfPlayers, randomSeed, {
    seedSuffix: ':pictionary-relay',
    minPlayers: PICTIONARY_MIN_PLAYERS,
    maxPlayers: PICTIONARY_MAX_PLAYERS,
    rangeError: `Pictionary requires ${PICTIONARY_MIN_PLAYERS} to ${PICTIONARY_MAX_PLAYERS} players`,
  });
}

/**
 * Seconds a step's answering phase lasts: drawing steps use the
 * drawing duration, text steps the guess duration.
 */
export function getPictionaryAnswerDurationSeconds(
  state: Pick<PictionaryState, 'config'>,
  stepIndex: number,
): number | null {
  return getPictionaryExpectedKind(stepIndex) === 'drawing'
    ? state.config.drawingDurationSeconds
    : state.config.guessDurationSeconds;
}

function createPictionaryTaskHooks(
  state: PictionaryState,
): RelayTaskHooks<PictionaryEntry, PictionaryEntry, PictionaryEvent, PictionaryEffect> {
  return {
    stripPreviousEntry: (entry) => entry,
    validateText: isValidPictionaryText,
    expectedKind: (stepIndex) => getPictionaryExpectedKind(stepIndex),
    submissionRejection: (seat) =>
      state.reservations.some((reservation) => reservation.authorSeat === seat)
        ? REASON_PICTIONARY_TASK_ALREADY_SUBMITTED
        : null,
    buildEntry: (submission, seat, context, task) =>
      submission.kind === 'text'
        ? {
            kind: 'text',
            id: `pictionary-entry:${context.commandId}`,
            authorSeat: seat,
            text: submission.text,
            submittedAt: context.nowMs,
          }
        : {
            kind: 'missed',
            id: `pictionary-missed:${context.commandId}:${task.chainId}`,
            authorSeat: seat,
            expectedKind: getPictionaryExpectedKind(task.stepIndex),
          },
    onRoundCompleted: (kit, state, appended, nowMs) => ({
      events: [],
      effects: [
        kit.completionEffect(
          buildPictionaryCompletionPayload(
            state,
            appended.map((item) => item.entry),
            nowMs,
          ),
        ),
      ],
    }),
  };
}

type TaskCommand = Extract<
  PictionaryCommand,
  {
    readonly type:
      | 'pictionary.task.ready.set'
      | 'pictionary.text.submit'
      | 'pictionary.task.empty.submit';
  }
>;

/** Decides authenticated readiness or a final submission through the shared machine. */
export function decidePictionaryTask(
  state: PictionaryState,
  command: TaskCommand,
  context: CommandContext,
): PictionaryDecision {
  const identity = {
    roundId: command.roundId,
    stepIndex: command.stepIndex,
    chainId: command.chainId,
  };
  const relayCommand: RelayTaskCommand =
    command.type === 'pictionary.task.ready.set'
      ? { ...identity, kind: 'ready', isReady: command.isReady }
      : command.type === 'pictionary.text.submit'
        ? { ...identity, kind: 'text', text: command.text }
        : { ...identity, kind: 'empty' };
  return decideRelayTask(
    createPictionaryRelayKit(state),
    toPictionaryRelaySlice(state),
    relayCommand,
    context,
    createPictionaryTaskHooks(state),
  );
}

const PICTIONARY_GALLERY_CONTROLS: Readonly<Record<string, RelayGalleryControl>> = {
  'pictionary.gallery.pause': 'pause',
  'pictionary.gallery.resume': 'resume',
  'pictionary.gallery.advance': 'advance',
  'pictionary.gallery.rewind': 'rewind',
  'pictionary.gallery.finish': 'finish',
};

/** Applies host playback controls after the caller has checked host and revision. */
export function controlPictionaryGallery(
  state: PictionaryState,
  type: string,
  nowMs: number,
): PictionaryDecision {
  const control = PICTIONARY_GALLERY_CONTROLS[type];
  if (control === undefined) return reject(REASON_PICTIONARY_PHASE_INVALID);
  return controlRelayGallery(
    createPictionaryRelayKit(state),
    toPictionaryRelaySlice(state),
    control,
    nowMs,
  );
}

/**
 * Pictionary transition continuation: the last step's expiry enters
 * the gallery — display only, the round already settled when its
 * final entry landed (see header); earlier steps open the next
 * answering step.
 */
const PICTIONARY_EXPIRE_HOOKS: RelayExpireHooks<
  PictionaryEntry,
  PictionaryEvent,
  PictionaryEffect,
  PictionaryRelaySlice
> = {
  resolveTransition: (kit, state, nowMs) => {
    const nextStepIndex = state.stepIndex + 1;
    if (state.roundId === null) throw new Error('[FAIL-FAST] Transition requires a round');
    if (nextStepIndex !== getPictionaryRelayStepCount(state.config.numberOfPlayers)) {
      return kit.commit([
        kit.phaseChanged(
          'answering',
          relayDeadline(nowMs, getPictionaryAnswerDurationSeconds(state, nextStepIndex)),
          nextStepIndex,
          null,
        ),
      ]);
    }
    const isPlaying = state.config.galleryItemDurationSeconds !== null;
    return kit.commit([
      kit.phaseChanged(
        'gallery',
        relayDeadline(nowMs, state.config.galleryItemDurationSeconds),
        state.stepIndex,
        { position: 0, revealedPosition: 0, isPlaying, remainingMs: null },
      ),
    ]);
  },
};

/** Dispatches an already-verified phase expiry through the shared machine. */
export function expirePictionaryPhase(state: PictionaryState, nowMs: number): PictionaryDecision {
  return expireRelayPhase(
    createPictionaryRelayKit(state),
    toPictionaryRelaySlice(state),
    nowMs,
    PICTIONARY_EXPIRE_HOOKS,
  );
}
