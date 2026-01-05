import { SeatService } from '../SeatService';
import { createRoom, Room } from '../../models/Room';
import { Player, PlayerStatus, SkillStatus } from '../../models/Player';
import { createTemplateFromRoles } from '../../models/Template';
import { RoleName } from '../../constants/roles';

// Mock dependencies
const mockGetRoom = jest.fn();
const mockUpdateRoom = jest.fn();
const mockWaitForInit = jest.fn().mockResolvedValue(undefined);
const mockGetCurrentUserId = jest.fn();
const mockGetCurrentDisplayName = jest.fn();
const mockGetCurrentAvatarUrl = jest.fn();
const mockGenerateDisplayName = jest.fn();

jest.mock('../RoomService', () => ({
  RoomService: {
    getInstance: jest.fn(() => ({
      getRoom: mockGetRoom,
      updateRoom: mockUpdateRoom,
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

describe('SeatService - takeSeat', () => {
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
    mockGetCurrentUserId.mockReturnValue('user123');
    mockGetCurrentDisplayName.mockResolvedValue('TestUser');
    mockGetCurrentAvatarUrl.mockResolvedValue('https://example.com/avatar.png');
  });

  it('should return -1 when room not found', async () => {
    mockGetRoom.mockResolvedValue(null);

    const result = await seatService.takeSeat('9999', 0, null);

    expect(result).toBe(-1);
  });

  it('should take an empty seat successfully', async () => {
    mockGetRoom.mockResolvedValue(testRoom);
    mockUpdateRoom.mockResolvedValue(undefined);

    const result = await seatService.takeSeat('1234', 0, null);

    expect(result).toBe(0);
    expect(mockUpdateRoom).toHaveBeenCalled();
    
    // Verify the room was updated with the player
    const updateCall = mockUpdateRoom.mock.calls[0];
    const updatedRoom = updateCall[1] as Room;
    expect(updatedRoom.players.get(0)).toBeDefined();
    expect(updatedRoom.players.get(0)?.uid).toBe('user123');
    expect(updatedRoom.players.get(0)?.role).toBe('wolf');
  });

  it('should return -1 when seat is taken by another user', async () => {
    const existingPlayer: Player = {
      uid: 'other_user',
      seatNumber: 0,
      role: 'wolf',
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
    };
    testRoom.players.set(0, existingPlayer);
    mockGetRoom.mockResolvedValue(testRoom);

    const result = await seatService.takeSeat('1234', 0, null);

    expect(result).toBe(-1);
    expect(mockUpdateRoom).not.toHaveBeenCalled();
  });

  it('should allow user to take their current seat again', async () => {
    const existingPlayer: Player = {
      uid: 'user123', // Same user
      seatNumber: 0,
      role: 'wolf',
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
    };
    testRoom.players.set(0, existingPlayer);
    mockGetRoom.mockResolvedValue(testRoom);
    mockUpdateRoom.mockResolvedValue(undefined);

    const result = await seatService.takeSeat('1234', 0, null);

    expect(result).toBe(0);
    expect(mockUpdateRoom).toHaveBeenCalled();
  });

  it('should leave current seat when moving to new seat', async () => {
    // User is currently at seat 0
    const currentPlayer: Player = {
      uid: 'user123',
      seatNumber: 0,
      role: 'wolf',
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
    };
    testRoom.players.set(0, currentPlayer);
    mockGetRoom.mockResolvedValue(testRoom);
    mockUpdateRoom.mockResolvedValue(undefined);

    // Move to seat 2
    const result = await seatService.takeSeat('1234', 2, 0);

    expect(result).toBe(0);
    expect(mockUpdateRoom).toHaveBeenCalled();
    
    const updateCall = mockUpdateRoom.mock.calls[0];
    const updatedRoom = updateCall[1] as Room;
    // Old seat should be empty
    expect(updatedRoom.players.get(0)).toBeNull();
    // New seat should have player
    expect(updatedRoom.players.get(2)?.uid).toBe('user123');
    expect(updatedRoom.players.get(2)?.role).toBe('seer');
  });

  it('should assign correct role based on seat position', async () => {
    mockGetRoom.mockResolvedValue(testRoom);
    mockUpdateRoom.mockResolvedValue(undefined);

    // Take seat 3 which should be witch
    const result = await seatService.takeSeat('1234', 3, null);

    expect(result).toBe(0);
    const updateCall = mockUpdateRoom.mock.calls[0];
    const updatedRoom = updateCall[1] as Room;
    expect(updatedRoom.players.get(3)?.role).toBe('witch');
  });

  it('should return -1 for invalid seat index', async () => {
    mockGetRoom.mockResolvedValue(testRoom);

    // Seat 10 doesn't exist in 6-player room
    const result = await seatService.takeSeat('1234', 10, null);

    expect(result).toBe(-1);
    expect(mockUpdateRoom).not.toHaveBeenCalled();
  });
});

describe('SeatService - leaveSeat', () => {
  let seatService: SeatService;
  let testRoom: Room;

  beforeEach(() => {
    (SeatService as any).instance = null;
    seatService = SeatService.getInstance();
    jest.clearAllMocks();

    const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
    const template = createTemplateFromRoles(roles);
    testRoom = createRoom('host123', '1234', template);
    
    // Add a player to seat 1
    testRoom.players.set(1, {
      uid: 'user123',
      seatNumber: 1,
      role: 'seer',
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
    });
  });

  it('should leave seat when room exists', async () => {
    mockGetRoom.mockResolvedValue(testRoom);
    mockUpdateRoom.mockResolvedValue(undefined);

    await seatService.leaveSeat('1234', 1);

    expect(mockUpdateRoom).toHaveBeenCalled();
    const updateCall = mockUpdateRoom.mock.calls[0];
    const updatedRoom = updateCall[1] as Room;
    expect(updatedRoom.players.get(1)).toBeNull();
  });

  it('should do nothing when room not found', async () => {
    mockGetRoom.mockResolvedValue(null);

    await seatService.leaveSeat('9999', 1);

    expect(mockUpdateRoom).not.toHaveBeenCalled();
  });
});

describe('SeatService - fillWithBots', () => {
  let seatService: SeatService;
  let testRoom: Room;

  beforeEach(() => {
    (SeatService as any).instance = null;
    seatService = SeatService.getInstance();
    jest.clearAllMocks();

    const roles: RoleName[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
    const template = createTemplateFromRoles(roles);
    testRoom = createRoom('host123', '1234', template);

    mockGenerateDisplayName.mockImplementation((id: string) => `Bot ${id.substring(0, 6)}`);
  });

  it('should return 0 when room not found', async () => {
    mockGetRoom.mockResolvedValue(null);

    const result = await seatService.fillWithBots('9999');

    expect(result).toBe(0);
    expect(mockUpdateRoom).not.toHaveBeenCalled();
  });

  it('should fill all seats with bots', async () => {
    mockGetRoom.mockResolvedValue(testRoom);
    mockUpdateRoom.mockResolvedValue(undefined);

    const result = await seatService.fillWithBots('1234');

    expect(result).toBe(6); // All 6 seats filled
    expect(mockUpdateRoom).toHaveBeenCalled();
    
    const updateCall = mockUpdateRoom.mock.calls[0];
    const updatedRoom = updateCall[1] as Room;
    
    // All seats should have players
    for (let i = 0; i < 6; i++) {
      const player = updatedRoom.players.get(i);
      expect(player).toBeDefined();
      expect(player?.uid).toMatch(/^bot_\d+_/);
    }
  });

  it('should assign correct roles to bots', async () => {
    mockGetRoom.mockResolvedValue(testRoom);
    mockUpdateRoom.mockResolvedValue(undefined);

    await seatService.fillWithBots('1234');

    const updateCall = mockUpdateRoom.mock.calls[0];
    const updatedRoom = updateCall[1] as Room;
    
    expect(updatedRoom.players.get(0)?.role).toBe('wolf');
    expect(updatedRoom.players.get(1)?.role).toBe('wolf');
    expect(updatedRoom.players.get(2)?.role).toBe('seer');
    expect(updatedRoom.players.get(3)?.role).toBe('witch');
    expect(updatedRoom.players.get(4)?.role).toBe('villager');
    expect(updatedRoom.players.get(5)?.role).toBe('villager');
  });
});

describe('SeatService - updatePlayerSeat', () => {
  let seatService: SeatService;
  let testRoom: Room;

  beforeEach(() => {
    (SeatService as any).instance = null;
    seatService = SeatService.getInstance();
    jest.clearAllMocks();

    const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
    const template = createTemplateFromRoles(roles);
    testRoom = createRoom('host123', '1234', template);
  });

  it('should update player at specific seat', async () => {
    mockGetRoom.mockResolvedValue(testRoom);
    mockUpdateRoom.mockResolvedValue(undefined);

    const newPlayer: Player = {
      uid: 'player_new',
      seatNumber: 2,
      role: 'witch',
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
      displayName: 'New Player',
    };

    await seatService.updatePlayerSeat('1234', 2, newPlayer);

    expect(mockUpdateRoom).toHaveBeenCalled();
    const updateCall = mockUpdateRoom.mock.calls[0];
    const updatedRoom = updateCall[1] as Room;
    expect(updatedRoom.players.get(2)).toEqual(newPlayer);
  });

  it('should set seat to null when player is null', async () => {
    // Start with a player at seat 1
    testRoom.players.set(1, {
      uid: 'existing_player',
      seatNumber: 1,
      role: 'seer',
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
    });
    mockGetRoom.mockResolvedValue(testRoom);
    mockUpdateRoom.mockResolvedValue(undefined);

    await seatService.updatePlayerSeat('1234', 1, null);

    expect(mockUpdateRoom).toHaveBeenCalled();
    const updateCall = mockUpdateRoom.mock.calls[0];
    const updatedRoom = updateCall[1] as Room;
    expect(updatedRoom.players.get(1)).toBeNull();
  });

  it('should do nothing when room not found', async () => {
    mockGetRoom.mockResolvedValue(null);

    const newPlayer: Player = {
      uid: 'player_new',
      seatNumber: 0,
      role: 'wolf',
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
    };

    await seatService.updatePlayerSeat('9999', 0, newPlayer);

    expect(mockUpdateRoom).not.toHaveBeenCalled();
  });
});
