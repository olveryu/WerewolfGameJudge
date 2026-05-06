/**
 * IGameRoomRPC — GameRoom Durable Object 的公开 RPC 方法契约。
 *
 * GameRoom 类必须 `implements IGameRoomRPC`，确保：
 * - Handler 调用的方法编译期存在
 * - 参数/返回类型一致
 * - 重构安全（改名/删方法触发编译错误）
 */

import type { UpdatePlayerProfileAction } from '@werewolf/game-engine/engine/reducer/types';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { SeatActionParams } from '../schemas/game';
import type { GameActionResult } from './gameProcessor';

export interface IGameRoomRPC {
  // ── No-arg game control ─────────────────────────────────────────────────
  assignRoles(): Promise<GameActionResult>;
  restartGame(): Promise<GameActionResult>;
  clearAllSeats(): Promise<GameActionResult>;
  fillWithBots(): Promise<GameActionResult>;
  markAllBotsViewed(): Promise<GameActionResult>;
  startNight(): Promise<GameActionResult>;

  // ── Parameterized game actions ──────────────────────────────────────────
  seat(params: SeatActionParams): Promise<GameActionResult>;
  submitAction(
    seatNum: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<GameActionResult>;
  viewRole(userId: string, seatNum: number): Promise<GameActionResult>;
  updateTemplate(templateRoles: RoleId[]): Promise<GameActionResult>;
  updateProfile(payload: UpdatePlayerProfileAction['payload']): Promise<GameActionResult>;
  shareReview(allowedSeats: number[]): Promise<GameActionResult>;

  // ── Board nomination ────────────────────────────────────────────────────
  boardNominate(userId: string, displayName: string, roles: RoleId[]): Promise<GameActionResult>;
  boardUpvote(voterUid: string, targetUserId: string): Promise<GameActionResult>;
  boardWithdraw(userId: string): Promise<GameActionResult>;

  // ── Night flow ──────────────────────────────────────────────────────────
  audioAck(): Promise<GameActionResult>;
  audioGate(isPlaying: boolean): Promise<GameActionResult>;
  progression(): Promise<GameActionResult>;
  revealAck(): Promise<GameActionResult>;
  wolfRobotViewed(seatNum: number): Promise<GameActionResult>;
  groupConfirmAck(seatNum: number, userId: string): Promise<GameActionResult>;
  markBotsGroupConfirmed(): Promise<GameActionResult>;

  // ── Read-only ───────────────────────────────────────────────────────────
  getState(): Promise<{ state: GameState; revision: number } | null>;
  getRevision(): Promise<number | null>;

  // ── Lifecycle ───────────────────────────────────────────────────────────
  init(initialState: GameState): Promise<void>;
  cleanup(): Promise<void>;
}
