/**
 * NightReview.helpers - Pure functions: extract night action summary and full identity table from LocalWerewolfState
 *
 * First section: convert currentNightResults / lastNightDeaths / all check reveals to Chinese description list.
 * Second section: output each player's real role by seat number.
 * No service / hook / React imports; relies only on game-engine types and getRoleDisplayName.
 */

import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';
import type { DeathReason } from '@werewolf/game-engine/werewolf/DeathCalculator';
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import {
  getRoleDisplayName,
  getRoleEmoji,
  ROLE_SPECS,
} from '@werewolf/game-engine/werewolf/models/roles';
import { Team } from '@werewolf/game-engine/werewolf/models/roles/spec/types';

import { ACTION, STATUS } from '@/config/emojiTokens';
import type { LocalWerewolfPlayer, LocalWerewolfState } from '@/hooks/adapters/werewolfStateTypes';

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
  players: Map<number, LocalWerewolfPlayer | null>,
  roleId: RoleId,
): number | undefined {
  for (const [seat, player] of players) {
    if (player?.role === roleId) return seat;
  }
  return undefined;
}

/**
 * Whether the seat will die tonight (wolf-killed without save, or poisoned).
 * Used as a sub-condition for chain-death determination.
 */
function willDieTonight(seat: number, gameState: LocalWerewolfState): boolean {
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
 * Whether the seat's Hunter/Dark Wolf King can shoot.
 *
 * Can only trigger when wolf-killed or exile-voted out.
 * Cannot shoot on abnormal night death (poison / lover suicide / dreamcatcher chain / charm chain).
 */
function canShootForSeat(seat: number, gameState: LocalWerewolfState): boolean {
  const nr = gameState.currentNightResults;

  // Poisoned
  if (nr.poisonedSeat === seat) return false;

  // Lover suicide
  const loverSeats = gameState.loverSeats;
  if (loverSeats && loverSeats.includes(seat)) {
    const partnerSeat = loverSeats[0] === seat ? loverSeats[1] : loverSeats[0];
    if (willDieTonight(partnerSeat, gameState)) return false;
  }

  // Dreamcatcher chain
  if (nr.dreamingSeat === seat) {
    const dcSeat = findSeatByRole(gameState.players, 'dreamcatcher');
    if (dcSeat !== undefined && willDieTonight(dcSeat, gameState)) return false;
  }

  // Eclipse Wolf Queen charm chain
  if (nr.charmedSeat === seat) {
    const wqSeat = findSeatByRole(gameState.players, 'wolfQueen');
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
  /** Per-action descriptions of the night */
  actionLines: string[];
  /** Seat number -> Chinese role name */
  identityLines: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Action summary builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build action summary lines from night results + reveal fields.
 */
export function buildActionLines(gameState: LocalWerewolfState): string[] {
  const lines: string[] = [];
  const nr = gameState.currentNightResults;

  // 0. TreasureMaster: bottom cards composition + card choice + skipped roles
  if (gameState.bottomCards && gameState.bottomCards.length > 0) {
    const cardNames = gameState.bottomCards.map((id) => getRoleDisplayName(id)).join('、');
    lines.push(`${getRoleEmoji('treasureMaster')} 底牌组成：${cardNames}`);
  }
  if (gameState.treasureMasterChosenCard) {
    const chosenName = getRoleDisplayName(gameState.treasureMasterChosenCard);
    lines.push(`${getRoleEmoji('treasureMaster')} 盗宝大师选择了 ${chosenName}`);
  }
  if (gameState.thiefChosenCard) {
    const chosenName = getRoleDisplayName(gameState.thiefChosenCard);
    lines.push(`${getRoleEmoji('thief')} 盗贼选择了 ${chosenName}`);
  }
  if (gameState.loverSeats && gameState.loverSeats.length === 2) {
    lines.push(
      `${getRoleEmoji('cupid')} 丘比特连线了 ${formatSeat(gameState.loverSeats[0])} 和 ${formatSeat(gameState.loverSeats[1])}`,
    );
  }

  // 1. Wolf kill vote
  if (nr.wolfVotesBySeat && Object.keys(nr.wolfVotesBySeat).length > 0) {
    const entries = Object.entries(nr.wolfVotesBySeat);
    const voteDesc = entries
      .map(([voter, target]) => `${formatSeat(Number(voter))}→${formatSeat(target)}`)
      .join('，');
    lines.push(`${getRoleEmoji('wolf')} 狼人袭击：${voteDesc}`);
  } else if (
    !nr.wolfKillOverride &&
    Array.from(gameState.players.values()).some(
      (p) => p?.role && ROLE_SPECS[p.role]?.team === Team.Wolf,
    )
  ) {
    lines.push(`${getRoleEmoji('wolf')} 狼人空刀（未选择目标）`);
  }

  if (nr.wolfKillOverride) {
    const reason =
      nr.wolfKillOverride.source === 'poisoner'
        ? '毒师在场'
        : `被${getRoleDisplayName('nightmare')}封锁`;
    lines.push(`${getRoleEmoji('wolf')} 狼人放弃袭击（${reason}）`);
  }

  // 2. Nightmare block
  if (nr.blockedSeat != null) {
    const blockedPlayer = gameState.players.get(nr.blockedSeat);
    const roleSuffix = blockedPlayer?.role
      ? `（${getRoleDisplayName(blockedPlayer.role)}，技能无效）`
      : '';
    lines.push(
      `${getRoleEmoji('nightmare')} ${getRoleDisplayName('nightmare')}封锁了 ${formatSeat(nr.blockedSeat)}${roleSuffix}`,
    );
  } else {
    const nightmareSeat = findSeatByRole(gameState.players, 'nightmare');
    if (nightmareSeat !== undefined) {
      lines.push(`${getRoleEmoji('nightmare')} ${getRoleDisplayName('nightmare')}未封锁`);
    }
  }

  // 2a. EclipseWolfQueen shelter
  if (nr.shelteredSeat != null) {
    lines.push(
      `${getRoleEmoji('eclipseWolfQueen')} ${getRoleDisplayName('eclipseWolfQueen')}庇护了 ${formatSeat(nr.shelteredSeat)}`,
    );
  } else {
    const eqSeat = findSeatByRole(gameState.players, 'eclipseWolfQueen');
    if (eqSeat !== undefined && nr.blockedSeat !== eqSeat) {
      lines.push(
        `${getRoleEmoji('eclipseWolfQueen')} ${getRoleDisplayName('eclipseWolfQueen')}未庇护`,
      );
    }
  }

  // 2b. HiddenWolf reveal (confirm-only — just show presence)
  const hiddenWolfSeat = findSeatByRole(gameState.players, 'hiddenWolf');
  if (hiddenWolfSeat !== undefined) {
    lines.push(`${getRoleEmoji('hiddenWolf')} ${getRoleDisplayName('hiddenWolf')}已确认狼同伴`);
  }

  // 3. Guard
  if (nr.guardedSeat != null) {
    lines.push(`${ACTION.GUARD} 守卫守护了 ${formatSeat(nr.guardedSeat)}`);
  } else {
    const guardSeat = findSeatByRole(gameState.players, 'guard');
    if (guardSeat !== undefined && nr.blockedSeat !== guardSeat) {
      lines.push(`${ACTION.GUARD} 守卫未守护`);
    }
  }

  // 3a. SilenceElder
  if (nr.silencedSeat != null) {
    lines.push(`${getRoleEmoji('silenceElder')} 禁言长老禁言了 ${formatSeat(nr.silencedSeat)}`);
  } else {
    const seSeat = findSeatByRole(gameState.players, 'silenceElder');
    if (seSeat !== undefined && nr.blockedSeat !== seSeat) {
      lines.push(`${getRoleEmoji('silenceElder')} 禁言长老未禁言`);
    }
  }

  // 3b. VotebanElder
  if (nr.votebannedSeat != null) {
    lines.push(`${getRoleEmoji('votebanElder')} 禁票长老禁票了 ${formatSeat(nr.votebannedSeat)}`);
  } else {
    const veSeat = findSeatByRole(gameState.players, 'votebanElder');
    if (veSeat !== undefined && nr.blockedSeat !== veSeat) {
      lines.push(`${getRoleEmoji('votebanElder')} 禁票长老未禁票`);
    }
  }

  // 4. Witch / Poisoner
  if (nr.savedSeat != null) {
    lines.push(`${ACTION.SAVE} 女巫使用解药救了 ${formatSeat(nr.savedSeat)}`);
  }
  if (nr.poisonedSeat != null) {
    const isPoisoner = findSeatByRole(gameState.players, 'poisoner') !== undefined;
    const poisonLabel = isPoisoner ? '毒师毒杀了' : '女巫使用毒药毒杀了';
    lines.push(`${ACTION.POISON} ${poisonLabel} ${formatSeat(nr.poisonedSeat)}`);
  }

  // 4x. Witch/Poisoner "did nothing" annotations
  {
    const witchSeat = findSeatByRole(gameState.players, 'witch');
    const poisonerSeat = findSeatByRole(gameState.players, 'poisoner');
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
    lines.push(`${getRoleEmoji('crow')} 乌鸦诅咒了 ${formatSeat(nr.cursedSeat)}`);
  } else {
    const crowSeat = findSeatByRole(gameState.players, 'crow');
    if (crowSeat !== undefined && nr.blockedSeat !== crowSeat) {
      lines.push(`${getRoleEmoji('crow')} 乌鸦未诅咒`);
    }
  }

  // 5. Dreamcatcher
  if (nr.dreamingSeat != null) {
    lines.push(`${getRoleEmoji('dreamcatcher')} 摄梦人摄梦了 ${formatSeat(nr.dreamingSeat)}`);
  } else {
    const dcSeat = findSeatByRole(gameState.players, 'dreamcatcher');
    if (dcSeat !== undefined && nr.blockedSeat !== dcSeat) {
      lines.push(`${getRoleEmoji('dreamcatcher')} 摄梦人未摄梦`);
    }
  }

  // 6. Magician swap
  if (nr.swappedSeats) {
    lines.push(
      `${getRoleEmoji('magician')} 魔术师交换了 ${formatSeat(nr.swappedSeats[0])} 和 ${formatSeat(nr.swappedSeats[1])}`,
    );
  } else {
    const magicianSeat = findSeatByRole(gameState.players, 'magician');
    if (magicianSeat !== undefined && nr.blockedSeat !== magicianSeat) {
      lines.push(`${getRoleEmoji('magician')} 魔术师未交换`);
    }
  }

  // 6a. Slacker idol (from actions Map)
  const slackerAction = gameState.actions.get('slacker');
  if (slackerAction && slackerAction.kind === 'target') {
    lines.push(
      `${getRoleEmoji('slacker')} ${getRoleDisplayName('slacker')}选择了 ${formatSeat(slackerAction.targetSeat)} 为榜样`,
    );
  }

  // 6b. WildChild idol (from actions Map)
  const wildChildAction = gameState.actions.get('wildChild');
  if (wildChildAction && wildChildAction.kind === 'target') {
    lines.push(
      `${getRoleEmoji('wildChild')} 野孩子选择了 ${formatSeat(wildChildAction.targetSeat)} 为榜样`,
    );
  }

  // 6b2. Shadow mimic
  if (nr.shadowMimicTarget != null) {
    const mimicInfo =
      nr.avengerFaction === Team.Third
        ? `${getRoleEmoji('shadow')} 影子模仿了 ${formatSeat(nr.shadowMimicTarget)}（绑定）`
        : `${getRoleEmoji('shadow')} 影子模仿了 ${formatSeat(nr.shadowMimicTarget)}`;
    lines.push(mimicInfo);
  }

  // 6b3. Avenger faction (always participates, just show presence)
  const avengerSeat = findSeatByRole(gameState.players, 'avenger');
  if (avengerSeat !== undefined) {
    lines.push(`${getRoleEmoji('avenger')} 复仇者已确认阵营`);
  }

  // 6c. WolfQueen charm (from actions Map)
  const wolfQueenAction = gameState.actions.get('wolfQueen');
  if (wolfQueenAction && wolfQueenAction.kind === 'target') {
    lines.push(`${ACTION.CHARM} 狼美人魅惑了 ${formatSeat(wolfQueenAction.targetSeat)}`);
  } else {
    const wqSeat = findSeatByRole(gameState.players, 'wolfQueen');
    if (wqSeat !== undefined && nr.blockedSeat !== wqSeat) {
      lines.push(`${ACTION.CHARM} 狼美人未魅惑`);
    }
  }

  // 6d. AwakenedGargoyle convert
  if (nr.convertedSeat != null) {
    lines.push(
      `${getRoleEmoji('awakenedGargoyle')} 觉醒石像鬼转化了 ${formatSeat(nr.convertedSeat)}`,
    );
  }

  // 6e. Piper hypnotize
  if (nr.hypnotizedSeats && nr.hypnotizedSeats.length > 0) {
    const hypnotizedList = nr.hypnotizedSeats.map((seat) => formatSeat(seat)).join('、');
    lines.push(`${getRoleEmoji('piper')} 吹笛者催眠了 ${hypnotizedList}`);
  } else {
    const piperSeat = findSeatByRole(gameState.players, 'piper');
    if (piperSeat !== undefined && nr.blockedSeat !== piperSeat) {
      lines.push(`${getRoleEmoji('piper')} 吹笛者未催眠`);
    }
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

  // Map reveal key → roleId for "did nothing" annotations
  const revealRoleMap: Record<string, RoleId> = {
    seerReveal: 'seer',
    mirrorSeerReveal: 'mirrorSeer',
    drunkSeerReveal: 'drunkSeer',
    psychicReveal: 'psychic',
    gargoyleReveal: 'gargoyle',
    pureWhiteReveal: 'pureWhite',
    wolfWitchReveal: 'wolfWitch',
  };

  for (const { key, label } of revealFields) {
    const reveal = gameState[key];
    if (reveal) {
      lines.push(`${ACTION.CHECK} ${label}查验 ${formatSeat(reveal.targetSeat)}：${reveal.result}`);
    } else {
      const roleId = revealRoleMap[key];
      if (roleId) {
        const seat = findSeatByRole(gameState.players, roleId);
        if (seat !== undefined && nr.blockedSeat !== seat) {
          lines.push(`${ACTION.CHECK} ${label}未查验`);
        }
      }
    }
  }

  // 8. WolfRobot learn
  if (gameState.wolfRobotReveal) {
    const wr = gameState.wolfRobotReveal;
    lines.push(
      `${ACTION.LEARN} ${getRoleDisplayName('wolfRobot')}学习了 ${formatSeat(wr.targetSeat)}（${getRoleDisplayName(wr.learnedRoleId)}）`,
    );
  } else {
    const wrSeat = findSeatByRole(gameState.players, 'wolfRobot');
    if (wrSeat !== undefined && nr.blockedSeat !== wrSeat) {
      lines.push(`${ACTION.LEARN} ${getRoleDisplayName('wolfRobot')}未学习`);
    }
  }

  // 9. Hunter / DarkWolfKing canShoot status
  // confirmStatus is cleared on step advance, so we re-derive canShoot.
  // Rule: can only trigger when wolf-killed or exile-voted out.
  // Cannot shoot on abnormal night death (poison / lover suicide / dreamcatcher chain / charm chain).
  const hunterSeat = findSeatByRole(gameState.players, 'hunter');
  if (hunterSeat !== undefined) {
    const canShoot = canShootForSeat(hunterSeat, gameState);
    lines.push(canShoot ? `${ACTION.SHOOT} 猎人可以发动技能` : `${ACTION.SHOOT} 猎人不能发动技能`);
  }

  const darkWolfKingSeat = findSeatByRole(gameState.players, 'darkWolfKing');
  if (darkWolfKingSeat !== undefined) {
    const canShoot = canShootForSeat(darkWolfKingSeat, gameState);
    lines.push(
      canShoot
        ? `${getRoleEmoji('darkWolfKing')} ${getRoleDisplayName('darkWolfKing')}可以发动技能`
        : `${getRoleEmoji('darkWolfKing')} ${getRoleDisplayName('darkWolfKing')}不能发动技能`,
    );
  }

  // ── Interaction annotations ──

  // Same-guard-same-save warning
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
export function buildIdentityLines(players: Map<number, LocalWerewolfPlayer | null>): string[] {
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
export function buildNightReviewData(gameState: LocalWerewolfState): NightReviewData {
  return {
    actionLines: buildActionLines(gameState),
    identityLines: buildIdentityLines(gameState.players),
  };
}
