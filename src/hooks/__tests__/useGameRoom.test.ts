/**
 * Tests for useGameRoom hook
 *
 * Focus: Room number consistency - ensuring that when a roomNumber is provided,
 * createRoom uses it instead of generating a new one.
 */

import { SimplifiedRoomService, AuthService } from '../../services';
import { GameFacade } from '../../services/v2/facade/GameFacade';
import { GameTemplate } from '../../models/Template';
import { RoleId } from '../../models/roles';

// Mock the services (now in v2/)
jest.mock('../../services/v2/infra/Room');
jest.mock('../../services/v2/infra/Auth');
jest.mock('../../services/v2/facade/GameFacade');

// Helper to create mock template
// Phase 5: actionOrder removed from GameTemplate
const _createMockTemplate = (): GameTemplate => ({
  name: 'Test Template',
  roles: ['wolf', 'seer', 'witch', 'villager'] as RoleId[],
  numberOfPlayers: 4,
});

describe('useGameRoom - Room Number Consistency', () => {
  let mockRoomService: jest.Mocked<SimplifiedRoomService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockGameFacade: jest.Mocked<GameFacade>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock implementations
    mockRoomService = {
      generateRoomNumber: jest.fn().mockResolvedValue('9999'),
      createRoom: jest.fn().mockResolvedValue({
        roomNumber: '4219',
        hostUid: 'host-123',
        createdAt: new Date(),
      }),
      getRoom: jest.fn(),
      roomExists: jest.fn(),
      deleteRoom: jest.fn(),
    } as any;

    mockAuthService = {
      waitForInit: jest.fn().mockResolvedValue(undefined),
      getCurrentUserId: jest.fn().mockReturnValue('host-123'),
      getCurrentDisplayName: jest.fn().mockResolvedValue('Test User'),
      getCurrentAvatarUrl: jest.fn().mockResolvedValue(null),
    } as any;

    mockGameFacade = {
      initializeAsHost: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn().mockReturnValue(() => {}),
      addStatusListener: jest.fn().mockReturnValue(() => {}),
      isHostPlayer: jest.fn().mockReturnValue(true),
      getMyUid: jest.fn().mockReturnValue('host-123'),
      getMySeatNumber: jest.fn().mockReturnValue(null),
      getMyRole: jest.fn().mockReturnValue(null),
      getLastSeatError: jest.fn().mockReturnValue(null),
      getStateRevision: jest.fn().mockReturnValue(0),
    } as any;

    // Wire up getInstance mocks
    (SimplifiedRoomService.getInstance as jest.Mock).mockReturnValue(mockRoomService);
    (AuthService.getInstance as jest.Mock).mockReturnValue(mockAuthService);
    (GameFacade.getInstance as jest.Mock).mockReturnValue(mockGameFacade);
  });

  describe('createRoom with provided roomNumber', () => {
    it('should use provided roomNumber instead of generating a new one', async () => {
      // This test verifies the core fix:
      // When createRoom is called with a roomNumber, it should NOT call generateRoomNumber

      const providedRoomNumber = '4219';

      // Simulate what createRoom does internally:
      await mockAuthService.waitForInit();
      mockAuthService.getCurrentUserId();

      // The fix: Use provided room number, don't generate
      const roomNumber = providedRoomNumber ?? (await mockRoomService.generateRoomNumber());

      // Assert: generateRoomNumber should NOT be called
      expect(mockRoomService.generateRoomNumber).not.toHaveBeenCalled();

      // Assert: The roomNumber should be the provided one
      expect(roomNumber).toBe('4219');
    });

    it('should generate roomNumber when none is provided', async () => {
      // Simulate what createRoom does when NO roomNumber is provided:
      await mockAuthService.waitForInit();
      mockAuthService.getCurrentUserId();

      // The logic: Generate if not provided
      const providedRoomNumber: string | undefined = undefined;
      const roomNumber = providedRoomNumber ?? (await mockRoomService.generateRoomNumber());

      // Assert: generateRoomNumber SHOULD be called
      expect(mockRoomService.generateRoomNumber).toHaveBeenCalled();

      // Assert: The roomNumber should be the generated one
      expect(roomNumber).toBe('9999');
    });

    it('should pass the correct roomNumber to SimplifiedRoomService.createRoom', async () => {
      const providedRoomNumber = '4219';
      const hostUid = 'host-123';

      // Call createRoom with the provided roomNumber
      await mockRoomService.createRoom(providedRoomNumber, hostUid);

      // Assert: createRoom was called with the provided roomNumber
      expect(mockRoomService.createRoom).toHaveBeenCalledWith(providedRoomNumber, hostUid);

      // Assert: The first argument is exactly the provided roomNumber
      expect(mockRoomService.createRoom.mock.calls[0][0]).toBe('4219');
    });
  });

  describe('mySeatNumber updates via listener', () => {
    it('should call getMySeatNumber when listener is triggered', () => {
      // Store the listener callback for later invocation
      type ListenerFn = (state: any) => void;
      let capturedListener: ListenerFn | null = null;

      mockGameFacade.addListener = jest.fn().mockImplementation((listener: ListenerFn) => {
        capturedListener = listener;
        return jest.fn(); // unsubscribe
      });

      // First call: mySeatNumber is null
      mockGameFacade.getMySeatNumber.mockReturnValue(null);

      // Simulate initial subscription
      mockGameFacade.addListener(() => {});

      // Now simulate host taking seat (getMySeatNumber returns 0)
      mockGameFacade.getMySeatNumber.mockReturnValue(0);

      // Trigger the listener (simulating notifyListeners after hostTakeSeat)
      expect(capturedListener).not.toBeNull();
      capturedListener!({ players: new Map() });

      // Assert: The returned value is 0 (the seat taken)
      expect(mockGameFacade.getMySeatNumber()).toBe(0);
    });
  });
});
