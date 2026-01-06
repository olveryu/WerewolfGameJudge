import {
  Player,
  PlayerStatus,
  SkillStatus,
  createPlayer,
  playerToMap,
  playerFromMap,
  isPlayerAlive,
  isPlayerSkillAvailable,
} from '../Player';

describe('Player - createPlayer', () => {
  it('should create a player with correct default values', () => {
    const player = createPlayer('user123', 0, 'wolf');
    
    expect(player.uid).toBe('user123');
    expect(player.seatNumber).toBe(0);
    expect(player.role).toBe('wolf');
    expect(player.status).toBe(PlayerStatus.alive);
    expect(player.skillStatus).toBe(SkillStatus.available);
    expect(player.hasViewedRole).toBe(false);
  });

  it('should create players with different roles', () => {
    const seer = createPlayer('user1', 1, 'seer');
    const witch = createPlayer('user2', 2, 'witch');
    const villager = createPlayer('user3', 3, 'villager');
    
    expect(seer.role).toBe('seer');
    expect(witch.role).toBe('witch');
    expect(villager.role).toBe('villager');
  });

  it('should create players at different seat numbers', () => {
    const player1 = createPlayer('user1', 0, 'wolf');
    const player2 = createPlayer('user2', 5, 'seer');
    const player3 = createPlayer('user3', 11, 'villager');
    
    expect(player1.seatNumber).toBe(0);
    expect(player2.seatNumber).toBe(5);
    expect(player3.seatNumber).toBe(11);
  });
});

describe('Player - Status Checks', () => {
  it('isPlayerAlive should return true for alive players', () => {
    const player = createPlayer('user1', 0, 'wolf');
    expect(isPlayerAlive(player)).toBe(true);
  });

  it('isPlayerAlive should return false for dead players', () => {
    const player = createPlayer('user1', 0, 'wolf');
    player.status = PlayerStatus.dead;
    expect(isPlayerAlive(player)).toBe(false);
  });

  it('isPlayerSkillAvailable should return true for players with available skill', () => {
    const player = createPlayer('user1', 0, 'witch');
    expect(isPlayerSkillAvailable(player)).toBe(true);
  });

  it('isPlayerSkillAvailable should return false for players with unavailable skill', () => {
    const player = createPlayer('user1', 0, 'witch');
    player.skillStatus = SkillStatus.unavailable;
    expect(isPlayerSkillAvailable(player)).toBe(false);
  });
});

describe('Player - Serialization', () => {
  it('playerToMap should serialize all fields correctly', () => {
    const player: Player = {
      uid: 'user123',
      seatNumber: 3,
      role: 'seer',
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
      hasViewedRole: true,
      displayName: 'TestPlayer',
      avatarUrl: 'https://example.com/avatar.png',
    };

    const map = playerToMap(player);

    expect(map.uid).toBe('user123');
    expect(map.seatNumber).toBe(3);
    expect(map.role).toBe('seer');
    expect(map.status).toBe(PlayerStatus.alive);
    expect(map.skillStatus).toBe(SkillStatus.available);
    expect(map.hasViewedRole).toBe(true);
    expect(map.displayName).toBe('TestPlayer');
    expect(map.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('playerToMap should handle undefined optional fields', () => {
    const player = createPlayer('user1', 0, 'wolf');
    const map = playerToMap(player);

    expect(map.displayName).toBeUndefined();
    expect(map.avatarUrl).toBeUndefined();
  });

  it('playerFromMap should deserialize all fields correctly', () => {
    const map = {
      uid: 'user456',
      seatNumber: 5,
      role: 'witch',
      status: PlayerStatus.dead,
      skillStatus: SkillStatus.unavailable,
      hasViewedRole: true,
      displayName: 'AnotherPlayer',
      avatarUrl: 'https://example.com/avatar2.png',
    };

    const player = playerFromMap(map);

    expect(player.uid).toBe('user456');
    expect(player.seatNumber).toBe(5);
    expect(player.role).toBe('witch');
    expect(player.status).toBe(PlayerStatus.dead);
    expect(player.skillStatus).toBe(SkillStatus.unavailable);
    expect(player.hasViewedRole).toBe(true);
    expect(player.displayName).toBe('AnotherPlayer');
    expect(player.avatarUrl).toBe('https://example.com/avatar2.png');
  });

  it('playerFromMap should use default values for missing status fields', () => {
    const map = {
      uid: 'user789',
      seatNumber: 0,
      role: 'villager',
    };

    const player = playerFromMap(map);

    expect(player.status).toBe(PlayerStatus.alive);
    expect(player.skillStatus).toBe(SkillStatus.available);
    expect(player.hasViewedRole).toBe(false);
  });

  it('round trip serialization should preserve all data', () => {
    const original: Player = {
      uid: 'roundtrip',
      seatNumber: 7,
      role: 'hunter',
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
      hasViewedRole: false,
      displayName: 'RoundTrip',
      avatarUrl: 'https://example.com/roundtrip.png',
    };

    const map = playerToMap(original);
    const restored = playerFromMap(map);

    expect(restored).toEqual(original);
  });
});

describe('Player - Status Transitions', () => {
  it('player can transition from alive to dead', () => {
    const player = createPlayer('user1', 0, 'villager');
    expect(player.status).toBe(PlayerStatus.alive);
    
    player.status = PlayerStatus.dead;
    expect(player.status).toBe(PlayerStatus.dead);
    expect(isPlayerAlive(player)).toBe(false);
  });

  it('player skill can become unavailable', () => {
    const player = createPlayer('user1', 0, 'witch');
    expect(player.skillStatus).toBe(SkillStatus.available);
    
    player.skillStatus = SkillStatus.unavailable;
    expect(player.skillStatus).toBe(SkillStatus.unavailable);
    expect(isPlayerSkillAvailable(player)).toBe(false);
  });

  it('hunter skill becomes unavailable when poisoned (simulated)', () => {
    const hunter = createPlayer('hunter1', 0, 'hunter');
    expect(isPlayerSkillAvailable(hunter)).toBe(true);
    
    // Simulate being poisoned - hunter can't shoot
    hunter.status = PlayerStatus.dead;
    hunter.skillStatus = SkillStatus.unavailable;
    
    expect(isPlayerAlive(hunter)).toBe(false);
    expect(isPlayerSkillAvailable(hunter)).toBe(false);
  });
});

describe('Player - Edge Cases', () => {
  it('should handle null avatarUrl', () => {
    const player: Player = {
      uid: 'user1',
      seatNumber: 0,
      role: 'wolf',
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
      hasViewedRole: false,
      avatarUrl: null,
    };

    const map = playerToMap(player);
    expect(map.avatarUrl).toBeNull();

    const restored = playerFromMap(map);
    expect(restored.avatarUrl).toBeNull();
  });

  it('should handle empty string displayName', () => {
    const player = createPlayer('user1', 0, 'wolf');
    player.displayName = '';

    const map = playerToMap(player);
    expect(map.displayName).toBe('');

    const restored = playerFromMap(map);
    expect(restored.displayName).toBe('');
  });
});
