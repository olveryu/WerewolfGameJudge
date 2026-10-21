/**
 * shareNightReviewLines - Text rendering of structured night review entries for share surfaces.
 *
 * The share card (RN view) and the mini-program canvas renderer consume plain text
 * lines; this module is that text renderer. It formats NightReviewActionEntry /
 * NightReviewIdentityEntry values back into the exact legacy summary wording.
 * The in-room NightReviewModal does NOT use this module — it renders entries structurally.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { getRoleDisplayName, getRoleEmoji } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { ACTION, STATUS } from '@/config/emojiTokens';

import {
  DEATH_REASON_LABELS,
  type NightReviewActionEntry,
  type NightReviewIdentityEntry,
} from './NightReview.helpers';

/** Display labels for the check family, keyed by checker role. */
const CHECK_LABELS: Partial<Record<RoleId, string>> = {
  seer: '预言家',
  mirrorSeer: '灯影预言家',
  drunkSeer: '酒鬼预言家',
  psychic: '通灵师',
  gargoyle: '石像鬼',
  pureWhite: '纯白之女',
  wolfWitch: '狼巫',
};

function checkLabel(actorRoleId: RoleId): string {
  const label = CHECK_LABELS[actorRoleId];
  if (label === undefined) {
    throw new Error(`[FAIL-FAST] No night review check label for role: ${actorRoleId}`);
  }
  return label;
}

/** Format one structured action entry as its legacy summary line. */
export function formatNightReviewActionLine(entry: NightReviewActionEntry): string {
  switch (entry.kind) {
    case 'bottomCards':
      return `${getRoleEmoji('treasureMaster')} 底牌组成：${entry.roleIds.map((id) => getRoleDisplayName(id)).join('、')}`;
    case 'cardChoice':
      return `${getRoleEmoji(entry.actorRoleId)} ${getRoleDisplayName(entry.actorRoleId)}选择了 ${getRoleDisplayName(entry.chosenRoleId)}`;
    case 'cupidLink':
      return `${getRoleEmoji('cupid')} 丘比特连线了 ${formatSeat(entry.seats[0])} 和 ${formatSeat(entry.seats[1])}`;
    case 'wolfAttack':
      return `${getRoleEmoji('wolf')} 狼人袭击：${entry.votes.map((v) => `${formatSeat(v.voterSeat)}→${formatSeat(v.targetSeat)}`).join('，')}`;
    case 'wolfNoTarget':
      return `${getRoleEmoji('wolf')} 狼人空刀（未选择目标）`;
    case 'wolfGiveUp':
      return `${getRoleEmoji('wolf')} 狼人放弃袭击（${entry.reason === 'poisonerPresent' ? '毒师在场' : `被${getRoleDisplayName('nightmare')}封锁`}）`;
    case 'nightmareBlock':
      return `${getRoleEmoji('nightmare')} ${getRoleDisplayName('nightmare')}封锁了 ${formatSeat(entry.targetSeat)}${entry.targetRoleId ? `（${getRoleDisplayName(entry.targetRoleId)}，技能无效）` : ''}`;
    case 'nightmareIdle':
      return `${getRoleEmoji('nightmare')} ${getRoleDisplayName('nightmare')}未封锁`;
    case 'shelter':
      return `${getRoleEmoji('eclipseWolfQueen')} ${getRoleDisplayName('eclipseWolfQueen')}庇护了 ${formatSeat(entry.targetSeat)}`;
    case 'shelterIdle':
      return `${getRoleEmoji('eclipseWolfQueen')} ${getRoleDisplayName('eclipseWolfQueen')}未庇护`;
    case 'hiddenWolfConfirmed':
      return `${getRoleEmoji('hiddenWolf')} ${getRoleDisplayName('hiddenWolf')}已确认狼同伴`;
    case 'guard':
      return `${ACTION.GUARD} 守卫守护了 ${formatSeat(entry.targetSeat)}`;
    case 'guardIdle':
      return `${ACTION.GUARD} 守卫未守护`;
    case 'silence':
      return `${getRoleEmoji('silenceElder')} 禁言长老禁言了 ${formatSeat(entry.targetSeat)}`;
    case 'silenceIdle':
      return `${getRoleEmoji('silenceElder')} 禁言长老未禁言`;
    case 'voteban':
      return `${getRoleEmoji('votebanElder')} 禁票长老禁票了 ${formatSeat(entry.targetSeat)}`;
    case 'votebanIdle':
      return `${getRoleEmoji('votebanElder')} 禁票长老未禁票`;
    case 'save':
      return `${ACTION.SAVE} 女巫使用解药救了 ${formatSeat(entry.targetSeat)}`;
    case 'poison':
      return `${ACTION.POISON} ${entry.actorRoleId === 'poisoner' ? '毒师毒杀了' : '女巫使用毒药毒杀了'} ${formatSeat(entry.targetSeat)}`;
    case 'witchIdleAll':
      return `${ACTION.SAVE} 女巫未使用药水`;
    case 'witchNoSave':
      return `${ACTION.SAVE} 女巫未使用解药`;
    case 'witchNoPoison':
      return `${ACTION.POISON} 女巫未使用毒药`;
    case 'poisonerNoPoison':
      return `${ACTION.POISON} 毒师未使用毒药`;
    case 'curse':
      return `${getRoleEmoji('crow')} 乌鸦诅咒了 ${formatSeat(entry.targetSeat)}`;
    case 'curseIdle':
      return `${getRoleEmoji('crow')} 乌鸦未诅咒`;
    case 'dream':
      return `${getRoleEmoji('dreamcatcher')} 摄梦人摄梦了 ${formatSeat(entry.targetSeat)}`;
    case 'dreamIdle':
      return `${getRoleEmoji('dreamcatcher')} 摄梦人未摄梦`;
    case 'swap':
      return `${getRoleEmoji('magician')} 魔术师交换了 ${formatSeat(entry.seats[0])} 和 ${formatSeat(entry.seats[1])}`;
    case 'swapIdle':
      return `${getRoleEmoji('magician')} 魔术师未交换`;
    case 'idolChoice':
      return entry.actorRoleId === 'slacker'
        ? `${getRoleEmoji('slacker')} ${getRoleDisplayName('slacker')}选择了 ${formatSeat(entry.targetSeat)} 为榜样`
        : `${getRoleEmoji('wildChild')} 野孩子选择了 ${formatSeat(entry.targetSeat)} 为榜样`;
    case 'mimic':
      return `${getRoleEmoji('shadow')} 影子模仿了 ${formatSeat(entry.targetSeat)}${entry.isBound ? '（绑定）' : ''}`;
    case 'avengerConfirmed':
      return `${getRoleEmoji('avenger')} 复仇者已确认阵营`;
    case 'charm':
      return `${ACTION.CHARM} 狼美人魅惑了 ${formatSeat(entry.targetSeat)}`;
    case 'charmIdle':
      return `${ACTION.CHARM} 狼美人未魅惑`;
    case 'convert':
      return `${getRoleEmoji('awakenedGargoyle')} ${getRoleDisplayName('awakenedGargoyle')}转化了 ${formatSeat(entry.targetSeat)}`;
    case 'hypnotize':
      return `${getRoleEmoji('piper')} 吹笛者催眠了 ${entry.targetSeats.map((seat) => formatSeat(seat)).join('、')}`;
    case 'hypnotizeIdle':
      return `${getRoleEmoji('piper')} 吹笛者未催眠`;
    case 'check':
      return `${ACTION.CHECK} ${checkLabel(entry.actorRoleId)}查验 ${formatSeat(entry.targetSeat)}：${entry.result}`;
    case 'checkIdle':
      return `${ACTION.CHECK} ${checkLabel(entry.actorRoleId)}未查验`;
    case 'learn':
      return `${ACTION.LEARN} ${getRoleDisplayName('wolfRobot')}学习了 ${formatSeat(entry.targetSeat)}（${getRoleDisplayName(entry.learnedRoleId)}）`;
    case 'learnIdle':
      return `${ACTION.LEARN} ${getRoleDisplayName('wolfRobot')}未学习`;
    case 'shootStatus':
      return entry.actorRoleId === 'hunter'
        ? `${ACTION.SHOOT} 猎人${entry.canShoot ? '可以' : '不能'}发动技能`
        : `${getRoleEmoji('darkWolfKing')} ${getRoleDisplayName('darkWolfKing')}${entry.canShoot ? '可以' : '不能'}发动技能`;
    case 'infectConverted':
      return `${getRoleEmoji('seedWolf')} ${getRoleDisplayName('seedWolf')}成功感染了 ${formatSeat(entry.targetSeat)}`;
    case 'infectFailed':
      return `${getRoleEmoji('seedWolf')} ${getRoleDisplayName('seedWolf')}感染 ${formatSeat(entry.targetSeat)}失败`;
    case 'infectIdle':
      return `${getRoleEmoji('seedWolf')} ${getRoleDisplayName('seedWolf')}未使用感染`;
    case 'guardSaveConflict':
      return `⚠️ 同守同救：${formatSeat(entry.targetSeat)} 仍然死亡`;
    case 'poisonImmune':
      return `⚠️ ${formatSeat(entry.targetSeat)}（${getRoleDisplayName(entry.targetRoleId)}）免疫毒药`;
    case 'reflectDamage':
      return `⚠️ ${getRoleDisplayName(entry.checkerRoleId)} 查验了 ${formatSeat(entry.targetSeat)}（${getRoleDisplayName(entry.targetRoleId)}），遭到反伤`;
    case 'peacefulNight':
      return `${STATUS.PEACEFUL_NIGHT} 昨夜平安夜`;
    case 'deaths':
      return `${STATUS.DEATH} 死亡：${entry.deaths.map((d) => (d.reason ? `${formatSeat(d.seat)}（${DEATH_REASON_LABELS[d.reason]}）` : formatSeat(d.seat))).join('、')}`;
    default: {
      const exhaustive: never = entry;
      throw new Error(
        `[FAIL-FAST] Unknown night review action entry: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}

/** Format one structured identity entry as its legacy summary line. */
export function formatNightReviewIdentityLine(entry: NightReviewIdentityEntry): string {
  const roleName = entry.isEmptySeat
    ? '空座'
    : entry.roleId
      ? getRoleDisplayName(entry.roleId)
      : '未分配';
  return `${formatSeat(entry.seat)}: ${roleName}`;
}
