/**
 * IGameRoomRPC — GameRoom Durable Object 的公开 RPC 方法契约。
 *
 * GameRoom 类必须 `implements IGameRoomRPC`，确保：
 * - Handler 调用的方法编译期存在
 * - 参数/返回类型一致
 * - 重构安全（改名/删方法触发编译错误）
 *
 * @remarks 所有方法运行在 DO 单线程上下文中，无并发竞争。
 *   返回 `GameActionResult`：`{success:true, state, revision}` 或 `{success:false, reason}`。
 *   绝不 throw HTTPException — 错误通过 result.reason 返回，由 Worker handler 层映射为 HTTP 状态码。
 */

import type { UpdatePlayerProfileAction } from '@werewolf/game-engine/engine/reducer/types';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { SeatActionParams } from '../schemas/game';
import type { GameActionResult } from './gameProcessor';

export interface IGameRoomRPC {
  // ── No-arg game control ─────────────────────────────────────────────────

  /**
   * 分配角色到座位。
   * @pre status === 'Setup' && 已入座人数 >= templateRoles.length
   * @pre 仅 host 可调用（内部使用 state.hostUserId）
   */
  assignRoles(): Promise<GameActionResult>;

  /**
   * 重置游戏回 Setup 状态（保留座位和 roster）。
   * @pre status === 'Ended' || status === 'Setup'
   * @pre 仅 host 可调用
   */
  restartGame(): Promise<GameActionResult>;

  /**
   * 清空所有座位（保留房间和模板）。
   * @pre status === 'Setup'
   * @pre 仅 host 可调用
   */
  clearAllSeats(): Promise<GameActionResult>;

  /**
   * 用 bot 填充所有空座位（调试模式）。
   * @pre status === 'Setup'
   * @pre 仅 host 可调用
   */
  fillWithBots(): Promise<GameActionResult>;

  /**
   * 标记所有 bot 已查看角色。
   * @pre status === 'Setup' && assignRoles 已完成
   * @pre 仅 host 可调用
   */
  markAllBotsViewed(): Promise<GameActionResult>;

  /**
   * 开始夜间流程：生成 nightPlan → 设 status=Ongoing → 广播首个音频。
   * @pre status === 'Setup' && 所有玩家 hasViewedRole === true
   * @pre 仅 host 可调用
   */
  startNight(): Promise<GameActionResult>;

  // ── Parameterized game actions ──────────────────────────────────────────

  /**
   * 座位操作：入座 / 离座 / 踢人。
   * @pre status === 'Setup'（入座/离座/踢人都仅 Setup 阶段允许）
   * @pre action='sit' → seat 必须为空，userId 不能已在其他座位
   * @pre action='kick' → 调用者必须是 host
   */
  seat(params: SeatActionParams): Promise<GameActionResult>;

  /**
   * 提交夜间行动。
   * @pre status === 'Ongoing'
   * @pre seatNum 对应的玩家角色 === role
   * @pre 该角色的当前步骤与 currentStepId 匹配
   * @pre 同一步骤同一座位不可重复提交（幂等：重复返回 rejection 而非 error）
   */
  submitAction(
    seatNum: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<GameActionResult>;

  /**
   * 标记玩家已查看自己的角色。
   * @pre userId 对应的 seatNum 有效且已分配角色
   */
  viewRole(userId: string, seatNum: number): Promise<GameActionResult>;

  /**
   * 更新模板角色配置。
   * @pre status === 'Setup'
   * @pre 仅 host 可调用
   */
  updateTemplate(templateRoles: RoleId[]): Promise<GameActionResult>;

  /**
   * 更新玩家画像（昵称 / 头像 / 装饰）。
   * @pre 调用者 userId 必须在 roster 中
   */
  updateProfile(payload: UpdatePlayerProfileAction['payload']): Promise<GameActionResult>;

  /**
   * Host 分享夜间详细信息给指定座位。
   * @pre status === 'Ended'
   * @pre 仅 host 可调用
   */
  shareReview(allowedSeats: number[]): Promise<GameActionResult>;

  // ── Board nomination ────────────────────────────────────────────────────

  /**
   * 提交板子建议（每人最多一条，后提交覆盖前）。
   * @pre status === 'Setup'
   * @pre userId 已在 roster 中（任何已连接玩家均可）
   */
  boardNominate(userId: string, displayName: string, roles: RoleId[]): Promise<GameActionResult>;

  /**
   * 为某建议投票。
   * @pre status === 'Setup'
   * @pre targetUserId 的建议存在
   * @pre 不可给自己投票
   */
  boardUpvote(voterUid: string, targetUserId: string): Promise<GameActionResult>;

  /**
   * 撤回自己的板子建议。
   * @pre status === 'Setup'
   * @pre userId 有已提交的建议
   */
  boardWithdraw(userId: string): Promise<GameActionResult>;

  // ── Night flow ──────────────────────────────────────────────────────────

  /**
   * 音频播放完成确认（Host 端调用）。
   * @pre isAudioPlaying === true || pendingAudioEffects.length > 0
   * @remarks 触发 inlineProgression：清除 audio 后可能连锁推进多个步骤。
   *   如果推进到 END_NIGHT 且 status 变为 Ended，同步触发 XP 结算。
   */
  audioAck(): Promise<GameActionResult>;

  /**
   * 设置音频播放状态（Host 端调用，标记开始/结束播放）。
   * @pre status === 'Ongoing' || status === 'Ended'
   * @pre 仅 host 可调用
   */
  audioGate(isPlaying: boolean): Promise<GameActionResult>;

  /**
   * 请求服务端执行内联推进（无-op trigger）。
   * @pre status === 'Ongoing'
   * @remarks 当客户端检测到应推进但未推进时调用（如 deadline 到期）。
   *   服务端执行 inlineProgression，可能连锁多步。
   */
  progression(): Promise<GameActionResult>;

  /**
   * 确认揭示信息已查看。
   * @pre pendingRevealAcks.length > 0
   */
  revealAck(): Promise<GameActionResult>;

  /**
   * 机械狼人学到猎人后的「已查看」确认。
   * @pre wolfRobotHunterStatusViewed === false
   * @pre seatNum 是机械狼人所在座位
   */
  wolfRobotViewed(seatNum: number): Promise<GameActionResult>;

  /**
   * 群体确认步骤的单人 ack（催眠揭示 / 转化揭示 / 情侣揭示）。
   * @pre status === 'Ongoing'
   * @pre currentStepId 对应 schema.kind === 'groupConfirm'
   * @pre seatNum 有效且 player.userId === userId（或 userId === hostUserId）
   * @remarks 幂等：已 ack 的座位重复调用返回空 success。
   */
  groupConfirmAck(seatNum: number, userId: string): Promise<GameActionResult>;

  /**
   * 批量标记所有 bot 已确认群体步骤。
   * @pre debugMode.botsEnabled === true
   * @pre status === 'Ongoing'
   * @pre currentStepId 对应 schema.kind === 'groupConfirm'
   */
  markBotsGroupConfirmed(): Promise<GameActionResult>;

  // ── Read-only ───────────────────────────────────────────────────────────

  /** 读取当前游戏状态 + revision。房间未初始化时返回 null。 */
  getState(): Promise<{ state: GameState; revision: number } | null>;

  /** 仅读取当前 revision 号（轻量级 poll 用）。房间未初始化时返回 null。 */
  getRevision(): Promise<number | null>;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * 初始化 DO 状态（INSERT OR REPLACE）。
   * @pre 仅在 room/create handler 中调用一次。幂等（重复调用覆盖）。
   */
  init(initialState: GameState): Promise<void>;

  /**
   * 清除 DO 所有持久化存储（deleteAll）。
   * @pre 仅在 room/delete handler 中调用。调用后 DO 实例不可再使用。
   */
  cleanup(): Promise<void>;
}
