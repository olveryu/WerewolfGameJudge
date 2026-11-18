/** Legacy audio-only steps migrate to one recognition step without skipping narration. */

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { getSecrethitlerNightParticipants } from '../domain/rules';
import { secrethitlerEngine } from '../engine';
import { migratePersistedSecrethitlerState, parseSecrethitlerState } from '../state/parseState';
import { DEFAULT_SECRETHITLER_CONFIG } from '../state/types';

describe('Secrethitler persisted state migration', () => {
  it.each([0, 1, 2, 3])(
    'migrates the v1 night segment %i without dropping pending audio',
    (step) => {
      const session = createEngineSession(secrethitlerEngine, {
        config: DEFAULT_SECRETHITLER_CONFIG,
        parse: parseSecrethitlerState,
      });
      session.send({ type: 'room.seat.fillBots' });
      session.send({ type: 'secrethitler.roles.assign' });
      for (const seat of session.state.livingSeats)
        session.send({ type: 'secrethitler.role.viewed' }, 'host', seat);
      session.send({ type: 'secrethitler.game.begin' });
      const revealAudio =
        session.state.config.numberOfPlayers <= 6 ? 'evil_reveal_5_6' : 'fascist_reveal_7_10';
      const audioKey = ['night_start', revealAudio, 'evil_close', 'night_end'][step];
      if (audioKey === undefined) throw new Error('Missing legacy audio');
      const confirmedSeats =
        step === 1 ? getSecrethitlerNightParticipants(session.state).slice(0, 1) : [];
      const legacy = {
        ...session.state,
        stateVersion: 1,
        config: { numberOfPlayers: session.state.config.numberOfPlayers },
        phase: { kind: 'night', step, confirmedSeats },
        pendingAudioEffects: [{ audioKey }],
      };
      const migrated = migratePersistedSecrethitlerState(legacy);
      expect(migrated.stateVersion).toBe(3);
      expect(migrated.config.voteMode).toBe('public');
      expect(migrated.phase).toEqual(
        step <= 1
          ? { kind: 'night', step: 1, confirmedSeats }
          : { kind: 'election', presidentSeat: legacy.nextPresidentSeat, returnToSeat: null },
      );
      expect(migrated.pendingAudioEffects.map((effect) => effect.audioKey)).toEqual(
        step === 0
          ? ['night_start', revealAudio]
          : step === 2
            ? ['evil_close', 'night_end']
            : [audioKey],
      );
      expect(migrated.isAudioPlaying).toBe(true);
      expect(migrated.audioBatchId).toBe(legacy.audioBatchId + (step === 0 || step === 2 ? 1 : 0));
      if (step === 0 || step === 2) {
        const staleAck = secrethitlerEngine.decide(
          migrated,
          { type: 'secrethitler.audio.ack', audioBatchId: legacy.audioBatchId },
          session.context(),
        );
        expect(staleAck).toMatchObject({ kind: 'commit', events: [] });
      }
      expect(migratePersistedSecrethitlerState(migrated)).toEqual(migrated);
      expect(() =>
        migratePersistedSecrethitlerState({ ...legacy, isAudioPlaying: 'invalid' }),
      ).toThrow();
      expect(() => parseSecrethitlerState(legacy)).toThrow();
      expect(() =>
        migratePersistedSecrethitlerState({ ...legacy, phase: { ...legacy.phase, step: 4 } }),
      ).toThrow();
      expect(() => migratePersistedSecrethitlerState({ ...legacy, stateVersion: 4 })).toThrow();
    },
  );

  it('accepts a current-version lobby state unchanged', () => {
    const state = secrethitlerEngine.createInitialState(
      { ...DEFAULT_SECRETHITLER_CONFIG },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    const persisted = JSON.parse(JSON.stringify(state)) as unknown;
    expect(parseSecrethitlerState(persisted)).toEqual(state);
    expect(migratePersistedSecrethitlerState(persisted)).toEqual(state);
    expect(migratePersistedSecrethitlerState({ ...state, stateVersion: 1 })).toEqual(state);
  });

  it('migrates v2 rooms to public voting without changing the match', () => {
    const state = secrethitlerEngine.createInitialState(
      { ...DEFAULT_SECRETHITLER_CONFIG, voteMode: 'secret' },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    const legacy = {
      ...state,
      stateVersion: 2,
      config: { numberOfPlayers: state.config.numberOfPlayers },
    };

    const migrated = migratePersistedSecrethitlerState(legacy);
    expect(migrated).toEqual({
      ...state,
      config: { numberOfPlayers: state.config.numberOfPlayers, voteMode: 'public' },
    });
    expect(() => parseSecrethitlerState(legacy)).toThrow();
  });

  it('rejects a state carrying another game identity', () => {
    const state = secrethitlerEngine.createInitialState(
      { ...DEFAULT_SECRETHITLER_CONFIG },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    const foreign = { ...(JSON.parse(JSON.stringify(state)) as object), gameType: 'werewolf' };
    expect(() => migratePersistedSecrethitlerState(foreign)).toThrow();
  });
});
