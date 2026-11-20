/** Pictionary Worker boundary tests: strict public-command schema. */

import { describe, expect, it } from 'vitest';

import { pictionaryPublicCommandSchema } from '../schemas';

describe('Pictionary public command schema', () => {
  it('requires round identity and revision for restart', () => {
    const command = { type: 'pictionary.game.restart', roundId: 'round', phaseRevision: 3 };
    expect(pictionaryPublicCommandSchema.parse(command)).toEqual(command);
    expect(pictionaryPublicCommandSchema.safeParse({ type: command.type }).success).toBe(false);
    expect(pictionaryPublicCommandSchema.safeParse({ ...command, extra: true }).success).toBe(
      false,
    );
  });

  it('rejects obsolete reset and direct next-round commands', () => {
    for (const type of [
      'pictionary.game.abort',
      'pictionary.game.returnToLobby',
      'pictionary.game.next',
    ]) {
      expect(
        pictionaryPublicCommandSchema.safeParse({ type, roundId: 'round', phaseRevision: 3 })
          .success,
      ).toBe(false);
    }
  });

  it('accepts the phase retrySettle command with exact payload', () => {
    const command = { type: 'pictionary.phase.retrySettle', roundId: null, phaseRevision: 0 };
    expect(pictionaryPublicCommandSchema.parse(command)).toEqual(command);
  });
});
