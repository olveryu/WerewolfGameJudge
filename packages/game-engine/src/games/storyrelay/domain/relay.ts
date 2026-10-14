/**
 * Story Relay assembly over the shared relay chain machine.
 *
 * The machine (platform/room/relay) owns the flow logic; this module
 * binds it to Story Relay: its reason strings, its text rule (trimmed
 * non-empty, at most 512 chars, stored verbatim), its entry shapes,
 * its stripped previous-entry projection, and its completion point —
 * Story Relay settles in the same decision that lands the final
 * step's last entry, from the frozen participant list, rewarding
 * seats that authored text.
 */

import { buildGameCompletionPayload, type CommandContext, reject } from '../../../platform/engine';
import { createRelayAssignment } from '../../../platform/room/relay/assignment';
import { relayDeadline, type RelayExpireHooks } from '../../../platform/room/relay/clock';
import { controlRelayGallery } from '../../../platform/room/relay/gallery';
import {
  decideRelayTask,
  getRelayTaskForSeat,
  type RelayTaskHooks,
} from '../../../platform/room/relay/tasks';
import type {
  RelayEventKit,
  RelayGalleryControl,
  RelayTaskCommand,
} from '../../../platform/room/relay/types';
import type { StoryRelayCommand } from '../commands/types';
import {
  STORY_RELAY_MAX_PLAYERS,
  STORY_RELAY_MIN_PLAYERS,
  STORY_RELAY_TEXT_MAX_LENGTH,
  type StoryRelayEntry,
  type StoryRelayState,
  type StoryRelayTask,
} from '../state/types';
import {
  commitStoryRelay,
  STORY_RELAY_REASONS,
  type StoryRelayDecision,
  type StoryRelayEffect,
  type StoryRelayEvent,
} from './decision';

/** Builds a phase event; absolute deadlines are decided only by the server. */
export function storyRelayPhase(
  state: StoryRelayState,
  phase: StoryRelayState['phase'],
  deadlineAt: number | null,
  stepIndex = state.stepIndex,
  gallery: StoryRelayState['gallery'] = null,
): StoryRelayEvent {
  return { type: 'storyrelay.phase.changed', phase, stepIndex, deadlineAt, gallery };
}

/** Binds the shared machine to Story Relay's reasons, shape, events and effects. */
export function createStoryRelayRelayKit(
  state: StoryRelayState,
): RelayEventKit<StoryRelayEntry, StoryRelayEvent, StoryRelayEffect> {
  return {
    reasons: STORY_RELAY_REASONS,
    shape: {
      numberOfPlayers: state.config.numberOfPlayers,
      transitionDurationSeconds: state.config.transitionDurationSeconds,
      galleryItemDurationSeconds: state.config.galleryItemDurationSeconds,
    },
    commit: (events, effects = []) => commitStoryRelay(events, effects),
    phaseChanged: (phase, deadlineAt, stepIndex, gallery) =>
      storyRelayPhase(state, phase, deadlineAt, stepIndex, gallery),
    taskReady: (seat, isReady) => ({ type: 'storyrelay.task.ready', seat, isReady }),
    entryAppended: (chainId, entry) => ({ type: 'storyrelay.entries.appended', chainId, entry }),
    roundCompleted: (completedAt) => ({ type: 'storyrelay.round.completed', completedAt }),
    completionEffect: (payload) => ({ type: 'storyrelay.game.completed', payload }),
  };
}

/** Creates the persisted player permutation and Williams relay offsets for one round. */
export function createStoryRelayAssignment(numberOfPlayers: number, randomSeed: string) {
  return createRelayAssignment(numberOfPlayers, randomSeed, {
    seedSuffix: ':storyrelay',
    minPlayers: STORY_RELAY_MIN_PLAYERS,
    maxPlayers: STORY_RELAY_MAX_PLAYERS,
    rangeError: 'Story Relay requires 4 to 20 players',
  });
}

type StoryRelayPreviousEntry =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'empty' };

/** Strips a previous entry to the kind and text the next author may see. */
function stripStoryRelayPreviousEntry(entry: StoryRelayEntry): StoryRelayPreviousEntry {
  return entry.kind === 'text' ? { kind: 'text', text: entry.text } : { kind: entry.kind };
}

/** Resolves a seat's current task without exposing the story's earlier entries. */
export function getStoryRelayTaskForSeat(
  state: StoryRelayState,
  seat: number,
): StoryRelayTask | null {
  return getRelayTaskForSeat(
    state,
    seat,
    state.config.numberOfPlayers,
    stripStoryRelayPreviousEntry,
  );
}

const STORY_RELAY_TASK_HOOKS: RelayTaskHooks<
  StoryRelayEntry,
  StoryRelayPreviousEntry,
  StoryRelayEvent,
  StoryRelayEffect
> = {
  stripPreviousEntry: stripStoryRelayPreviousEntry,
  validateText: (text) => text.trim().length > 0 && text.length <= STORY_RELAY_TEXT_MAX_LENGTH,
  buildEntry: (submission, seat, context) =>
    submission.kind === 'text'
      ? {
          kind: 'text',
          text: submission.text,
          id: context.commandId,
          authorSeat: seat,
          submittedAt: context.nowMs,
        }
      : {
          kind: 'empty',
          id: context.commandId,
          authorSeat: seat,
          submittedAt: context.nowMs,
        },
  onRoundCompleted: (kit, state, appended, nowMs) => {
    if (state.roundId === null) throw new Error('Story Relay completion requires a round');
    const authors = new Set(
      [...state.chains.flatMap((chain) => chain.entries), ...appended.map((item) => item.entry)]
        .filter((entry) => entry.kind === 'text')
        .map((entry) => entry.authorSeat),
    );
    return {
      events: [kit.roundCompleted(nowMs)],
      effects: [
        kit.completionEffect(
          buildGameCompletionPayload({
            roundId: state.roundId,
            completedAt: nowMs,
            humans: state.participants.flatMap((participant) =>
              participant.userId !== null
                ? [{ seat: participant.seat, userId: participant.userId }]
                : [],
            ),
            includeSeat: (seat) => authors.has(seat.seat),
          }),
        ),
      ],
    };
  },
};

type TaskCommand = Extract<
  StoryRelayCommand,
  {
    readonly type:
      | 'storyrelay.task.ready.set'
      | 'storyrelay.text.submit'
      | 'storyrelay.task.empty.submit';
  }
>;

/** Decides authenticated readiness or final text, rejecting stale task identity and duplicate submissions. */
export function decideStoryRelayTask(
  state: StoryRelayState,
  command: TaskCommand,
  context: CommandContext,
): StoryRelayDecision {
  const identity = {
    roundId: command.roundId,
    stepIndex: command.stepIndex,
    chainId: command.chainId,
  };
  const relayCommand: RelayTaskCommand =
    command.type === 'storyrelay.task.ready.set'
      ? { ...identity, kind: 'ready', isReady: command.isReady }
      : command.type === 'storyrelay.text.submit'
        ? { ...identity, kind: 'text', text: command.text }
        : { ...identity, kind: 'empty' };
  return decideRelayTask(
    createStoryRelayRelayKit(state),
    state,
    relayCommand,
    context,
    STORY_RELAY_TASK_HOOKS,
  );
}

const STORY_RELAY_GALLERY_CONTROLS: Readonly<Record<string, RelayGalleryControl>> = {
  'storyrelay.gallery.pause': 'pause',
  'storyrelay.gallery.resume': 'resume',
  'storyrelay.gallery.advance': 'advance',
  'storyrelay.gallery.rewind': 'rewind',
  'storyrelay.gallery.finish': 'finish',
};

/** Applies host playback controls after the caller has checked host and revision. */
export function controlStoryRelayGallery(
  state: StoryRelayState,
  type: string,
  nowMs: number,
): StoryRelayDecision {
  const control = STORY_RELAY_GALLERY_CONTROLS[type];
  if (control === undefined) return reject(STORY_RELAY_REASONS.phase);
  return controlRelayGallery(createStoryRelayRelayKit(state), state, control, nowMs);
}

/**
 * Story Relay transition continuation: once the round has completed,
 * expiry enters the gallery; otherwise it opens the next step. The
 * completion timing itself stays in the task decision (see header).
 */
export const STORY_RELAY_EXPIRE_HOOKS: RelayExpireHooks<
  StoryRelayEntry,
  StoryRelayEvent,
  StoryRelayEffect,
  StoryRelayState
> = {
  resolveTransition: (kit, state, nowMs) => {
    if (state.completedAt !== null) {
      const isPlaying = state.config.galleryItemDurationSeconds !== null;
      return kit.commit([
        kit.phaseChanged(
          'gallery',
          relayDeadline(nowMs, state.config.galleryItemDurationSeconds),
          state.stepIndex,
          { position: 0, revealedPosition: 0, isPlaying, remainingMs: null },
        ),
      ]);
    }
    return kit.commit([
      kit.phaseChanged(
        'answering',
        relayDeadline(nowMs, state.config.writingDurationSeconds),
        state.stepIndex + 1,
        null,
      ),
    ]);
  },
};
