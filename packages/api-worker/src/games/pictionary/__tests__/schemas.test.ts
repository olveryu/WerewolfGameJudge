/** Pictionary Worker boundary tests: strict public-command schema. */

import { describe, expect, it } from 'vitest';

import { pictionaryPublicCommandSchema } from '../schemas';

describe('Pictionary public command schema', () => {
  it('accepts the phase retrySettle command with exact payload', () => {
    const command = { type: 'pictionary.phase.retrySettle', roundId: null, phaseRevision: 0 };
    expect(pictionaryPublicCommandSchema.parse(command)).toEqual(command);
  });
});
