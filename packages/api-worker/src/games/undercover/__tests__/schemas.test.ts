/** Undercover request boundary tests use the real strict public/internal schemas. */

import { describe, expect, it } from 'vitest';

import {
  undercoverCreateConfigSchema,
  undercoverInternalCommandSchema,
  undercoverPublicCommandSchema,
} from '../schemas';

describe('Undercover schemas', () => {
  it('requires an explicit round identity for restart and rejects caller-owned random choices', () => {
    const command = { type: 'undercover.round.restart', roundId: 'round' };
    expect(undercoverPublicCommandSchema.parse(command)).toEqual(command);
    expect(undercoverPublicCommandSchema.parse({ ...command, roundId: null })).toEqual({
      ...command,
      roundId: null,
    });
    expect(undercoverPublicCommandSchema.safeParse({ type: command.type }).success).toBe(false);
    expect(
      undercoverPublicCommandSchema.safeParse({ ...command, speakingStartSeat: 0 }).success,
    ).toBe(false);
  });

  it('accepts configuration and rejects invalid blank mode', () => {
    const config = { numberOfPlayers: 8, hasBlank: true, category: 'all' };
    expect(undercoverCreateConfigSchema.parse(config)).toEqual(config);
    expect(undercoverCreateConfigSchema.safeParse({ ...config, numberOfPlayers: 4 }).success).toBe(
      false,
    );
  });

  it('keeps internal word completion out of the public API', () => {
    const command = {
      type: 'undercover.round.complete',
      roundId: 'round',
      wordPair: { id: 'pair', wordA: 'Milk', wordB: 'Soy milk', category: 'food' },
    };
    expect(undercoverInternalCommandSchema.parse(command)).toEqual(command);
    expect(undercoverPublicCommandSchema.safeParse(command).success).toBe(false);
  });

  it('rejects caller identity injection and uncorrelated elimination', () => {
    const command = { type: 'undercover.round.reveal', roundId: 'round', seat: 2 };
    expect(undercoverPublicCommandSchema.parse(command)).toEqual(command);
    expect(undercoverPublicCommandSchema.safeParse({ ...command, userId: 'host' }).success).toBe(
      false,
    );
    expect(undercoverPublicCommandSchema.safeParse({ type: command.type, seat: 2 }).success).toBe(
      false,
    );
  });

  it('accepts bulk bot confirmation only with a round ID and no caller-supplied seats', () => {
    const command = { type: 'undercover.round.markAllBotsViewed', roundId: 'round' };
    expect(undercoverPublicCommandSchema.parse(command)).toEqual(command);
    expect(undercoverPublicCommandSchema.safeParse({ type: command.type }).success).toBe(false);
    expect(undercoverPublicCommandSchema.safeParse({ ...command, seats: [0] }).success).toBe(false);
  });
});
