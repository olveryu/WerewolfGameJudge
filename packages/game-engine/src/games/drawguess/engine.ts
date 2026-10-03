/** Authoritative DrawGuess engine; delegates persistence and delivery to the platform. */

import {
  type CommandContext,
  type CommonGameLifecycle,
  type CreateGameContext,
  type GameEngineDefinition,
  reject,
  resolveUncontrolledUserActorId,
} from '../../platform/engine';
import { createSeededRng, randomPick } from '../../platform/random';
import type {
  DrawGuessCommand,
  DrawGuessInternalCommand,
  DrawGuessPublicCommand,
} from './commands/types';
import {
  commitDrawGuess,
  DRAWGUESS_REASONS,
  type DrawGuessDecision,
  type DrawGuessEffect,
  type DrawGuessEvent,
  requireDrawGuessHost,
  resolveDrawGuessGuesser,
  resolveDrawGuessSeat,
} from './domain/decision';
import { evolveDrawGuessState } from './domain/evolve';
import {
  computeDrawerScore,
  computeGuesserScore,
  createRevealOrder,
  isCorrectGuess,
  isValidGuessText,
} from './domain/rules';
import { decideDrawGuessRoom } from './domain/seating';
import { normalizeDrawGuessState } from './state/normalize';
import {
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_GAME_TYPE,
  DRAWGUESS_MAX_STROKES_PER_TURN,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_STATE_VERSION,
  DRAWGUESS_WORD_SELECT_SECONDS,
  type DrawGuessConfig,
  type DrawGuessState,
  type DrawGuessStroke,
  type DrawGuessWordChoice,
  getDrawGuessOccupiedSeatCount,
  getDrawGuessTotalTurns,
  isValidDrawGuessConfig,
} from './state/types';

function createInitialState(config: DrawGuessConfig, context: CreateGameContext): DrawGuessState {
  if (!isValidDrawGuessConfig(config)) throw new Error(DRAWGUESS_REASONS.config);
  return normalizeDrawGuessState({
    gameType: DRAWGUESS_GAME_TYPE,
    stateVersion: DRAWGUESS_STATE_VERSION,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    phase: { kind: 'lobby' },
    phaseRevision: 0,
    config: { ...config },
    realSeats: {},
    excludedBotSeats: [],
    drawerQueue: [],
    turnIndex: 0,
    scores: {},
    usedWords: [],
    gameSequence: 0,
  });
}

function dealEffect(turnIndex: number): DrawGuessEffect {
  return { type: 'drawguess.words.deal', payload: { turnIndex } };
}

/** 对局结束时发结算 effect，Worker 据此发 XP/抽卡奖励。 */
function completionEffect(state: DrawGuessState, context: CommandContext): DrawGuessEffect {
  return {
    type: 'drawguess.game.completed',
    payload: {
      roundId: `drawguess:game:${state.gameSequence}`,
      completedAt: context.nowMs,
      participantUserIds: Object.values(state.realSeats)
        .filter((seat) => seat !== undefined)
        .map((seat) => seat.userId),
    },
  };
}

/** Host starts the game (or restarts from ended): build the drawer queue and deal words. */
function startGame(state: DrawGuessState, context: CommandContext): DrawGuessDecision {
  const hostRejection = requireDrawGuessHost(state, context);
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'lobby' && state.phase.kind !== 'ended')
    return reject(DRAWGUESS_REASONS.phase);
  if (getDrawGuessOccupiedSeatCount(state) !== state.config.numberOfPlayers)
    return reject(DRAWGUESS_REASONS.full);
  const drawerQueue = Array.from({ length: state.config.numberOfPlayers }, (_, seat) => seat);
  const drawerSeat = drawerQueue[0];
  if (drawerSeat === undefined) return reject(DRAWGUESS_REASONS.config);
  return commitDrawGuess(
    [{ type: 'drawguess.game.started', drawerQueue, drawerSeat }],
    [dealEffect(0)],
  );
}

function checkRevision(
  state: DrawGuessState,
  phaseRevision: number,
  turnIndex: number,
): DrawGuessDecision | null {
  if (phaseRevision !== state.phaseRevision || turnIndex !== state.turnIndex)
    return reject(DRAWGUESS_REASONS.stale);
  return null;
}

function checkDrawingDeadline(
  state: DrawGuessState,
  context: CommandContext,
): DrawGuessDecision | null {
  if (state.phase.kind !== 'drawing') return reject(DRAWGUESS_REASONS.phase);
  if (context.nowMs >= state.phase.deadlineAt) return reject(DRAWGUESS_REASONS.stale);
  return null;
}

/** Applies dealt word choices (Worker D1 selection) to the waiting wordSelect phase. */
function dealWords(
  state: DrawGuessState,
  turnIndex: number,
  choices: readonly DrawGuessWordChoice[],
  context: CommandContext,
): DrawGuessDecision {
  if (state.phase.kind !== 'wordSelect' || state.turnIndex !== turnIndex)
    return reject(DRAWGUESS_REASONS.stale);
  if (state.phase.choices.length > 0) return reject(DRAWGUESS_REASONS.wordsDealt);
  if (choices.length === 0) return reject(DRAWGUESS_REASONS.emptyChoices);
  return commitDrawGuess([
    {
      type: 'drawguess.words.dealt',
      turnIndex,
      choices: [...choices],
      deadlineAt: context.nowMs + DRAWGUESS_WORD_SELECT_SECONDS * 1000,
    },
  ]);
}

function beginDrawing(
  state: DrawGuessState,
  choice: DrawGuessWordChoice,
  context: CommandContext,
): DrawGuessDecision {
  if (state.phase.kind !== 'wordSelect') return reject(DRAWGUESS_REASONS.phase);
  const phaseStartAt = context.nowMs;
  return commitDrawGuess([
    {
      type: 'drawguess.word.chosen',
      turnIndex: state.turnIndex,
      word: choice.word,
      pinyinInitials: choice.pinyinInitials,
      revealOrder: [...createRevealOrder(choice.word.length, context.randomSeed)],
      phaseStartAt,
      deadlineAt: phaseStartAt + DRAWGUESS_DRAWING_DURATION_SECONDS * 1000,
    },
  ]);
}

/** Drawer picks one of the 3 dealt choices. */
function chooseWord(
  state: DrawGuessState,
  word: string,
  phaseRevision: number,
  turnIndex: number,
  context: CommandContext,
): DrawGuessDecision {
  const stale = checkRevision(state, phaseRevision, turnIndex);
  if (stale !== null) return stale;
  if (state.phase.kind !== 'wordSelect') return reject(DRAWGUESS_REASONS.phase);
  if (state.phase.deadlineAt !== null && context.nowMs >= state.phase.deadlineAt)
    return reject(DRAWGUESS_REASONS.stale);
  if (state.phase.choices.length === 0) return reject(DRAWGUESS_REASONS.emptyChoices);
  const resolved = resolveDrawGuessSeat(state, context);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  if (resolved.seat !== state.phase.drawerSeat) return reject(DRAWGUESS_REASONS.notDrawer);
  const choice = state.phase.choices.find((candidate) => candidate.word === word);
  if (choice === undefined) return reject(DRAWGUESS_REASONS.invalidWord);
  return beginDrawing(state, choice, context);
}

function isValidStrokeInput(stroke: DrawGuessStroke, seat: number): boolean {
  return (
    typeof stroke.id === 'string' &&
    stroke.id.length > 0 &&
    stroke.authorSeat === seat &&
    ['brush', 'eraser', 'line', 'rectangle', 'ellipse', 'fill'].includes(stroke.kind)
  );
}

function resolveDrawerCommand(
  state: DrawGuessState,
  phaseRevision: number,
  turnIndex: number,
  context: CommandContext,
): DrawGuessDecision | { readonly seat: number } {
  const stale = checkRevision(state, phaseRevision, turnIndex);
  if (stale !== null) return stale;
  const deadline = checkDrawingDeadline(state, context);
  if (deadline !== null) return deadline;
  const resolved = resolveDrawGuessSeat(state, context);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  if (state.phase.kind !== 'drawing' || resolved.seat !== state.phase.drawerSeat)
    return reject(DRAWGUESS_REASONS.notDrawer);
  return { seat: resolved.seat };
}

function addStroke(
  state: DrawGuessState,
  stroke: DrawGuessStroke,
  phaseRevision: number,
  turnIndex: number,
  context: CommandContext,
): DrawGuessDecision {
  const resolved = resolveDrawerCommand(state, phaseRevision, turnIndex, context);
  if ('kind' in resolved) return resolved;
  if (!isValidStrokeInput(stroke, resolved.seat)) return reject(DRAWGUESS_REASONS.invalidStroke);
  if (state.phase.kind !== 'drawing') return reject(DRAWGUESS_REASONS.phase);
  if (state.phase.strokes.length >= DRAWGUESS_MAX_STROKES_PER_TURN)
    return reject(DRAWGUESS_REASONS.strokeLimit);
  if (state.phase.strokes.some((existing) => existing.id === stroke.id))
    return reject(DRAWGUESS_REASONS.invalidStroke);
  return commitDrawGuess([{ type: 'drawguess.stroke.added', turnIndex, stroke }]);
}

function undoStroke(
  state: DrawGuessState,
  phaseRevision: number,
  turnIndex: number,
  context: CommandContext,
): DrawGuessDecision {
  const resolved = resolveDrawerCommand(state, phaseRevision, turnIndex, context);
  if ('kind' in resolved) return resolved;
  return commitDrawGuess([{ type: 'drawguess.stroke.undone', turnIndex }]);
}

function clearStrokes(
  state: DrawGuessState,
  phaseRevision: number,
  turnIndex: number,
  context: CommandContext,
): DrawGuessDecision {
  const resolved = resolveDrawerCommand(state, phaseRevision, turnIndex, context);
  if ('kind' in resolved) return resolved;
  return commitDrawGuess([{ type: 'drawguess.strokes.cleared', turnIndex }]);
}

function endRound(state: DrawGuessState, context: CommandContext): DrawGuessDecision {
  if (state.phase.kind !== 'drawing') return reject(DRAWGUESS_REASONS.phase);
  return commitDrawGuess([
    {
      type: 'drawguess.round.ended',
      turnIndex: state.turnIndex,
      drawerSeat: state.phase.drawerSeat,
      word: state.phase.word,
      deadlineAt: context.nowMs + DRAWGUESS_ROUND_END_SECONDS * 1000,
    },
  ]);
}

function submitGuess(
  state: DrawGuessState,
  text: string,
  phaseRevision: number,
  turnIndex: number,
  context: CommandContext,
): DrawGuessDecision {
  const stale = checkRevision(state, phaseRevision, turnIndex);
  if (stale !== null) return stale;
  const deadline = checkDrawingDeadline(state, context);
  if (deadline !== null) return deadline;
  if (state.phase.kind !== 'drawing') return reject(DRAWGUESS_REASONS.phase);
  const resolved = resolveDrawGuessGuesser(state, context, state.phase.drawerSeat);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  if (state.phase.guessedSeats.includes(resolved.seat)) return reject(DRAWGUESS_REASONS.locked);
  if (!isValidGuessText(text)) return reject(DRAWGUESS_REASONS.invalidGuess);
  // Sliding-window spam guard: at most 5 accepted guesses per seat per 10 seconds.
  // Uses the turn-scoped guessLog timestamps so no extra state or codec fields are
  // needed; rejected guesses are never logged.
  const recentAttempts = state.phase.guessLog.filter(
    (entry) => entry.seat === resolved.seat && entry.at > context.nowMs - 10000,
  ).length;
  if (recentAttempts >= 5) {
    return reject('请求太频繁，请稍后再试');
  }
  const correct = isCorrectGuess(text, state.phase.word);
  const remainingMs = Math.max(0, state.phase.deadlineAt - context.nowMs);
  const events: DrawGuessEvent[] = [
    {
      type: 'drawguess.guess.submitted',
      turnIndex,
      seat: resolved.seat,
      text,
      correct,
      at: context.nowMs,
      guesserScore: correct ? computeGuesserScore(remainingMs) : 0,
      drawerScore: correct ? computeDrawerScore(1) : 0,
    },
  ];
  if (correct) {
    const drawerSeat = state.phase.drawerSeat;
    const guessedSeats = [...state.phase.guessedSeats, resolved.seat];
    const done = Object.entries(state.realSeats).every(
      ([seat, occupant]) =>
        occupant === undefined ||
        Number(seat) === drawerSeat ||
        guessedSeats.includes(Number(seat)),
    );
    if (done) {
      events.push({
        type: 'drawguess.round.ended',
        turnIndex,
        drawerSeat,
        word: state.phase.word,
        deadlineAt: context.nowMs + DRAWGUESS_ROUND_END_SECONDS * 1000,
      });
    }
  }
  return commitDrawGuess(events);
}

function reserveDrawing(state: DrawGuessState, context: CommandContext): DrawGuessDecision {
  if (state.phase.kind !== 'roundEnd') return reject(DRAWGUESS_REASONS.phase);
  const resolved = resolveDrawGuessSeat(state, context);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  if (resolved.seat !== state.phase.drawerSeat) return reject(DRAWGUESS_REASONS.notDrawer);
  if (state.phase.reservation !== null) return reject(DRAWGUESS_REASONS.reservation);
  return commitDrawGuess([
    {
      type: 'drawguess.drawing.reserved',
      turnIndex: state.turnIndex,
      submissionId: `drawguess-submission:${context.commandId}`,
      entryId: `drawguess-entry:${context.commandId}`,
      authorSeat: resolved.seat,
      reservedAt: context.nowMs,
    },
  ]);
}

function commitDrawing(
  state: DrawGuessState,
  turnIndex: number,
  submissionId: string,
  objectKey: string,
  byteLength: number,
  sha256: string,
): DrawGuessDecision {
  if (state.phase.kind !== 'roundEnd' || state.turnIndex !== turnIndex)
    return reject(DRAWGUESS_REASONS.stale);
  const reservation = state.phase.reservation;
  if (reservation === null || reservation.submissionId !== submissionId)
    return reject(DRAWGUESS_REASONS.reservation);
  return commitDrawGuess([
    {
      type: 'drawguess.drawing.committed',
      turnIndex,
      pngEntry: {
        objectKey,
        contentType: 'image/png',
        width: 1024,
        height: 768,
        byteLength,
        sha256,
      },
    },
  ]);
}

/** Drawer or host gives up the current drawing round. */
function finishRound(state: DrawGuessState, context: CommandContext): DrawGuessDecision {
  if (state.phase.kind !== 'drawing') return reject(DRAWGUESS_REASONS.phase);
  const resolved = resolveDrawGuessSeat(state, context);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  const actor = resolveUncontrolledUserActorId(context);
  const isHost = actor.kind === 'resolved' && actor.value === state.hostUserId;
  if (resolved.seat !== state.phase.drawerSeat && !isHost)
    return reject(DRAWGUESS_REASONS.notDrawer);
  return endRound(state, context);
}

/** Advances an expired phase; idempotent on phaseRevision. */
function expirePhase(
  state: DrawGuessState,
  phaseRevision: number,
  turnIndex: number,
  context: CommandContext,
): DrawGuessDecision {
  const stale = checkRevision(state, phaseRevision, turnIndex);
  if (stale !== null) return stale;
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  switch (state.phase.kind) {
    case 'wordSelect': {
      if (state.phase.deadlineAt === null || context.nowMs < state.phase.deadlineAt)
        return reject(DRAWGUESS_REASONS.deadline);
      if (state.phase.choices.length === 0) return reject(DRAWGUESS_REASONS.emptyChoices);
      const choice = randomPick(
        state.phase.choices,
        createSeededRng(`${context.randomSeed}:drawguess-autoassign`),
      );
      return beginDrawing(state, choice, context);
    }
    case 'drawing':
      if (context.nowMs < state.phase.deadlineAt) return reject(DRAWGUESS_REASONS.deadline);
      return endRound(state, context);
    case 'roundEnd': {
      if (context.nowMs < state.phase.deadlineAt) return reject(DRAWGUESS_REASONS.deadline);
      const nextTurn = state.turnIndex + 1;
      if (nextTurn >= getDrawGuessTotalTurns(state)) {
        return commitDrawGuess(
          [{ type: 'drawguess.game.ended', totalScores: { ...state.scores } }],
          [completionEffect(state, context)],
        );
      }
      const drawerSeat = state.drawerQueue[nextTurn % state.drawerQueue.length];
      if (drawerSeat === undefined) return reject(DRAWGUESS_REASONS.phase);
      return commitDrawGuess(
        [{ type: 'drawguess.turn.started', turnIndex: nextTurn, drawerSeat }],
        [dealEffect(nextTurn)],
      );
    }
    default:
      return reject(DRAWGUESS_REASONS.phase);
  }
}

function returnToLobby(state: DrawGuessState, context: CommandContext): DrawGuessDecision {
  const hostRejection = requireDrawGuessHost(state, context);
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'ended') return reject(DRAWGUESS_REASONS.phase);
  return commitDrawGuess([{ type: 'drawguess.game.returnedToLobby' }]);
}

function decidePublicCommand(
  state: DrawGuessState,
  command: DrawGuessPublicCommand,
  context: CommandContext,
): DrawGuessDecision {
  switch (command.type) {
    case 'room.seat.take':
    case 'room.seat.leave':
    case 'room.seat.kick':
    case 'room.seat.clear':
    case 'room.seat.fillBots':
    case 'room.profile.update':
    case 'drawguess.config.update':
    case 'drawguess.bots.clear':
      return decideDrawGuessRoom(state, command, context);
    case 'drawguess.round.start':
      return startGame(state, context);
    case 'drawguess.word.choose':
      return chooseWord(state, command.word, command.phaseRevision, command.turnIndex, context);
    case 'drawguess.stroke.add':
      return addStroke(state, command.stroke, command.phaseRevision, command.turnIndex, context);
    case 'drawguess.stroke.undo':
      return undoStroke(state, command.phaseRevision, command.turnIndex, context);
    case 'drawguess.stroke.clear':
      return clearStrokes(state, command.phaseRevision, command.turnIndex, context);
    case 'drawguess.guess.submit':
      return submitGuess(state, command.text, command.phaseRevision, command.turnIndex, context);
    case 'drawguess.drawing.reserve':
      return reserveDrawing(state, context);
    case 'drawguess.round.finish':
      return finishRound(state, context);
    case 'drawguess.phase.expire':
      return expirePhase(state, command.phaseRevision, command.turnIndex, context);
    case 'drawguess.game.returnToLobby':
      return returnToLobby(state, context);
    default:
      return reject(DRAWGUESS_REASONS.phase);
  }
}

function decideInternalCommand(
  state: DrawGuessState,
  command: DrawGuessInternalCommand,
  context: CommandContext,
): DrawGuessDecision {
  switch (command.type) {
    case 'drawguess.words.dealt':
      return dealWords(state, command.turnIndex, command.choices, context);
    case 'drawguess.drawing.committed':
      return commitDrawing(
        state,
        command.turnIndex,
        command.submissionId,
        command.objectKey,
        command.byteLength,
        command.sha256,
      );
    default:
      return reject(DRAWGUESS_REASONS.phase);
  }
}

/** Decides public and internal commands against the current authoritative state. */
export function decideDrawGuessCommand(
  state: DrawGuessState,
  command: DrawGuessCommand,
  context: CommandContext,
): DrawGuessDecision {
  if (isDrawGuessInternalCommand(command)) return decideInternalCommand(state, command, context);
  return decidePublicCommand(state, command, context);
}

/** Narrows worker-dispatched internal commands from the public command union. */
function isDrawGuessInternalCommand(
  command: DrawGuessCommand,
): command is DrawGuessInternalCommand {
  return command.type === 'drawguess.words.dealt' || command.type === 'drawguess.drawing.committed';
}

/** Projects domain phases into the shared room lifecycle. */
export function getDrawGuessLifecycle(state: DrawGuessState): CommonGameLifecycle {
  return state.phase.kind === 'lobby'
    ? 'setup'
    : state.phase.kind === 'ended'
      ? 'ended'
      : 'ongoing';
}

export const drawGuessEngine = {
  gameType: DRAWGUESS_GAME_TYPE,
  stateVersion: DRAWGUESS_STATE_VERSION,
  createInitialState,
  decide: decideDrawGuessCommand,
  evolve: evolveDrawGuessState,
  normalize: normalizeDrawGuessState,
  getLifecycle: getDrawGuessLifecycle,
} satisfies GameEngineDefinition<
  typeof DRAWGUESS_GAME_TYPE,
  DrawGuessState,
  DrawGuessConfig,
  DrawGuessCommand,
  DrawGuessEvent,
  DrawGuessEffect
>;
