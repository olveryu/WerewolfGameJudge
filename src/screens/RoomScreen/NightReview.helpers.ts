/**
 * NightReview.helpers - 纯函数：从 LocalGameState 提取夜晚行动摘要与全员身份表
 *
 * 第一行摘要：将 currentNightResults / lastNightDeaths / 各查验 reveal 转为中文描述列表。
 * 第二部分：按座位号输出每位玩家的真实角色。
 * 不 import service / hook / React；仅依赖 game-engine 类型与 getRoleDisplayName。
 */

import type { DeathReason } from '@werewolf/game-engine/engine/DeathCalculator';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { getRoleDisplayName, getRoleEmoji, ROLE_SPECS } from '@werewolf/game-engine/models/roles';
import { Team } from '@werewolf/game-engine/models/roles/spec/types';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';

import { ACTION, STATUS } from '@/config/emojiTokens';
import type { LocalGameState, LocalPlayer } from '@/types/GameStateTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Death reason labels
// ─────────────────────────────────────────────────────────────────────────────

const DEATH_REASON_LABELS: Record<DeathReason, string> = {
  wolfKill: '狼杀',
  poison: '毒杀',
  checkDeath: '查验致死',
  wolfQueenLink: '魅惑连锁',
  bondedLink: '绑定连锁',
  coupleLink: '殉情',
  dreamcatcherLink: '摄梦连锁',
  reflection: '反伤',
  magicianSwap: '魔术师交换',
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Find the seat of a player with the given role (0-based), or undefined. */
function findSeatByRole(
  players: Map<number, LocalPlayer | null>,
  roleId: RoleId,
): number | undefined {
  for (const [seat, player] of players) {
    if (player?.role === roleId) return seat;
  }
  return undefined;
}

/**
 * 判断某座位是否会在夜间死亡（被狼刀且未被救/被毒杀）。
 * 用于连锁死亡判断的子条件。
 */
function willDieTonight(seat: number, gameState: LocalGameState): boolean {
  const nr = gameState.currentNightResults;

  if (nr.poisonedSeat === seat) return true;

  const wolfKillTarget = gameState.witchContext?.killedSeat;
  if (wolfKillTarget !== undefined && wolfKillTarget >= 0 && wolfKillTarget === seat) {
    if (nr.savedSeat === seat) return false;
    return true;
  }

  return false;
}

/**
 * 判断某座位的猎人/黑狼王是否可以开枪。
 *
 * 仅被狼人袭击或公投放逐出局时可发动。
 * 夜间非正常死亡（毒杀/殉情/摄梦连锁/魅惑连锁）均不能开枪。
 */
function canShootForSeat(seat: number, gameState: LocalGameState): boolean {
  const nr = gameState.currentNightResults;

  // 被毒杀
  if (nr.poisonedSeat === seat) return false;

  // 殉情
  const loverSeats = gameState.loverSeats;
  if (loverSeats && loverSeats.includes(seat)) {
    const partnerSeat = loverSeats[0] === seat ? loverSeats[1] : loverSeats[0];
    if (willDieTonight(partnerSeat, gameState)) return false;
  }

  // 摄梦连锁
  if (nr.dreamingSeat === seat) {
    const dcSeat = findSeatByRole(gameState.players, 'dreamcatcher' as RoleId);
    if (dcSeat !== undefined && willDieTonight(dcSeat, gameState)) return false;
  }

  // 狼美人魅惑连锁
  if (nr.charmedSeat === seat) {
    const wqSeat = findSeatByRole(gameState.players, 'wolfQueen' as RoleId);
    if (wqSeat !== undefined && willDieTonight(wqSeat, gameState)) return false;
  }

  return true;
}

/** Resolve wolf kill target from majority vote. Tie = no kill. */
function resolveWolfKillTarget(
  wolfVotesBySeat: Readonly<Record<string, number>> | undefined,
): number | undefined {
  if (!wolfVotesBySeat) return undefined;
  const entries = Object.entries(wolfVotesBySeat);
  if (entries.length === 0) return undefined;
  const counts = new Map<number, number>();
  for (const [, target] of entries) {
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  let maxCount = 0;
  let maxTarget: number | undefined;
  let tied = false;
  for (const [target, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxTarget = target;
      tied = false;
    } else if (count === maxCount) {
      tied = true;
    }
  }
  return tied ? undefined : maxTarget;
}

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

/**
 * Build action summary lines from night results + reveal fields.
 */
export function buildActionLines(gameState: LocalGameState): string[] {
  const lines: string[] = [];
  const nr = gameState.currentNightResults;

  // 0. TreasureMaster: bottom cards composition + card choice + skipped roles
  if (gameState.bottomCards && gameState.bottomCards.length > 0) {
    const cardNames = gameState.bottomCards.map((id) => getRoleDisplayName(id)).join('、');
    lines.push(`${getRoleEmoji('treasureMaster' as RoleId)} 底牌组成：${cardNames}`);
  }
  if (gameState.treasureMasterChosenCard) {
    const chosenName = getRoleDisplayName(gameState.treasureMasterChosenCard as RoleId);
    lines.push(`${getRoleEmoji('treasureMaster' as RoleId)} 盗宝大师选择了 ${chosenName}`);
  }
  if (gameState.thiefChosenCard) {
    const chosenName = getRoleDisplayName(gameState.thiefChosenCard as RoleId);
    lines.push(`${getRoleEmoji('thief' as RoleId)} 盗贼选择了 ${chosenName}`);
  }
  if (gameState.loverSeats && gameState.loverSeats.length === 2) {
    lines.push(
      `${getRoleEmoji('cupid' as RoleId)} 丘比特连线了 ${formatSeat(gameState.loverSeats[0])} 和 ${formatSeat(gameState.loverSeats[1])}`,
    );
  }

  // 1. Wolf kill vote
  if (nr.wolfVotesBySeat && Object.keys(nr.wolfVotesBySeat).length > 0) {
    const entries = Object.entries(nr.wolfVotesBySeat);
    const voteDesc = entries
      .map(([voter, target]) => `${formatSeat(Number(voter))}→${formatSeat(target)}`)
      .join('，');
    lines.push(`${getRoleEmoji('wolf' as RoleId)} 狼人袭击：${voteDesc}`);
  } else if (
    !nr.wolfKillOverride &&
    Array.from(gameState.players.values()).some(
      (p) => p?.role && ROLE_SPECS[p.role]?.team === Team.Wolf,
    )
  ) {
    lines.push(`${getRoleEmoji('wolf' as RoleId)} 狼人空刀（未选择目标）`);
  }

  if (nr.wolfKillOverride) {
    const reason = nr.wolfKillOverride.source === 'poisoner' ? '毒师在场' : '被梦魇封锁';
    lines.push(`${getRoleEmoji('wolf' as RoleId)} 狼人放弃袭击（${reason}）`);
  }

  // 2. Nightmare block
  if (nr.blockedSeat != null) {
    const blockedPlayer = gameState.players.get(nr.blockedSeat);
    const roleSuffix = blockedPlayer?.role
      ? `（${getRoleDisplayName(blockedPlayer.role)}，技能无效）`
      : '';
    lines.push(
      `${getRoleEmoji('nightmare' as RoleId)} 梦魇封锁了 ${formatSeat(nr.blockedSeat)}${roleSuffix}`,
    );
  }

  // 3. Guard
  if (nr.guardedSeat != null) {
    lines.push(`${ACTION.GUARD} 守卫守护了 ${formatSeat(nr.guardedSeat)}`);
  } else {
    const guardSeat = findSeatByRole(gameState.players, 'guard' as RoleId);
    if (guardSeat !== undefined && nr.blockedSeat !== guardSeat) {
      lines.push(`${ACTION.GUARD} 守卫未守护`);
    }
  }

  // 3a. SilenceElder
  if (nr.silencedSeat != null) {
    lines.push(
      `${getRoleEmoji('silenceElder' as RoleId)} 禁言长老禁言了 ${formatSeat(nr.silencedSeat)}`,
    );
  }

  // 3b. VotebanElder
  if (nr.votebannedSeat != null) {
    lines.push(
      `${getRoleEmoji('votebanElder' as RoleId)} 禁票长老禁票了 ${formatSeat(nr.votebannedSeat)}`,
    );
  }

  // 4. Witch / Poisoner
  if (nr.savedSeat != null) {
    lines.push(`${ACTION.SAVE} 女巫使用解药救了 ${formatSeat(nr.savedSeat)}`);
  }
  if (nr.poisonedSeat != null) {
    const isPoisoner = findSeatByRole(gameState.players, 'poisoner' as RoleId) !== undefined;
    const poisonLabel = isPoisoner ? '毒师毒杀了' : '女巫使用毒药毒杀了';
    lines.push(`${ACTION.POISON} ${poisonLabel} ${formatSeat(nr.poisonedSeat)}`);
  }

  // 4x. Witch/Poisoner "did nothing" annotations
  {
    const witchSeat = findSeatByRole(gameState.players, 'witch' as RoleId);
    const poisonerSeat = findSeatByRole(gameState.players, 'poisoner' as RoleId);
    const witchBlocked = witchSeat !== undefined && nr.blockedSeat === witchSeat;
    const poisonerBlocked = poisonerSeat !== undefined && nr.blockedSeat === poisonerSeat;

    if (witchSeat !== undefined && !witchBlocked) {
      const noSave = nr.savedSeat == null;
      const witchOwnsPoison = poisonerSeat === undefined;
      const noPoison = nr.poisonedSeat == null;

      if (noSave && witchOwnsPoison && noPoison) {
        lines.push(`${ACTION.SAVE} 女巫未使用药水`);
      } else {
        if (noSave) lines.push(`${ACTION.SAVE} 女巫未使用解药`);
        if (witchOwnsPoison && noPoison) lines.push(`${ACTION.POISON} 女巫未使用毒药`);
      }
    }
    if (poisonerSeat !== undefined && !poisonerBlocked && nr.poisonedSeat == null) {
      lines.push(`${ACTION.POISON} 毒师未使用毒药`);
    }
  }

  // 4a. Crow curse
  if (nr.cursedSeat != null) {
    lines.push(`${getRoleEmoji('crow' as RoleId)} 乌鸦诅咒了 ${formatSeat(nr.cursedSeat)}`);
  }

  // 5. Dreamcatcher
  if (nr.dreamingSeat != null) {
    lines.push(
      `${getRoleEmoji('dreamcatcher' as RoleId)} 摄梦人摄梦了 ${formatSeat(nr.dreamingSeat)}`,
    );
  }

  // 6. Magician swap
  if (nr.swappedSeats) {
    lines.push(
      `${getRoleEmoji('magician' as RoleId)} 魔术师交换了 ${formatSeat(nr.swappedSeats[0])} 和 ${formatSeat(nr.swappedSeats[1])}`,
    );
  }

  // 6a. Slacker idol (from actions Map)
  const slackerAction = gameState.actions.get('slacker' as RoleId);
  if (slackerAction && slackerAction.kind === 'target') {
    lines.push(
      `${getRoleEmoji('slacker' as RoleId)} 混子选择了 ${formatSeat(slackerAction.targetSeat)} 为榜样`,
    );
  }

  // 6b. WildChild idol (from actions Map)
  const wildChildAction = gameState.actions.get('wildChild' as RoleId);
  if (wildChildAction && wildChildAction.kind === 'target') {
    lines.push(
      `${getRoleEmoji('wildChild' as RoleId)} 野孩子选择了 ${formatSeat(wildChildAction.targetSeat)} 为榜样`,
    );
  }

  // 6b2. Shadow mimic
  if (nr.shadowMimicTarget != null) {
    const mimicInfo =
      nr.avengerFaction === Team.Third
        ? `${getRoleEmoji('shadow' as RoleId)} 影子模仿了 ${formatSeat(nr.shadowMimicTarget)}（绑定）`
        : `${getRoleEmoji('shadow' as RoleId)} 影子模仿了 ${formatSeat(nr.shadowMimicTarget)}`;
    lines.push(mimicInfo);
  }

  // 6b3. Avenger faction (always participates, just show presence)
  const avengerSeat = findSeatByRole(gameState.players, 'avenger' as RoleId);
  if (avengerSeat !== undefined) {
    lines.push(`${getRoleEmoji('avenger' as RoleId)} 复仇者已确认阵营`);
  }

  // 6c. WolfQueen charm (from actions Map)
  const wolfQueenAction = gameState.actions.get('wolfQueen' as RoleId);
  if (wolfQueenAction && wolfQueenAction.kind === 'target') {
    lines.push(`${ACTION.CHARM} 狼美人魅惑了 ${formatSeat(wolfQueenAction.targetSeat)}`);
  }

  // 6d. AwakenedGargoyle convert
  if (nr.convertedSeat != null) {
    lines.push(
      `${getRoleEmoji('awakenedGargoyle' as RoleId)} 觉醒石像鬼转化了 ${formatSeat(nr.convertedSeat)}`,
    );
  }

  // 6e. Piper hypnotize
  if (nr.hypnotizedSeats && nr.hypnotizedSeats.length > 0) {
    const hypnotizedList = (nr.hypnotizedSeats as readonly number[])
      .map((seat) => formatSeat(seat))
      .join('、');
    lines.push(`${getRoleEmoji('piper' as RoleId)} 吹笛者催眠了 ${hypnotizedList}`);
  }

  // 7. Check reveals (seer family + others)
  const revealFields = [
    { key: 'seerReveal' as const, label: '预言家' },
    { key: 'mirrorSeerReveal' as const, label: '灯影预言家' },
    { key: 'drunkSeerReveal' as const, label: '酒鬼预言家' },
    { key: 'psychicReveal' as const, label: '通灵师' },
    { key: 'gargoyleReveal' as const, label: '石像鬼' },
    { key: 'pureWhiteReveal' as const, label: '纯白之女' },
    { key: 'wolfWitchReveal' as const, label: '狼巫' },
  ] as const;

  for (const { key, label } of revealFields) {
    const reveal = gameState[key];
    if (reveal) {
      lines.push(`${ACTION.CHECK} ${label}查验 ${formatSeat(reveal.targetSeat)}：${reveal.result}`);
    }
  }

  // 8. WolfRobot learn
  if (gameState.wolfRobotReveal) {
    const wr = gameState.wolfRobotReveal;
    lines.push(
      `${ACTION.LEARN} 机械狼学习了 ${formatSeat(wr.targetSeat)}（${getRoleDisplayName(wr.learnedRoleId)}）`,
    );
  }

  // 9. Hunter / DarkWolfKing canShoot status
  // confirmStatus is cleared on step advance, so we re-derive canShoot.
  // Rule: 仅被狼人袭击或公投放逐出局时可发动。
  // 夜间非正常死亡（毒杀/殉情/摄梦连锁/魅惑连锁）均不能开枪。
  const hunterSeat = findSeatByRole(gameState.players, 'hunter' as RoleId);
  if (hunterSeat !== undefined) {
    const canShoot = canShootForSeat(hunterSeat, gameState);
    lines.push(canShoot ? `${ACTION.SHOOT} 猎人可以发动技能` : `${ACTION.SHOOT} 猎人不能发动技能`);
  }

  const darkWolfKingSeat = findSeatByRole(gameState.players, 'darkWolfKing' as RoleId);
  if (darkWolfKingSeat !== undefined) {
    const canShoot = canShootForSeat(darkWolfKingSeat, gameState);
    lines.push(
      canShoot
        ? `${getRoleEmoji('darkWolfKing' as RoleId)} 黑狼王可以发动技能`
        : `${getRoleEmoji('darkWolfKing' as RoleId)} 黑狼王不能发动技能`,
    );
  }

  // ── Interaction annotations ──

  // 同守同救 warning
  const wolfTarget = resolveWolfKillTarget(nr.wolfVotesBySeat);
  if (wolfTarget !== undefined && nr.guardedSeat === wolfTarget && nr.savedSeat === wolfTarget) {
    lines.push(`⚠️ 同守同救：${formatSeat(wolfTarget)} 仍然死亡`);
  }

  // Poison immunity warning
  if (nr.poisonedSeat != null) {
    const poisonedPlayer = gameState.players.get(nr.poisonedSeat);
    if (poisonedPlayer?.role) {
      const hasImmunity = ROLE_SPECS[poisonedPlayer.role]?.abilities?.some(
        (a) => a.type === 'passive' && a.effect === 'immuneToPoison',
      );
      if (hasImmunity) {
        lines.push(
          `⚠️ ${formatSeat(nr.poisonedSeat)}（${getRoleDisplayName(poisonedPlayer.role)}）免疫毒药`,
        );
      }
    }
  }

  // Damage reflection warning
  const revealChecks = [
    { key: 'seerReveal' as const, roleId: 'seer' as RoleId },
    { key: 'mirrorSeerReveal' as const, roleId: 'mirrorSeer' as RoleId },
    { key: 'drunkSeerReveal' as const, roleId: 'drunkSeer' as RoleId },
    { key: 'psychicReveal' as const, roleId: 'psychic' as RoleId },
    { key: 'gargoyleReveal' as const, roleId: 'gargoyle' as RoleId },
    { key: 'pureWhiteReveal' as const, roleId: 'pureWhite' as RoleId },
    { key: 'wolfWitchReveal' as const, roleId: 'wolfWitch' as RoleId },
  ];
  for (const { key, roleId } of revealChecks) {
    const reveal = gameState[key];
    if (reveal) {
      const targetPlayer = gameState.players.get(reveal.targetSeat);
      if (targetPlayer?.role) {
        const reflects = ROLE_SPECS[targetPlayer.role]?.abilities?.some(
          (a) => a.type === 'passive' && a.effect === 'reflectsDamage',
        );
        if (reflects) {
          lines.push(
            `⚠️ ${getRoleDisplayName(roleId)} 查验了 ${formatSeat(reveal.targetSeat)}（${getRoleDisplayName(targetPlayer.role)}），遭到反伤`,
          );
        }
      }
    }
  }

  // 10. Final deaths
  const deaths = gameState.lastNightDeaths;
  if (deaths.length === 0) {
    lines.push(`${STATUS.PEACEFUL_NIGHT} 昨夜平安夜`);
  } else {
    const { deathReasons } = gameState;
    const deathList = deaths
      .map((d) => {
        const reason = deathReasons?.[d];
        return reason ? `${formatSeat(d)}（${DEATH_REASON_LABELS[reason]}）` : formatSeat(d);
      })
      .join('、');
    lines.push(`${STATUS.DEATH} 死亡：${deathList}`);
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
      lines.push(`${formatSeat(seat)}: 空座`);
      continue;
    }
    const roleName = player.role ? getRoleDisplayName(player.role) : '未分配';
    lines.push(`${formatSeat(seat)}: ${roleName}`);
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
