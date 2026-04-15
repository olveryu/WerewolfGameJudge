/**
 * gameProcessor — DO 内部的读-算-写核心流程
 *
 * 替代旧 gameStateManager.ts 的 processGameAction。
 * DO 单线程序列化保证无并发冲突，无需 optimistic lock retry。
 * SQLite sql.exec 是同步的，多条 SQL 自动 coalesce 为原子事务。
 * 广播在同实例内完成，零网络开销。
 */

import type { HandlerResult, SideEffect } from '@werewolf/game-engine/engine/handlers/types';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import { runInlineProgression } from '@werewolf/game-engine/engine/inlineProgression';
import { gameReducer } from '@werewolf/game-engine/engine/reducer/gameReducer';
import type { StateAction } from '@werewolf/game-engine/engine/reducer/types';
import { normalizeState } from '@werewolf/game-engine/engine/state/normalize';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import type { AudioEffect } from '@werewolf/game-engine/protocol/types';

/** processAction 的最终返回值（与旧 GameActionResult 等价） */
export interface GameActionResult {
  success: boolean;
  reason?: string;
  state?: GameState;
  revision?: number;
  sideEffects?: readonly SideEffect[];
}

interface InlineProgressionOptions {
  enabled: boolean;
  nowMs?: number;
}

/** Find seat number by UID */
function findSeatByUid(state: GameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}

/** Build HandlerContext for game-engine pure handler functions */
export function buildHandlerContext(state: GameState, uid: string): HandlerContext {
  return {
    state,
    myUid: uid,
    mySeat: findSeatByUid(state, uid),
  };
}

/** Extract PLAY_AUDIO side effects into AudioEffect state actions. */
export function extractAudioActions(sideEffects: readonly SideEffect[] | undefined): StateAction[] {
  const audioEffects: AudioEffect[] = (sideEffects ?? [])
    .filter(
      (e): e is { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean } =>
        e.type === 'PLAY_AUDIO',
    )
    .map((e) => ({ audioKey: e.audioKey, isEndAudio: e.isEndAudio }));

  if (audioEffects.length === 0) return [];

  return [
    { type: 'SET_PENDING_AUDIO_EFFECTS', payload: { effects: audioEffects } },
    { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: true } },
  ];
}

/**
 * 核心读-算-写流程（DO 内部方法）
 *
 * 与旧 processGameAction 语义完全一致，但：
 * - 无 retry 循环（DO 单线程保证无并发冲突）
 * - SQLite sql.exec 是同步的，多条 SQL 自动 coalesce 为原子事务
 * - 广播由调用方在返回后执行
 */
export function processAction(
  sql: DurableObjectState['storage']['sql'],
  processFn: (state: GameState, revision: number) => HandlerResult,
  inlineProgression?: InlineProgressionOptions,
): GameActionResult {
  // 1. 读 SQLite（同步，零网络）
  const rows = sql.exec('SELECT game_state, revision FROM room_state WHERE id = 1').toArray();

  if (rows.length === 0) {
    return { success: false, reason: 'ROOM_NOT_FOUND' };
  }

  const state: GameState = JSON.parse(rows[0].game_state as string);
  const revision = rows[0].revision as number;

  // 2. 调用 game-engine 纯函数
  const result = processFn(state, revision);

  // error: 前置条件/基础设施失败 → 不持久化
  if (result.kind === 'error') {
    return { success: false, reason: result.reason };
  }

  // success | rejection: 都有 actions 需要 apply + persist + broadcast
  const isSuccess = result.kind === 'success';

  // 3. apply actions → 新 state
  let newState = state;
  let totalActionsApplied = 0;
  for (const action of result.actions) {
    newState = gameReducer(newState, action);
    totalActionsApplied++;
  }

  // 3.5. inline progression（可选，仅 success 时）
  if (isSuccess && inlineProgression?.enabled) {
    const prog = runInlineProgression(newState, newState.hostUid, inlineProgression.nowMs);
    for (const action of prog.actions) {
      newState = gameReducer(newState, action);
      totalActionsApplied++;
    }
  }

  // No-op guard
  if (totalActionsApplied === 0) {
    return {
      success: isSuccess,
      reason: result.reason,
      state,
      revision,
    };
  }

  newState = normalizeState(newState);
  const newRevision = revision + 1;

  // 4. 写 SQLite（与上面的 read 自动 coalesce 为原子事务）
  sql.exec(
    'UPDATE room_state SET game_state = ?, revision = ? WHERE id = 1',
    JSON.stringify(newState),
    newRevision,
  );

  return {
    success: isSuccess,
    reason: result.reason,
    state: newState,
    revision: newRevision,
    sideEffects: result.sideEffects,
  };
}
