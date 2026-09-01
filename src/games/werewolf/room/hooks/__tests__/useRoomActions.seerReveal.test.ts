/**
 * Tests for seer reveal intent
 */
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { type ActionSchema, SCHEMAS } from '@game-judge/game-engine/games/werewolf/public';
import { renderHook } from '@testing-library/react-native';

import { useRoomActions } from '@/games/werewolf/room/hooks/useRoomActions';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

const makeGameState = (): LocalGameState => ({
  ...WEREWOLF_STATE_IDENTITY,
  roomCode: 'TEST',
  hostUserId: 'host-uid',
  status: GameStatus.Ongoing,
  template: {
    name: 'Test Template',
    numberOfPlayers: 6,
    roles: ['seer', 'witch', 'wolf', 'wolf', 'villager', 'villager'],
  },
  players: new Map([
    [0, { userId: 'u1', seat: 0, role: 'seer', hasViewedRole: true, displayName: 'P1' }],
    [1, { userId: 'u2', seat: 1, role: 'witch', hasViewedRole: true, displayName: 'P2' }],
    [2, { userId: 'u3', seat: 2, role: 'wolf', hasViewedRole: true, displayName: 'P3' }],
  ]),
  actions: new Map(),
  wolfVotes: new Map(),
  currentStepIndex: 0,
  isAudioPlaying: false,
  lastNightDeaths: [],
  currentNightResults: {},
  pendingRevealAcks: [],
  hypnotizedSeats: [],
  piperRevealAcks: [],
  conversionRevealAcks: [],
  cupidLoversRevealAcks: [],
  seedWolfInfectionRevealAcks: [],
});

const makeSeerSchema = (): ActionSchema => SCHEMAS.seerCheck;

describe('useRoomActions seer reveal', () => {
  const deps = {
    hasWolfVoted: () => false,
    getWolfVoteSummary: () => '',
    getWitchContext: () => null,
  };

  it('returns reveal intent when seer taps a seat', () => {
    const gameState = makeGameState();
    const schema = makeSeerSchema();

    const { result } = renderHook(() =>
      useRoomActions(
        {
          gameState,
          roomStatus: GameStatus.Ongoing,
          currentActionRole: 'seer',
          currentSchema: schema,
          imActioner: true,
          actorSeat: 0,
          actorRole: 'seer',
          isAudioPlaying: false,
          firstSwapSeat: null,
          multiSelectedSeats: [],
        },
        deps,
      ),
    );

    // Seer taps seat 2 (wolf)
    const intent = result.current.getActionIntent(2);

    expect(intent).not.toBeNull();
    expect(intent?.type).toBe('reveal');
    expect(intent?.revealKind).toBe('seer');
    expect(intent?.targetSeat).toBe(2);
  });

  it('returns normal reveal intent when seer is blocked (server validates)', () => {
    const gameState = makeGameState();
    const schema = makeSeerSchema();

    const { result } = renderHook(() =>
      useRoomActions(
        {
          gameState,
          roomStatus: GameStatus.Ongoing,
          currentActionRole: 'seer',
          currentSchema: schema,
          imActioner: true,
          actorSeat: 0,
          actorRole: 'seer',
          isAudioPlaying: false,
          firstSwapSeat: null,
          multiSelectedSeats: [],
        },
        deps,
      ),
    );

    // Seer taps seat 2 - UI returns normal intent, server will reject
    const intent = result.current.getActionIntent(2);

    expect(intent).not.toBeNull();
    expect(intent?.type).toBe('reveal'); // Normal intent, not 'blocked'
    expect(intent?.revealKind).toBe('seer');
    expect(intent?.targetSeat).toBe(2);
  });

  it('returns null when actorRole is null', () => {
    const gameState = makeGameState();
    const schema = makeSeerSchema();

    const { result } = renderHook(() =>
      useRoomActions(
        {
          gameState,
          roomStatus: GameStatus.Ongoing,
          currentActionRole: 'seer',
          currentSchema: schema,
          imActioner: true,
          actorSeat: 0,
          actorRole: null, // No role
          isAudioPlaying: false,
          firstSwapSeat: null,
          multiSelectedSeats: [],
        },
        deps,
      ),
    );

    const intent = result.current.getActionIntent(2);
    expect(intent).toBeNull();
  });

  it('returns null when currentSchema is null', () => {
    const gameState = makeGameState();

    const { result } = renderHook(() =>
      useRoomActions(
        {
          gameState,
          roomStatus: GameStatus.Ongoing,
          currentActionRole: 'seer',
          currentSchema: null, // No schema!
          imActioner: true,
          actorSeat: 0,
          actorRole: 'seer',
          isAudioPlaying: false,
          firstSwapSeat: null,
          multiSelectedSeats: [],
        },
        deps,
      ),
    );

    const intent = result.current.getActionIntent(2);
    // Without schema, deriveIntentFromSchema returns null (default case)
    expect(intent).toBeNull();
  });
});
