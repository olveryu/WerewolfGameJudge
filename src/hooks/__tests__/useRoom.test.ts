import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRoom } from '../useRoom';
import { Room, RoomStatus } from '../../models/Room';
import { GameTemplate } from '../../models/Template';
import { RoleName } from '../../constants/roles';

// Mock RoomService
const mockGenerateRoomNumber = jest.fn();
const mockCreateRoom = jest.fn();
const mockUpdateRoom = jest.fn();
const mockDeleteRoom = jest.fn();
const mockGetRoom = jest.fn();
const mockSubscribeToRoom = jest.fn();

jest.mock('../../services/RoomService', () => ({
  RoomService: {
    getInstance: jest.fn(() => ({
      generateRoomNumber: mockGenerateRoomNumber,
      createRoom: mockCreateRoom,
      updateRoom: mockUpdateRoom,
      deleteRoom: mockDeleteRoom,
      getRoom: mockGetRoom,
      subscribeToRoom: mockSubscribeToRoom,
    })),
  },
}));

// Mock Room model
jest.mock('../../models/Room', () => ({
  ...jest.requireActual('../../models/Room'),
  createRoom: jest.fn((hostUid: string, roomNumber: string, template: any) => ({
    timestamp: Date.now(),
    hostUid,
    roomNumber,
    roomStatus: 0, // RoomStatus.seating
    template,
    players: new Map(),
    actions: new Map(),
    wolfVotes: new Map(),
    currentActionerIndex: 0,
    hasPoison: true,
    hasAntidote: true,
  })),
}));

// Helper to create mock template
const createMockTemplate = (): GameTemplate => ({
  name: 'Test Template',
  roles: ['wolf', 'seer', 'witch', 'villager'] as RoleName[],
  numberOfPlayers: 4,
  actionOrder: ['wolf', 'seer', 'witch'] as RoleName[],
});

// Helper to create mock room
const createMockRoom = (overrides: Partial<Room> = {}): Room => ({
  timestamp: Date.now(),
  hostUid: 'host-123',
  roomNumber: '1234',
  roomStatus: RoomStatus.seating,
  template: createMockTemplate(),
  players: new Map(),
  actions: new Map(),
  wolfVotes: new Map(),
  currentActionerIndex: 0,
  hasPoison: true,
  hasAntidote: true,
  ...overrides,
});

describe('useRoom hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribeToRoom.mockReturnValue(jest.fn()); // Return unsubscribe function
  });

  describe('Initial state', () => {
    it('should start with null room', () => {
      const { result } = renderHook(() => useRoom());
      
      expect(result.current.room).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should provide all room methods', () => {
      const { result } = renderHook(() => useRoom());
      
      expect(typeof result.current.createRoom).toBe('function');
      expect(typeof result.current.updateRoom).toBe('function');
      expect(typeof result.current.endRoom).toBe('function');
      expect(typeof result.current.joinRoom).toBe('function');
      expect(typeof result.current.setRoom).toBe('function');
    });
  });

  describe('Room subscription', () => {
    it('should subscribe to room when roomNumber is provided', () => {
      renderHook(() => useRoom('1234'));
      
      expect(mockSubscribeToRoom).toHaveBeenCalledWith('1234', expect.any(Function));
    });

    it('should not subscribe when roomNumber is not provided', () => {
      renderHook(() => useRoom());
      
      expect(mockSubscribeToRoom).not.toHaveBeenCalled();
    });

    it('should unsubscribe when unmounting', () => {
      const mockUnsubscribe = jest.fn();
      mockSubscribeToRoom.mockReturnValue(mockUnsubscribe);
      
      const { unmount } = renderHook(() => useRoom('1234'));
      unmount();
      
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should update room when subscription callback is called', async () => {
      const mockRoom = createMockRoom();
      
      mockSubscribeToRoom.mockImplementation((roomNum, callback) => {
        // Simulate immediate callback with room data
        Promise.resolve().then(() => callback(mockRoom));
        return jest.fn();
      });
      
      const { result } = renderHook(() => useRoom('1234'));
      
      await waitFor(() => {
        expect(result.current.room).toEqual(mockRoom);
      });
    });
  });

  describe('createRoom', () => {
    it('should create a new room', async () => {
      mockGenerateRoomNumber.mockResolvedValue('5678');
      mockCreateRoom.mockResolvedValue(undefined);
      
      const mockTemplate = createMockTemplate();
      
      const { result } = renderHook(() => useRoom());
      
      let newRoom: Room | null = null;
      await act(async () => {
        newRoom = await result.current.createRoom('host-123', mockTemplate);
      });
      
      expect(mockGenerateRoomNumber).toHaveBeenCalled();
      expect(mockCreateRoom).toHaveBeenCalledWith('5678', expect.objectContaining({
        roomNumber: '5678',
        hostUid: 'host-123',
      }));
      expect(newRoom).toBeDefined();
      expect(result.current.room).toBeDefined();
    });

    it('should set error when createRoom fails', async () => {
      mockGenerateRoomNumber.mockRejectedValue(new Error('Failed to generate'));
      
      const mockTemplate = createMockTemplate();
      
      const { result } = renderHook(() => useRoom());
      
      await act(async () => {
        await result.current.createRoom('host-123', mockTemplate);
      });
      
      expect(result.current.error).toBe('Failed to create room');
    });
  });

  describe('updateRoom', () => {
    it('should update room when room exists', async () => {
      const mockRoom = createMockRoom();
      mockUpdateRoom.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useRoom());
      
      // Set room first
      await act(async () => {
        result.current.setRoom(mockRoom);
      });
      
      await act(async () => {
        await result.current.updateRoom({ roomStatus: RoomStatus.ongoing });
      });
      
      expect(mockUpdateRoom).toHaveBeenCalledWith('1234', expect.objectContaining({
        roomStatus: RoomStatus.ongoing,
      }));
    });

    it('should not update when room is null', async () => {
      const { result } = renderHook(() => useRoom());
      
      await act(async () => {
        await result.current.updateRoom({ roomStatus: RoomStatus.ongoing });
      });
      
      expect(mockUpdateRoom).not.toHaveBeenCalled();
    });

    it('should set error when updateRoom fails', async () => {
      const mockRoom = createMockRoom();
      mockUpdateRoom.mockRejectedValue(new Error('Update failed'));
      
      const { result } = renderHook(() => useRoom());
      
      await act(async () => {
        result.current.setRoom(mockRoom);
      });
      
      await act(async () => {
        await result.current.updateRoom({ roomStatus: RoomStatus.ongoing });
      });
      
      expect(result.current.error).toBe('Failed to update room');
    });
  });

  describe('endRoom', () => {
    it('should delete room when room exists', async () => {
      const mockRoom = createMockRoom();
      mockDeleteRoom.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useRoom());
      
      await act(async () => {
        result.current.setRoom(mockRoom);
      });
      
      await act(async () => {
        await result.current.endRoom();
      });
      
      expect(mockDeleteRoom).toHaveBeenCalledWith('1234');
    });

    it('should not delete when room is null', async () => {
      const { result } = renderHook(() => useRoom());
      
      await act(async () => {
        await result.current.endRoom();
      });
      
      expect(mockDeleteRoom).not.toHaveBeenCalled();
    });

    it('should set error when endRoom fails', async () => {
      const mockRoom = createMockRoom();
      mockDeleteRoom.mockRejectedValue(new Error('Delete failed'));
      
      const { result } = renderHook(() => useRoom());
      
      await act(async () => {
        result.current.setRoom(mockRoom);
      });
      
      await act(async () => {
        await result.current.endRoom();
      });
      
      expect(result.current.error).toBe('Failed to end room');
    });
  });

  describe('joinRoom', () => {
    it('should get room by room number', async () => {
      const mockRoom = createMockRoom();
      mockGetRoom.mockResolvedValue(mockRoom);
      
      const { result } = renderHook(() => useRoom());
      
      let joinedRoom: Room | null = null;
      await act(async () => {
        joinedRoom = await result.current.joinRoom('1234');
      });
      
      expect(mockGetRoom).toHaveBeenCalledWith('1234');
      expect(joinedRoom).toEqual(mockRoom);
      expect(result.current.room).toEqual(mockRoom);
    });

    it('should set error when room not found', async () => {
      mockGetRoom.mockResolvedValue(null);
      
      const { result } = renderHook(() => useRoom());
      
      let joinedRoom: Room | null = null;
      await act(async () => {
        joinedRoom = await result.current.joinRoom('9999');
      });
      
      expect(joinedRoom).toBeNull();
      expect(result.current.error).toBe('Room not found');
    });

    it('should set error when joinRoom fails', async () => {
      mockGetRoom.mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => useRoom());
      
      await act(async () => {
        await result.current.joinRoom('1234');
      });
      
      expect(result.current.error).toBe('Failed to join room');
    });
  });

  describe('setRoom', () => {
    it('should allow setting room directly', async () => {
      const mockRoom = createMockRoom();
      
      const { result } = renderHook(() => useRoom());
      
      await act(async () => {
        result.current.setRoom(mockRoom);
      });
      
      expect(result.current.room).toEqual(mockRoom);
    });

    it('should allow setting room to null', async () => {
      const mockRoom = createMockRoom();
      
      const { result } = renderHook(() => useRoom());
      
      await act(async () => {
        result.current.setRoom(mockRoom);
      });
      
      expect(result.current.room).toEqual(mockRoom);
      
      await act(async () => {
        result.current.setRoom(null);
      });
      
      expect(result.current.room).toBeNull();
    });
  });
});
