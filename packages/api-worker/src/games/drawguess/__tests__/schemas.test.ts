/** DrawGuess public commands accept scoped host aborts and reject the removed give-up command. */

import { describe, expect, it } from 'vitest';

import { drawGuessInternalCommandSchema, drawGuessPublicCommandSchema } from '../schemas';

describe('DrawGuess public command schema', () => {
  it('accepts a game-scoped abort', () => {
    const command = { type: 'drawguess.game.abort', gameSequence: 1 };
    expect(drawGuessPublicCommandSchema.parse(command)).toEqual(command);
  });

  it('accepts the phase retrySettle command', () => {
    const command = { type: 'drawguess.phase.retrySettle' };
    expect(drawGuessPublicCommandSchema.parse(command)).toEqual(command);
  });

  it.each([undefined, null, -1, 0.5, '1'])('rejects invalid game sequence %s', (gameSequence) => {
    expect(
      drawGuessPublicCommandSchema.safeParse({ type: 'drawguess.game.abort', gameSequence })
        .success,
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
