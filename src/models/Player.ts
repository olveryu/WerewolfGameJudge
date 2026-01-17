import { RoleId } from './roles';

export enum PlayerStatus {
  alive = 0,
  dead = 1,
}

export enum SkillStatus {
  available = 0,
  unavailable = 1,
}

export interface Player {
  uid: string;
  seatNumber: number;
  role: RoleId | null; // null before roles are assigned (before "准备看牌")
  status: PlayerStatus;
  skillStatus: SkillStatus;
  hasViewedRole: boolean; // 是否已查看身份
  displayName?: string;
  avatarUrl?: string | null;
}

// Database keys matching Flutter (for Supabase serialization)
export const PLAYER_KEYS = {
  uid: 'uid',
  seatNumber: 'seatNumber',
  role: 'role',
  status: 'status',
  skillStatus: 'skillStatus',
  hasViewedRole: 'hasViewedRole',
  displayName: 'displayName',
  avatarUrl: 'avatarUrl',
} as const;

// Create player without role (for seating phase)
export const createPlayer = (
  uid: string,
  seatNumber: number,
  role: RoleId | null = null,
): Player => ({
  uid,
  seatNumber,
  role,
  status: PlayerStatus.alive,
  skillStatus: SkillStatus.available,
  hasViewedRole: false,
});

export const playerToMap = (player: Player): Record<string, any> => ({
  [PLAYER_KEYS.uid]: player.uid,
  [PLAYER_KEYS.seatNumber]: player.seatNumber,
  [PLAYER_KEYS.role]: player.role, // Store role name directly
  [PLAYER_KEYS.status]: player.status,
  [PLAYER_KEYS.skillStatus]: player.skillStatus,
  [PLAYER_KEYS.hasViewedRole]: player.hasViewedRole,
  [PLAYER_KEYS.displayName]: player.displayName,
  [PLAYER_KEYS.avatarUrl]: player.avatarUrl,
});

export const playerFromMap = (map: Record<string, any>): Player => ({
  uid: map[PLAYER_KEYS.uid],
  seatNumber: map[PLAYER_KEYS.seatNumber],
  role: map[PLAYER_KEYS.role] as RoleId | null, // Can be null before roles assigned
  status: map[PLAYER_KEYS.status] ?? PlayerStatus.alive,
  skillStatus: map[PLAYER_KEYS.skillStatus] ?? SkillStatus.available,
  hasViewedRole: map[PLAYER_KEYS.hasViewedRole] ?? false,
  displayName: map[PLAYER_KEYS.displayName],
  avatarUrl: map[PLAYER_KEYS.avatarUrl],
});

export const isPlayerAlive = (player: Player): boolean => player.status === PlayerStatus.alive;

export const isPlayerSkillAvailable = (player: Player): boolean =>
  player.skillStatus === SkillStatus.available;
