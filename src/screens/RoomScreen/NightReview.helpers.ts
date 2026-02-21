/**
 * NightReview.helpers - 纯函数：从 LocalGameState 提取夜晚行动摘要与全员身份表
 *
 * 第一行摘要：将 currentNightResults / lastNightDeaths / 各查验 reveal 转为中文描述列表。
 * 第二部分：按座位号输出每位玩家的真实角色。
 * 不 import service / hook / React；仅依赖 game-engine 类型与 getRoleDisplayName。
 */

import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';

import type { LocalGameState, LocalPlayer } from '@/types/GameStateTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NightReviewData {
  /** 夜晚行动逐条描述 */
  actionLines: string[];
  /** 座位号 → 角色中文名 */
  identityLines: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Action summary builder
// ─────────────────────────────────────────────────────────────────────────────

/** Seat number → display string (1-indexed) */
function s(seat: number): string {
  return `${seat + 1}号`;
}

/**
 * Build action summary lines from night results + reveal fields.
 */
export function buildActionLines(gameState: LocalGameState): string[] {
  const lines: string[] = [];
  const nr = gameState.currentNightResults;

  // 1. Wolf kill vote
  if (nr.wolfVotesBySeat && Object.keys(nr.wolfVotesBySeat).length > 0) {
    const entries = Object.entries(nr.wolfVotesBySeat);
    const voteDesc = entries
      .map(([voter, target]) => `${s(Number(voter))}→${s(target)}`)
      .join('，');
    lines.push(`🐺 狼人投票：${voteDesc}`);
  }

  if (nr.wolfKillDisabled) {
    lines.push('🐺 狼人刀空（被梦魇封锁）');
  }

  // 2. Nightmare block
  if (nr.blockedSeat != null) {
    lines.push(`😈 梦魇封锁了 ${s(nr.blockedSeat)}`);
  }

  // 3. Guard
  if (nr.guardedSeat != null) {
    lines.push(`🛡️ 守卫守护了 ${s(nr.guardedSeat)}`);
  }

  // 4. Witch
  if (nr.savedSeat != null) {
    lines.push(`💊 女巫救了 ${s(nr.savedSeat)}`);
  }
  if (nr.poisonedSeat != null) {
    lines.push(`☠️ 女巫毒了 ${s(nr.poisonedSeat)}`);
  }

  // 5. Dreamcatcher
  if (nr.dreamingSeat != null) {
    lines.push(`🌙 追梦人守护了 ${s(nr.dreamingSeat)}`);
  }

  // 6. Magician swap
  if (nr.swappedSeats) {
    lines.push(`🎩 魔术师交换了 ${s(nr.swappedSeats[0])} 和 ${s(nr.swappedSeats[1])}`);
  }

  // 7. Check reveals (seer family + others)
  const revealFields = [
    { key: 'seerReveal' as const, label: '预言家' },
    { key: 'mirrorSeerReveal' as const, label: '镜像预言家' },
    { key: 'drunkSeerReveal' as const, label: '酒鬼预言家' },
    { key: 'psychicReveal' as const, label: '通灵师' },
    { key: 'gargoyleReveal' as const, label: '石像鬼' },
    { key: 'pureWhiteReveal' as const, label: '纯白' },
    { key: 'wolfWitchReveal' as const, label: '狼巫' },
  ] as const;

  for (const { key, label } of revealFields) {
    const reveal = gameState[key];
    if (reveal) {
      lines.push(`🔍 ${label}查验 ${s(reveal.targetSeat)}：${reveal.result}`);
    }
  }

  // 8. WolfRobot learn
  if (gameState.wolfRobotReveal) {
    const wr = gameState.wolfRobotReveal;
    lines.push(`🤖 机械狼学习了 ${s(wr.targetSeat)}（${getRoleDisplayName(wr.learnedRoleId)}）`);
  }

  // 9. Final deaths
  const deaths = gameState.lastNightDeaths;
  if (deaths.length === 0) {
    lines.push('✅ 昨夜平安夜');
  } else {
    const deathList = deaths.map((d) => s(d)).join('、');
    lines.push(`💀 死亡：${deathList}`);
  }

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity table builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build per-seat identity lines: "1号: 狼人" etc.
 */
export function buildIdentityLines(players: Map<number, LocalPlayer | null>): string[] {
  const lines: string[] = [];
  const seats = Array.from(players.keys()).sort((a, b) => a - b);

  for (const seat of seats) {
    const player = players.get(seat);
    if (!player) {
      lines.push(`${seat + 1}号: 空座`);
      continue;
    }
    const roleName = player.role ? getRoleDisplayName(player.role) : '未分配';
    lines.push(`${seat + 1}号: ${roleName}`);
  }

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build full night review data from game state.
 */
export function buildNightReviewData(gameState: LocalGameState): NightReviewData {
  return {
    actionLines: buildActionLines(gameState),
    identityLines: buildIdentityLines(gameState.players),
  };
}
