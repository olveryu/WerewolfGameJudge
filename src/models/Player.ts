import { RoleName } from '../constants/roles';

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
  role: RoleName;
  status: PlayerStatus;
  skillStatus: SkillStatus;
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
  displayName: 'displayName',
  avatarUrl: 'avatarUrl',
} as const;

export const createPlayer = (
  uid: string,
  seatNumber: number,
  role: RoleName
): Player => ({
  uid,
  seatNumber,
  role,
  status: PlayerStatus.alive,
  skillStatus: SkillStatus.available,
});

export const playerToMap = (player: Player): Record<string, any> => ({
  [PLAYER_KEYS.uid]: player.uid,
  [PLAYER_KEYS.seatNumber]: player.seatNumber,
  [PLAYER_KEYS.role]: player.role,  // Store role name directly
  [PLAYER_KEYS.status]: player.status,
  [PLAYER_KEYS.skillStatus]: player.skillStatus,
  [PLAYER_KEYS.displayName]: player.displayName,
  [PLAYER_KEYS.avatarUrl]: player.avatarUrl,
});

export const playerFromMap = (map: Record<string, any>): Player => ({
  uid: map[PLAYER_KEYS.uid],
  seatNumber: map[PLAYER_KEYS.seatNumber],
  role: map[PLAYER_KEYS.role] as RoleName,  // Read role name directly
  status: map[PLAYER_KEYS.status] ?? PlayerStatus.alive,
  skillStatus: map[PLAYER_KEYS.skillStatus] ?? SkillStatus.available,
  displayName: map[PLAYER_KEYS.displayName],
  avatarUrl: map[PLAYER_KEYS.avatarUrl],
});

export const isPlayerAlive = (player: Player): boolean =>
  player.status === PlayerStatus.alive;

export const isPlayerSkillAvailable = (player: Player): boolean =>
  player.skillStatus === SkillStatus.available;
