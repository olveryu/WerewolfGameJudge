/** Undercover request boundary tests use the real strict public/internal schemas. */

import { describe, expect, it } from 'vitest';

import {
  undercoverCreateConfigSchema,
  undercoverInternalCommandSchema,
  undercoverPublicCommandSchema,
} from '../schemas';

describe('Undercover schemas', () => {
  it('validates the reset identity and completion boundary', () => {
    const command = { type: 'undercover.game.restart', roundId: 'round', wasEnded: false };
    expect(undercoverPublicCommandSchema.parse(command)).toEqual(command);
    for (const invalid of [
      { ...command, roundId: '' },
      { type: command.type, roundId: 'round' },
      { ...command, wasEnded: 'false' },
      { ...command, extra: true },
    ]) {
      expect(undercoverPublicCommandSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it('rejects obsolete resets and requires a round identity to allow repeated words', () => {
    for (const command of [
      { type: 'undercover.game.redeal', roundId: 'round' },
      { type: 'undercover.game.abort', roundId: 'round' },
      { type: 'undercover.game.returnToLobby' },
      { type: 'undercover.round.allowRepeated' },
    ]) {
      expect(undercoverPublicCommandSchema.safeParse(command).success).toBe(false);
    }
    const command = { type: 'undercover.round.allowRepeated', roundId: 'round' };
    expect(undercoverPublicCommandSchema.parse(command)).toEqual(command);
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
    const command = { type: 'undercover.bots.markAllBotsViewed', roundId: 'round' };
    expect(undercoverPublicCommandSchema.parse(command)).toEqual(command);
    expect(undercoverPublicCommandSchema.safeParse({ type: command.type }).success).toBe(false);
    expect(undercoverPublicCommandSchema.safeParse({ ...command, seats: [0] }).success).toBe(false);
  });
});
