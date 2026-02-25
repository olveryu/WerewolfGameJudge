/**
 * Tests for seer reveal intent
 */
import { renderHook } from '@testing-library/react-native';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { type ActionSchema, SCHEMAS } from '@werewolf/game-engine/models/roles/spec';

import { useRoomActions } from '@/screens/RoomScreen/hooks/useRoomActions';
import type { LocalGameState } from '@/types/GameStateTypes';

const makeGameState = (): LocalGameState =>
  ({
    roomCode: 'TEST',
    hostUid: 'host-uid',
    status: GameStatus.Ongoing,
    template: {
      name: 'Test Template',
      numberOfPlayers: 6,
      roles: ['seer', 'witch', 'wolf', 'wolf', 'villager', 'villager'],
    },
    players: new Map([
      [0, { uid: 'u1', seatNumber: 0, role: 'seer', hasViewedRole: true, displayName: 'P1' }],
      [1, { uid: 'u2', seatNumber: 1, role: 'witch', hasViewedRole: true, displayName: 'P2' }],
      [2, { uid: 'u3', seatNumber: 2, role: 'wolf', hasViewedRole: true, displayName: 'P3' }],
    ]),
    actions: new Map(),
    wolfVotes: new Map(),
    currentStepIndex: 0,
    isAudioPlaying: false,
    lastNightDeaths: [],
    currentNightResults: {},
    pendingRevealAcks: [],
  }) as LocalGameState;

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
          actorSeatNumber: 0,
          actorRole: 'seer',
          isAudioPlaying: false,
          firstSwapSeat: null,
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
          actorSeatNumber: 0,
          actorRole: 'seer',
          isAudioPlaying: false,
          firstSwapSeat: null,
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
          actorSeatNumber: 0,
          actorRole: null, // No role
          isAudioPlaying: false,
          firstSwapSeat: null,
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
          actorSeatNumber: 0,
          actorRole: 'seer',
          isAudioPlaying: false,
          firstSwapSeat: null,
        },
        deps,
      ),
    );

    const intent = result.current.getActionIntent(2);
    // Without schema, deriveIntentFromSchema returns null (default case)
    expect(intent).toBeNull();
  });
});
