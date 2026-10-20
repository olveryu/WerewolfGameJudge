/**
 * Bot Takeover Resolution — drawguess scenario (bot wave PR-2).
 *
 * Runs the shared acting-seat propositions against the real
 * drawguess engine. The probe command is drawguess.guess.submit in
 * the drawing phase, whose commit event names the guessing seat.
 * The guesser gate sits directly behind the shared resolution: a
 * probe that resolves onto the drawer seat rejects with the game's
 * own not-guesser reason, which the driver reports as resolved to
 * that seat (only a successful resolution can reach that gate).
 * Layout: host at seat 0, a human guest at seat 1, bots at seats 2-3.
 */

import type { CommandContext } from '../../../platform/engine';
import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { REASON_NOT_SEATED, REASON_USER_ACTOR_REQUIRED } from '../../../platform/protocol/reasons';
import {
  type ActingSeatProbe,
  type ActingSeatProbeActor,
  describeBotTakeoverResolution,
} from '../../../platform/room/__tests__/actingSeatScenarios';
import type { DrawGuessCommand, DrawGuessPublicCommand } from '../commands/types';
import { DRAWGUESS_REASONS } from '../domain/decision';
import { drawGuessEngine } from '../engine';
import { parseDrawGuessState } from '../state/parseState';
import { DEFAULT_DRAWGUESS_CONFIG, type DrawGuessState } from '../state/types';

const CHOICES = [
  { word: '大熊猫', pinyinInitials: 'd x m' },
  { word: '火锅', pinyinInitials: 'h g' },
  { word: '风筝', pinyinInitials: 'f z' },
] as const;

function guessingState(): DrawGuessState {
  const session = createEngineSession(drawGuessEngine, {
    config: { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
    parse: parseDrawGuessState,
  });
  const send = (
    command: DrawGuessPublicCommand,
    userId = 'host',
    controlledSeat: number | null = null,
  ) => session.send(command, userId, controlledSeat);
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } }, 'host');
  send({ type: 'room.seat.take', seat: 1, profile: { displayName: 'Guest' } }, 'guest');
  send({ type: 'room.seat.fillBots' }, 'host');
  send({ type: 'drawguess.game.begin' });
  session.sendAs(
    { type: 'drawguess.words.dealt', turnIndex: 0, choices: CHOICES },
    session.systemContext('effect:1'),
  );
  const phase = session.state.phase;
  if (phase.kind !== 'wordSelect') throw new Error('Expected wordSelect phase');
  const drawerSeat = phase.drawerSeat;
  const revision = {
    phaseRevision: session.state.phaseRevision,
    turnIndex: session.state.turnIndex,
  };
  // The drawer picks a word: a human drawer acts alone, a bot drawer
  // is driven by the host through takeover.
  if (drawerSeat === 0 || drawerSeat === 1) {
    send(
      { type: 'drawguess.word.choose', word: CHOICES[0].word, ...revision },
      drawerSeat === 0 ? 'host' : 'guest',
    );
  } else {
    send({ type: 'drawguess.word.choose', word: CHOICES[0].word, ...revision }, 'host', drawerSeat);
  }
  // Guesses are submitted while the phase is 'drawing' (the drawer
  // draws and the other seats guess in the same window).
  if (session.state.phase.kind !== 'drawing') throw new Error('Expected drawing phase');
  return session.state;
}

describeBotTakeoverResolution({
  game: 'drawguess',
  hostUserId: 'host',
  hostSeat: 0,
  guestUserId: 'guest',
  guestSeat: 1,
  botSeat: 2,
  systemActorReason: REASON_USER_ACTOR_REQUIRED,
  unseatedReason: REASON_NOT_SEATED,
  makeSession() {
    const state = guessingState();
    const ownSeat = (userId: string): number => (userId === 'host' ? 0 : 1);
    return {
      probe(actor: ActingSeatProbeActor): ActingSeatProbe {
        const context: CommandContext =
          actor.kind === 'system'
            ? {
                actor: { kind: 'system', effectId: 'probe' },
                controlledSeat: null,
                commandId: 'probe',
                randomSeed: 'drawguess-takeover',
                nowMs: 5000,
              }
            : {
                actor: { kind: 'user', userId: actor.userId },
                controlledSeat: actor.controlledSeat,
                commandId: 'probe',
                randomSeed: 'drawguess-takeover',
                nowMs: 5000,
              };
        const command: DrawGuessCommand = {
          type: 'drawguess.guess.submit',
          text: '西瓜',
          phaseRevision: state.phaseRevision,
          turnIndex: state.turnIndex,
        };
        const decision = drawGuessEngine.decide(state, command, context);
        if (decision.kind === 'reject') {
          if (decision.reason === DRAWGUESS_REASONS.notGuesser && actor.kind === 'user') {
            return {
              kind: 'resolved',
              seat: actor.controlledSeat ?? ownSeat(actor.userId),
            };
          }
          return { kind: 'rejected', reason: decision.reason };
        }
        const event = decision.events.find(
          (entry): entry is Extract<typeof entry, { type: 'drawguess.guess.submitted' }> =>
            entry.type === 'drawguess.guess.submitted',
        );
        if (event === undefined) throw new Error('Guess commit carried no submitted event');
        return { kind: 'resolved', seat: event.seat };
      },
    };
  },
});
