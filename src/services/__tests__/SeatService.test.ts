import { SeatService } from '../SeatService';
import { createRoom, Room } from '../../models/Room';
import { createTemplateFromRoles } from '../../models/Template';
import { RoleName } from '../../constants/roles';

// Mock dependencies - V2 uses RPC methods instead of updateRoom
const mockGetRoom = jest.fn();
const mockTakeSeat = jest.fn();
const mockLeaveSeat = jest.fn();
const mockBatchUpdatePlayers = jest.fn();
const mockWaitForInit = jest.fn().mockResolvedValue(undefined);
const mockGetCurrentUserId = jest.fn();
const mockGetCurrentDisplayName = jest.fn();
const mockGetCurrentAvatarUrl = jest.fn();
const mockGenerateDisplayName = jest.fn();

jest.mock('../RoomService', () => ({
  RoomService: {
    getInstance: jest.fn(() => ({
      getRoom: mockGetRoom,
      takeSeat: mockTakeSeat,
      leaveSeat: mockLeaveSeat,
      batchUpdatePlayers: mockBatchUpdatePlayers,
    })),
  },
}));

jest.mock('../AuthService', () => ({
  AuthService: {
    getInstance: jest.fn(() => ({
      waitForInit: mockWaitForInit,
      getCurrentUserId: mockGetCurrentUserId,
      getCurrentDisplayName: mockGetCurrentDisplayName,
      getCurrentAvatarUrl: mockGetCurrentAvatarUrl,
      generateDisplayName: mockGenerateDisplayName,
    })),
  },
}));

describe('SeatService - Singleton', () => {
  beforeEach(() => {
    (SeatService as any).instance = null;
    jest.clearAllMocks();
  });

  it('should return same instance', () => {
    const instance1 = SeatService.getInstance();
    const instance2 = SeatService.getInstance();
    
    expect(instance1).toBe(instance2);
  });

  it('should be defined', () => {
    const instance = SeatService.getInstance();
    expect(instance).toBeDefined();
  });
});

describe('SeatService - takeSeat (V2 RPC)', () => {
  let seatService: SeatService;

  beforeEach(() => {
    (SeatService as any).instance = null;
    seatService = SeatService.getInstance();
    jest.clearAllMocks();

    // Setup default mocks
    mockGetCurrentUserId.mockReturnValue('user123');
    mockGetCurrentDisplayName.mockResolvedValue('TestUser');
    mockGetCurrentAvatarUrl.mockResolvedValue('https://example.com/avatar.png');
  });

  it('should return -1 when RPC fails', async () => {
    mockTakeSeat.mockResolvedValue({ success: false, error: 'seat_taken' });

    const result = await seatService.takeSeat('1234', 0, null);

    expect(result).toBe(-1);
    expect(mockTakeSeat).toHaveBeenCalledWith(
      '1234',
      0,
      'user123',
      'TestUser',
      'https://example.com/avatar.png'
    );
  });

  it('should take an empty seat successfully', async () => {
    mockTakeSeat.mockResolvedValue({ success: true, allSeated: false });

    const result = await seatService.takeSeat('1234', 0, null);

    expect(result).toBe(0);
    expect(mockTakeSeat).toHaveBeenCalledWith(
      '1234',
      0,
      'user123',
      'TestUser',
      'https://example.com/avatar.png'
    );
  });

  it('should leave current seat when moving to new seat', async () => {
    mockLeaveSeat.mockResolvedValue({ success: true });
    mockTakeSeat.mockResolvedValue({ success: true, allSeated: false });

    // User is moving from seat 0 to seat 1
    const result = await seatService.takeSeat('1234', 1, 0);

    expect(result).toBe(0);
    // Should leave seat 0 first
    expect(mockLeaveSeat).toHaveBeenCalledWith('1234', 0, 'user123');
    // Then take seat 1
    expect(mockTakeSeat).toHaveBeenCalledWith(
      '1234',
      1,
      'user123',
      'TestUser',
      'https://example.com/avatar.png'
    );
  });

  it('should not leave current seat when re-taking same seat', async () => {
    mockTakeSeat.mockResolvedValue({ success: true, allSeated: false });

    // User is clicking on their current seat (seat 0)
    const result = await seatService.takeSeat('1234', 0, 0);

    expect(result).toBe(0);
    // Should NOT call leaveSeat since we're staying on same seat
    expect(mockLeaveSeat).not.toHaveBeenCalled();
    expect(mockTakeSeat).toHaveBeenCalled();
  });
});

describe('SeatService - leaveSeat (V2 RPC)', () => {
  let seatService: SeatService;

  beforeEach(() => {
    (SeatService as any).instance = null;
    seatService = SeatService.getInstance();
    jest.clearAllMocks();
    mockGetCurrentUserId.mockReturnValue('user123');
  });

  it('should call leaveSeat RPC', async () => {
    mockLeaveSeat.mockResolvedValue({ success: true });

    await seatService.leaveSeat('1234', 0);

    expect(mockLeaveSeat).toHaveBeenCalledWith('1234', 0, 'user123');
  });
});

describe('SeatService - fillWithBots (V2 RPC)', () => {
  let seatService: SeatService;
  let testRoom: Room;

  beforeEach(() => {
    (SeatService as any).instance = null;
    seatService = SeatService.getInstance();
    jest.clearAllMocks();

    // Create a test room
    const roles: RoleName[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
    const template = createTemplateFromRoles(roles);
    testRoom = createRoom('host123', '1234', template);

    // Setup default mocks
    mockGetCurrentUserId.mockReturnValue('host123');
    mockGetCurrentDisplayName.mockResolvedValue('HostUser');
    mockGetCurrentAvatarUrl.mockResolvedValue('https://example.com/host.png');
    mockGenerateDisplayName.mockImplementation((id: string) => `Bot-${id.substring(0, 4)}`);
  });

  it('should return 0 when room not found', async () => {
    mockGetRoom.mockResolvedValue(null);

    const result = await seatService.fillWithBots('9999');

    expect(result).toBe(0);
  });

  it('should fill all seats with bots using batch RPC', async () => {
    mockGetRoom.mockResolvedValue(testRoom);
    mockBatchUpdatePlayers.mockResolvedValue({ success: true });

    const result = await seatService.fillWithBots('1234');

    expect(result).toBe(6); // 6 players total
    expect(mockBatchUpdatePlayers).toHaveBeenCalledWith(
      '1234',
      expect.objectContaining({
        '0': expect.objectContaining({ uid: 'host123' }),
      }),
      'host123'
    );
  });

  it('should return 0 when batch RPC fails', async () => {
    mockGetRoom.mockResolvedValue(testRoom);
    mockBatchUpdatePlayers.mockResolvedValue({ success: false, error: 'some_error' });

    const result = await seatService.fillWithBots('1234');

    expect(result).toBe(0);
  });
});

describe('SeatService - updatePlayerSeat (V2 RPC)', () => {
  let seatService: SeatService;

  beforeEach(() => {
    (SeatService as any).instance = null;
    seatService = SeatService.getInstance();
    jest.clearAllMocks();
    mockGetCurrentUserId.mockReturnValue('user123');
    mockGetCurrentDisplayName.mockResolvedValue('TestUser');
    mockGetCurrentAvatarUrl.mockResolvedValue('https://example.com/avatar.png');
  });

  it('should call leaveSeat when player is null', async () => {
    mockLeaveSeat.mockResolvedValue({ success: true });

    await seatService.updatePlayerSeat('1234', 1, null);

    expect(mockLeaveSeat).toHaveBeenCalledWith('1234', 1, 'user123');
  });

  it('should call takeSeat when player is provided', async () => {
    mockTakeSeat.mockResolvedValue({ success: true, allSeated: false });

    const player = {
      uid: 'user123',
      seatNumber: 1,
      role: null,
      status: 0,
      skillStatus: 0,
      hasViewedRole: false,
      displayName: 'PlayerName',
      avatarUrl: 'https://example.com/player.png',
    };

    await seatService.updatePlayerSeat('1234', 1, player);

    // updatePlayerSeat uses player.displayName and player.avatarUrl, not AuthService
    expect(mockTakeSeat).toHaveBeenCalledWith(
      '1234',
      1,
      'user123',
      'PlayerName',
      'https://example.com/player.png'
    );
  });
});
