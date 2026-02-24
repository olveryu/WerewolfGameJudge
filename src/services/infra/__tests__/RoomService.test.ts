import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameState } from '@werewolf/game-engine/protocol/types';

// ─────────────────────────────────────────────────────────────────────────────
// Mock setup — must be before imports
// ─────────────────────────────────────────────────────────────────────────────

// Chainable query builder mock that mimics Supabase's fluent API
function createQueryBuilder(resolveWith: { data?: unknown; error?: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const terminal = jest.fn().mockResolvedValue(resolveWith);

  // Every chainable method returns the same builder
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'single', 'maybeSingle']) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  // Override terminal methods (single / maybeSingle / insert / delete act as terminal)
  builder.single = terminal;
  builder.maybeSingle = terminal;
  // insert & delete without .single() resolve directly
  builder.insert = jest.fn().mockResolvedValue(resolveWith);
  builder.delete = jest.fn().mockReturnValue(builder);

  return builder;
}

let mockFrom: jest.Mock;
let mockConfigured = true;

// Use relative path (matches AuthService.test.ts pattern) —
// @/ alias gets resolved differently depending on babel/jest config
jest.mock('../supabaseClient', () => ({
  get supabase() {
    return mockConfigured ? { from: mockFrom } : null;
  },
  isSupabaseConfigured: () => mockConfigured,
}));

jest.mock('../../../utils/roomCode', () => ({
  generateRoomCode: jest.fn(() => '5555'),
}));

import { RoomService } from '@/services/infra/RoomService';
import { generateRoomCode } from '@/utils/roomCode';

// Type-assert so we can call .mockReturnValue on the mocked function
const mockGenerateRoomCode = generateRoomCode as jest.Mock;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFakeState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomCode: '0000',
    hostUid: 'test-host',
    status: GameStatus.Ongoing,
    templateRoles: [],
    players: {},
    currentStepIndex: 0,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    ...overrides,
  } as GameState;
}

/** Create a mock `from()` that returns a chainable query builder for specific tables */
function setupMockFrom(tableHandlers: Record<string, ReturnType<typeof createQueryBuilder>>) {
  mockFrom = jest.fn((table: string) => {
    const handler = tableHandlers[table];
    if (!handler) throw new Error(`Unexpected table: ${table}`);
    return handler;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('RoomService', () => {
  let service: RoomService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigured = true;
    service = new RoomService();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unconfigured state
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Unconfigured state', () => {
    beforeEach(() => {
      mockConfigured = false;
    });

    it('createRoom throws when supabase is not configured', async () => {
      await expect(service.createRoom('host-1')).rejects.toThrow('服务未配置');
    });

    it('getRoom throws when supabase is not configured', async () => {
      await expect(service.getRoom('1234')).rejects.toThrow('服务未配置');
    });

    it('deleteRoom throws when supabase is not configured', async () => {
      await expect(service.deleteRoom('1234')).rejects.toThrow('服务未配置');
    });

    it('upsertGameState throws when supabase is not configured', async () => {
      await expect(service.upsertGameState('1234', makeFakeState(), 1)).rejects.toThrow(
        '服务未配置',
      );
    });

    it('getGameState throws when supabase is not configured', async () => {
      await expect(service.getGameState('1234')).rejects.toThrow('服务未配置');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createRoom
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createRoom', () => {
    it('creates room with initial room number on first attempt', async () => {
      const builder = createQueryBuilder({ error: null });
      setupMockFrom({ rooms: builder });

      const result = await service.createRoom('host-1', '1234');

      expect(mockFrom).toHaveBeenCalledWith('rooms');
      expect(builder.insert).toHaveBeenCalledWith({ code: '1234', host_id: 'host-1' });
      expect(result.roomNumber).toBe('1234');
      expect(result.hostUid).toBe('host-1');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('creates room with generated code when no initial number', async () => {
      const builder = createQueryBuilder({ error: null });
      setupMockFrom({ rooms: builder });
      mockGenerateRoomCode.mockReturnValue('7777');

      const result = await service.createRoom('host-1');

      // First attempt uses generateRoomCode since no initialRoomNumber
      expect(generateRoomCode).toHaveBeenCalled();
      expect(builder.insert).toHaveBeenCalledWith({ code: '7777', host_id: 'host-1' });
      expect(result.roomNumber).toBe('7777');
    });

    it('retries with new code on unique constraint violation (23505)', async () => {
      let attempt = 0;
      mockFrom = jest.fn(() => ({
        insert: jest.fn().mockImplementation(() => {
          attempt++;
          if (attempt === 1) {
            return Promise.resolve({
              error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            });
          }
          return Promise.resolve({ error: null });
        }),
      }));

      mockGenerateRoomCode.mockReturnValue('8888');

      const result = await service.createRoom('host-1', '1234');

      // First attempt: '1234' (initial), second attempt: '8888' (generated)
      expect(attempt).toBe(2);
      expect(result.roomNumber).toBe('8888');
    });

    it('retries on "duplicate" error message', async () => {
      let attempt = 0;
      mockFrom = jest.fn(() => ({
        insert: jest.fn().mockImplementation(() => {
          attempt++;
          if (attempt === 1) {
            return Promise.resolve({
              error: { code: 'OTHER', message: 'duplicate entry found' },
            });
          }
          return Promise.resolve({ error: null });
        }),
      }));

      mockGenerateRoomCode.mockReturnValue('6666');
      const result = await service.createRoom('host-1', '1234');

      expect(attempt).toBe(2);
      expect(result.roomNumber).toBe('6666');
    });

    it('throws after maxRetries exhausted', async () => {
      mockFrom = jest.fn(() => ({
        insert: jest.fn().mockResolvedValue({
          error: { code: '23505', message: 'duplicate key' },
        }),
      }));

      mockGenerateRoomCode.mockReturnValue('9999');

      await expect(service.createRoom('host-1', '1234', 3)).rejects.toThrow(
        'Failed to create room',
      );
    });

    it('throws immediately on non-conflict error at last retry', async () => {
      mockFrom = jest.fn(() => ({
        insert: jest.fn().mockResolvedValue({
          error: { code: 'PGRST116', message: 'network error' },
        }),
      }));

      await expect(service.createRoom('host-1', '1234', 1)).rejects.toThrow(
        'Failed to create room: network error',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getRoom
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getRoom', () => {
    it('returns RoomRecord when room exists', async () => {
      const dbRow = {
        id: 'uuid-1',
        code: '1234',
        host_id: 'host-1',
        created_at: '2026-02-13T10:00:00Z',
        updated_at: '2026-02-13T10:00:00Z',
      };
      const builder = createQueryBuilder({ data: dbRow, error: null });
      setupMockFrom({ rooms: builder });

      const result = await service.getRoom('1234');

      expect(result).not.toBeNull();
      expect(result!.roomNumber).toBe('1234');
      expect(result!.hostUid).toBe('host-1');
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.createdAt.toISOString()).toBe('2026-02-13T10:00:00.000Z');
    });

    it('returns null when room does not exist (error)', async () => {
      const builder = createQueryBuilder({
        data: null,
        error: {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
        },
      });
      setupMockFrom({ rooms: builder });

      const result = await service.getRoom('9999');

      expect(result).toBeNull();
    });

    it('returns null when data is null without error', async () => {
      const builder = createQueryBuilder({ data: null, error: null });
      setupMockFrom({ rooms: builder });

      const result = await service.getRoom('9999');

      expect(result).toBeNull();
    });

    it('passes correct query params', async () => {
      const builder = createQueryBuilder({ data: null, error: null });
      setupMockFrom({ rooms: builder });

      await service.getRoom('4567');

      expect(builder.select).toHaveBeenCalledWith('id, code, host_id, created_at');
      expect(builder.eq).toHaveBeenCalledWith('code', '4567');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // roomExists
  // ═══════════════════════════════════════════════════════════════════════════

  describe('roomExists', () => {
    it('returns true when room exists', async () => {
      const dbRow = {
        id: 'uuid-1',
        code: '1234',
        host_id: 'host-1',
        created_at: '2026-02-13T10:00:00Z',
        updated_at: '2026-02-13T10:00:00Z',
      };
      const builder = createQueryBuilder({ data: dbRow, error: null });
      setupMockFrom({ rooms: builder });

      expect(await service.roomExists('1234')).toBe(true);
    });

    it('returns false when room does not exist', async () => {
      const builder = createQueryBuilder({ data: null, error: null });
      setupMockFrom({ rooms: builder });

      expect(await service.roomExists('9999')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // deleteRoom
  // ═══════════════════════════════════════════════════════════════════════════

  describe('deleteRoom', () => {
    it('calls delete with correct room code', async () => {
      const deleteMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      mockFrom = jest.fn(() => ({ delete: deleteMock }));

      await service.deleteRoom('1234');

      expect(mockFrom).toHaveBeenCalledWith('rooms');
      expect(deleteMock).toHaveBeenCalled();
    });

    it('does not throw on delete error (logs only)', async () => {
      const deleteMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: { message: 'permission denied' } }),
      });
      mockFrom = jest.fn(() => ({ delete: deleteMock }));

      // Should not throw
      await expect(service.deleteRoom('1234')).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // upsertGameState
  // ═══════════════════════════════════════════════════════════════════════════

  describe('upsertGameState', () => {
    it('updates room with game_state and state_revision', async () => {
      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      mockFrom = jest.fn(() => ({ update: updateMock }));

      const state = makeFakeState({ status: GameStatus.Ongoing });
      await service.upsertGameState('1234', state, 5);

      expect(mockFrom).toHaveBeenCalledWith('rooms');
      expect(updateMock).toHaveBeenCalledWith({
        game_state: state,
        state_revision: 5,
      });
    });

    it('passes correct room code to eq filter', async () => {
      const eqMock = jest.fn().mockResolvedValue({ error: null });
      const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
      mockFrom = jest.fn(() => ({ update: updateMock }));

      await service.upsertGameState('4567', makeFakeState(), 1);

      expect(eqMock).toHaveBeenCalledWith('code', '4567');
    });

    it('does not throw on update error (fire-and-forget)', async () => {
      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: { message: 'connection lost' } }),
      });
      mockFrom = jest.fn(() => ({ update: updateMock }));

      // Should not throw — failure only logs
      await expect(service.upsertGameState('1234', makeFakeState(), 1)).resolves.toBeUndefined();
    });

    it('handles revision 0 correctly', async () => {
      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      mockFrom = jest.fn(() => ({ update: updateMock }));

      await service.upsertGameState('1234', makeFakeState(), 0);

      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ state_revision: 0 }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getGameState
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getGameState', () => {
    it('returns state and revision when data exists', async () => {
      const state = makeFakeState({ status: GameStatus.Ongoing });
      const builder = createQueryBuilder({
        data: { game_state: state, state_revision: 3 },
        error: null,
      });
      setupMockFrom({ rooms: builder });

      const result = await service.getGameState('1234');

      expect(result).not.toBeNull();
      expect(result!.state).toEqual(state);
      expect(result!.revision).toBe(3);
    });

    it('returns null when room not found (error)', async () => {
      const builder = createQueryBuilder({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });
      setupMockFrom({ rooms: builder });

      const result = await service.getGameState('9999');

      expect(result).toBeNull();
    });

    it('returns null when game_state is null (room exists but no state yet)', async () => {
      const builder = createQueryBuilder({
        data: { game_state: null, state_revision: null },
        error: null,
      });
      setupMockFrom({ rooms: builder });

      const result = await service.getGameState('1234');

      expect(result).toBeNull();
    });

    it('passes correct query params', async () => {
      const builder = createQueryBuilder({ data: null, error: null });
      setupMockFrom({ rooms: builder });

      await service.getGameState('4567');

      expect(builder.select).toHaveBeenCalledWith('game_state, state_revision');
      expect(builder.eq).toHaveBeenCalledWith('code', '4567');
    });

    it('handles revision 0 correctly (does not treat as falsy)', async () => {
      const state = makeFakeState({ status: GameStatus.Seated });
      const builder = createQueryBuilder({
        data: { game_state: state, state_revision: 0 },
        error: null,
      });
      setupMockFrom({ rooms: builder });

      const result = await service.getGameState('1234');

      // BUG CHECK: revision 0 should NOT be treated as null/falsy
      expect(result).not.toBeNull();
      expect(result!.revision).toBe(0);
      expect(result!.state).toEqual(state);
    });

    it('returns null when data itself is null', async () => {
      const builder = createQueryBuilder({
        data: null,
        error: null,
      });
      setupMockFrom({ rooms: builder });

      const result = await service.getGameState('1234');

      expect(result).toBeNull();
    });

    it('handles empty object game_state (truthy but invalid)', async () => {
      const builder = createQueryBuilder({
        data: { game_state: {}, state_revision: 1 },
        error: null,
      });
      setupMockFrom({ rooms: builder });

      const result = await service.getGameState('1234');

      // Empty object is truthy — getGameState returns it (validation is caller's job)
      expect(result).not.toBeNull();
      expect(result!.state).toEqual({});
      expect(result!.revision).toBe(1);
    });
  });
});
