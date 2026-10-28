/** DrawGuess public commands accept scoped host aborts and reject the removed give-up command. */

import { describe, expect, it } from 'vitest';

import { drawGuessPublicCommandSchema } from '../schemas';

describe('DrawGuess public command schema', () => {
  it('accepts a game-scoped abort', () => {
    const command = { type: 'drawguess.game.abort', gameSequence: 1 };
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
