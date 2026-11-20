/** DrawGuess public commands accept scoped host aborts and reject the removed give-up command. */

import { DEFAULT_DRAWGUESS_CONFIG } from '@game-judge/game-engine/games/drawguess/public';
import { describe, expect, it } from 'vitest';

import {
  drawGuessCreateConfigSchema,
  drawGuessInternalCommandSchema,
  drawGuessPublicCommandSchema,
} from '../schemas';

describe('DrawGuess create config schema', () => {
  it('accepts 20 players and rejects 21', () => {
    expect(
      drawGuessCreateConfigSchema.safeParse({ ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 20 })
        .success,
    ).toBe(true);
    expect(
      drawGuessCreateConfigSchema.safeParse({ ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 21 })
        .success,
    ).toBe(false);
  });
});

describe('DrawGuess public command schema', () => {
  it('requires a valid game identity and completion boundary for restart', () => {
    const command = {
      type: 'drawguess.game.restart',
      gameSequence: 1,
      expectedPhase: 'playing',
    };
    expect(drawGuessPublicCommandSchema.parse(command)).toEqual(command);
    for (const invalid of [
      { ...command, expectedPhase: 'lobby' },
      { ...command, expectedPhase: undefined },
      { ...command, gameSequence: -1 },
      { ...command, userId: 'host' },
    ]) {
      expect(drawGuessPublicCommandSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it('rejects obsolete reset commands', () => {
    for (const command of [
      { type: 'drawguess.game.abort', gameSequence: 1 },
      { type: 'drawguess.game.returnToLobby' },
    ]) {
      expect(drawGuessPublicCommandSchema.safeParse(command).success).toBe(false);
    }
  });

  it('accepts the phase retrySettle command', () => {
    const command = { type: 'drawguess.phase.retrySettle' };
    expect(drawGuessPublicCommandSchema.parse(command)).toEqual(command);
  });

  it.each(['flower', 'egg', 'tomato'] as const)('accepts a scoped %s reaction', (reaction) => {
    const command = { type: 'drawguess.reaction.send', phaseRevision: 2, turnIndex: 1, reaction };
    expect(drawGuessPublicCommandSchema.parse(command)).toEqual(command);
  });

  it('rejects invalid or unscoped reactions and extra fields', () => {
    const command = {
      type: 'drawguess.reaction.send',
      phaseRevision: 2,
      turnIndex: 1,
      reaction: 'flower',
    };
    for (const invalid of [
      { ...command, reaction: 'heart' },
      { ...command, reaction: undefined },
      { ...command, phaseRevision: -1 },
      { ...command, turnIndex: 0.5 },
      { ...command, turnIndex: undefined },
      { ...command, userId: 'host' },
    ]) {
      expect(drawGuessPublicCommandSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it.each([undefined, null, -1, 0.5, '1'])('rejects invalid game sequence %s', (gameSequence) => {
    expect(
      drawGuessPublicCommandSchema.safeParse({
        type: 'drawguess.game.restart',
        gameSequence,
        expectedPhase: 'playing',
      }).success,
    ).toBe(false);
  });

  it('rejects unscoped aborts, forged actor fields and the removed give-up command', () => {
    for (const command of [
      { type: 'drawguess.game.abort' },
      { type: 'drawguess.game.abort', gameSequence: 1, userId: 'host' },
      { type: 'drawguess.round.finish' },
    ])
      expect(drawGuessPublicCommandSchema.safeParse(command).success).toBe(false);
  });
});

describe('DrawGuess internal command schema', () => {
  it('accepts the payload-less settleExpired command', () => {
    const command = { type: 'drawguess.phase.settleExpired' };
    expect(drawGuessInternalCommandSchema.parse(command)).toEqual(command);
  });

  it('rejects unknown fields on settleExpired', () => {
    expect(
      drawGuessInternalCommandSchema.safeParse({
        type: 'drawguess.phase.settleExpired',
        phaseRevision: 1,
      }).success,
    ).toBe(false);
  });
});
