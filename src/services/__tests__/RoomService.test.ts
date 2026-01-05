import { RoomService } from '../RoomService';
import { RoomStatus, createRoom } from '../../models/Room';
import { createTemplateFromRoles } from '../../models/Template';
import { RoleName } from '../../constants/roles';

// Mock supabase
jest.mock('../../config/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: jest.fn(() => false),
}));

// Mock AuthService
jest.mock('../AuthService', () => ({
  AuthService: {
    getInstance: jest.fn(() => ({
      waitForInit: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

describe('RoomService - Singleton', () => {
  beforeEach(() => {
    // Reset singleton for each test
    (RoomService as any).instance = null;
  });

  it('should return same instance', () => {
    const instance1 = RoomService.getInstance();
    const instance2 = RoomService.getInstance();
    
    expect(instance1).toBe(instance2);
  });

  it('should be defined', () => {
    const instance = RoomService.getInstance();
    expect(instance).toBeDefined();
  });
});

describe('RoomService - Room creation helpers', () => {
  it('should create room with correct structure', () => {
    const roles: RoleName[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
    const template = createTemplateFromRoles(roles);
    const room = createRoom('host123', '1234', template);
    
    expect(room.hostUid).toBe('host123');
    expect(room.roomNumber).toBe('1234');
    expect(room.roomStatus).toBe(RoomStatus.seating);
    expect(room.template).toBeDefined();
    expect(room.template.numberOfPlayers).toBe(6);
    expect(room.players.size).toBe(6);
    expect(room.hasPoison).toBe(true);
    expect(room.hasAntidote).toBe(true);
  });

  it('should initialize players map with null values', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'villager'];
    const template = createTemplateFromRoles(roles);
    const room = createRoom('host', '9999', template);
    
    for (let i = 0; i < 3; i++) {
      expect(room.players.get(i)).toBeNull();
    }
  });

  it('should initialize actions and wolfVotes as empty maps', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'villager'];
    const template = createTemplateFromRoles(roles);
    const room = createRoom('host', '9999', template);
    
    expect(room.actions.size).toBe(0);
    expect(room.wolfVotes.size).toBe(0);
  });
});

describe('RoomService - Unconfigured state', () => {
  let roomService: RoomService;
  
  beforeEach(() => {
    (RoomService as any).instance = null;
    roomService = RoomService.getInstance();
  });

  it('should throw error when creating room without config', async () => {
    const roles: RoleName[] = ['wolf', 'villager'];
    const template = createTemplateFromRoles(roles);
    const room = createRoom('host', '1234', template);
    
    await expect(roomService.createRoom('1234', room))
      .rejects.toThrow('Supabase is not configured');
  });

  it('should throw error when getting room without config', async () => {
    await expect(roomService.getRoom('1234'))
      .rejects.toThrow('Supabase is not configured');
  });

  it('should throw error when updating room without config', async () => {
    const roles: RoleName[] = ['wolf', 'villager'];
    const template = createTemplateFromRoles(roles);
    const room = createRoom('host', '1234', template);
    
    await expect(roomService.updateRoom('1234', room))
      .rejects.toThrow('Supabase is not configured');
  });

  it('should throw error when deleting room without config', async () => {
    await expect(roomService.deleteRoom('1234'))
      .rejects.toThrow('Supabase is not configured');
  });

  it('subscribeToRoom should return empty cleanup function', () => {
    const callback = jest.fn();
    const cleanup = roomService.subscribeToRoom('1234', callback);
    
    expect(typeof cleanup).toBe('function');
    // Should not throw when called
    expect(() => cleanup()).not.toThrow();
    // Callback should not be called when not configured
    expect(callback).not.toHaveBeenCalled();
  });

  it('cleanupInactiveRooms should return 0 when not configured', async () => {
    const count = await roomService.cleanupInactiveRooms();
    expect(count).toBe(0);
  });
});

describe('RoomService - Room status transitions', () => {
  it('should allow room status to change', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'villager'];
    const template = createTemplateFromRoles(roles);
    const room = createRoom('host', '1234', template);
    
    expect(room.roomStatus).toBe(RoomStatus.seating);
    
    room.roomStatus = RoomStatus.seated;
    expect(room.roomStatus).toBe(RoomStatus.seated);
    
    room.roomStatus = RoomStatus.ongoing;
    expect(room.roomStatus).toBe(RoomStatus.ongoing);
    
    room.roomStatus = RoomStatus.terminated;
    expect(room.roomStatus).toBe(RoomStatus.terminated);
  });
});

describe('RoomService - Template integration', () => {
  it('should calculate correct action order', () => {
    const roles: RoleName[] = ['wolf', 'guard', 'witch', 'seer', 'villager'];
    const template = createTemplateFromRoles(roles);
    const room = createRoom('host', '1234', template);
    
    expect(room.template.actionOrder).toContain('wolf');
    expect(room.template.actionOrder).toContain('guard');
    expect(room.template.actionOrder).toContain('witch');
    expect(room.template.actionOrder).toContain('seer');
    expect(room.template.actionOrder).not.toContain('villager');
  });

  it('should handle 12-player template', () => {
    const roles: RoleName[] = [
      'wolf', 'wolf', 'wolf', 'wolf',
      'seer', 'witch', 'hunter', 'idiot',
      'villager', 'villager', 'villager', 'villager',
    ];
    const template = createTemplateFromRoles(roles);
    const room = createRoom('host', '1234', template);
    
    expect(room.template.numberOfPlayers).toBe(12);
    expect(room.players.size).toBe(12);
  });
});
