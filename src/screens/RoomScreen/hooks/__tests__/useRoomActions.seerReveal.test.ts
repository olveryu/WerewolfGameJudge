/**
 * Tests for seer reveal intent
 */
import { renderHook } from '@testing-library/react-native';
import { useRoomActions } from '../useRoomActions';
import { SCHEMAS, type ActionSchema } from '../../../../models/roles/spec';
import { GameStatus } from '../../../../models/Room';
import type { LocalGameState } from '../../../../services/types/GameStateTypes';

const makeGameState = (): LocalGameState =>
  ({
    roomCode: 'TEST',
    hostUid: 'host-uid',
    status: GameStatus.ongoing,
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
    currentActionerIndex: 0,
    isAudioPlaying: false,
    lastNightDeaths: [],
    currentNightResults: {},
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
          roomStatus: GameStatus.ongoing,
          currentActionRole: 'seer',
          currentSchema: schema,
          imActioner: true,
          mySeatNumber: 0,
          myRole: 'seer',
          isAudioPlaying: false,
          isBlockedByNightmare: false,
          wolfKillDisabled: false,
          anotherIndex: null,
        },
        deps,
      ),
    );

    // Seer taps seat 2 (wolf)
    const intent = result.current.getActionIntent(2);

    expect(intent).not.toBeNull();
    expect(intent?.type).toBe('reveal');
    expect(intent?.revealKind).toBe('seer');
    expect(intent?.targetIndex).toBe(2);
  });

  it('returns normal reveal intent when seer is blocked (Host validates)', () => {
    const gameState = makeGameState();
    const schema = makeSeerSchema();

    const { result } = renderHook(() =>
      useRoomActions(
        {
          gameState,
          roomStatus: GameStatus.ongoing,
          currentActionRole: 'seer',
          currentSchema: schema,
          imActioner: true,
          mySeatNumber: 0,
          myRole: 'seer',
          isAudioPlaying: false,
          isBlockedByNightmare: true, // Blocked - but UI no longer intercepts
          wolfKillDisabled: false,
          anotherIndex: null,
        },
        deps,
      ),
    );

    // Seer taps seat 2 - UI returns normal intent, Host will reject
    const intent = result.current.getActionIntent(2);

    expect(intent).not.toBeNull();
    expect(intent?.type).toBe('reveal'); // Normal intent, not 'blocked'
    expect(intent?.revealKind).toBe('seer');
    expect(intent?.targetIndex).toBe(2);
  });

  it('returns null when myRole is null', () => {
    const gameState = makeGameState();
    const schema = makeSeerSchema();

    const { result } = renderHook(() =>
      useRoomActions(
        {
          gameState,
          roomStatus: GameStatus.ongoing,
          currentActionRole: 'seer',
          currentSchema: schema,
          imActioner: true,
          mySeatNumber: 0,
          myRole: null, // No role
          isAudioPlaying: false,
          isBlockedByNightmare: false,
          wolfKillDisabled: false,
          anotherIndex: null,
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
          roomStatus: GameStatus.ongoing,
          currentActionRole: 'seer',
          currentSchema: null, // No schema!
          imActioner: true,
          mySeatNumber: 0,
          myRole: 'seer',
          isAudioPlaying: false,
          isBlockedByNightmare: false,
          wolfKillDisabled: false,
          anotherIndex: null,
        },
        deps,
      ),
    );

    const intent = result.current.getActionIntent(2);
    // Without schema, deriveIntentFromSchema returns null (default case)
    expect(intent).toBeNull();
  });
});
