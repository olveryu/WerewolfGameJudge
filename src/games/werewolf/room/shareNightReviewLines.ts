/**
 * shareNightReviewLines - Pure-text generator for structured night review entries.
 *
 * This module is the text channel only: it formats NightReviewActionEntry /
 * NightReviewIdentityEntry values into the exact legacy summary wording for
 * consumers that cannot render the DOM presentation — the mini-program canvas
 * fallback renderer (shareNightReview) and text-level test assertions.
 * The DOM surfaces (NightReviewModal, NightReviewShareCard) do NOT use this
 * module — they render entries structurally via NightReviewReportBody.
 * Action subjects carry the actor's seat once, at the subject; the sheriff
 * lines format the fact layer's public-record section, so nothing secret
 * can reach this channel either.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { getRoleDisplayName, getRoleEmoji } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { ACTION, STATUS } from '@/config/emojiTokens';

import {
  DEATH_REASON_LABELS,
  deriveWolfVerdict,
  type NightReportStats,
  type NightReviewActionEntry,
  type NightReviewIdentityEntry,
  type NightReviewOutcome,
  type NightReviewSheriffRound,
  type NightReviewSheriffSection,
  type NightReviewWolfVerdict,
} from './NightReview.helpers';
import {
  NIGHT_REPORT_SHERIFF_ABSTAIN_LABEL,
  NIGHT_REPORT_SHERIFF_CANDIDATES_LABEL,
  NIGHT_REPORT_SHERIFF_ELECTED_TITLE,
  NIGHT_REPORT_SHERIFF_IN_PROGRESS,
  NIGHT_REPORT_SHERIFF_NONE_TITLE,
  NIGHT_REPORT_SHERIFF_REASON_LABELS,
  NIGHT_REPORT_SHERIFF_REGISTRATION_STATUS,
  NIGHT_REPORT_SHERIFF_ROUND_LABELS,
  NIGHT_REPORT_SHERIFF_TITLE,
  NIGHT_REPORT_SHERIFF_WITHDRAWN_LABEL,
  NIGHT_REPORT_STAT_LABELS,
  NIGHT_REPORT_WOLF_VERDICT_ALL_ABSTAIN,
  NIGHT_REPORT_WOLF_VERDICT_SHARED,
  NIGHT_REPORT_WOLF_VERDICT_SPLIT_KILLED,
  NIGHT_REPORT_WOLF_VERDICT_SPLIT_TIED,
  NIGHT_REVIEW_PEACEFUL_HEADLINE,
} from './nightReviewLayout';

/**
 * A sentence subject carrying its seat exactly once — 「女巫（10号）」. The
 * legacy lines named the actor's role without a seat; the 2026 report pins
 * the actor's seat at the subject and keeps inline targets seat-only.
 */
function subject(roleName: string, actorSeat: number): string {
  return `${roleName}（${formatSeat(actorSeat)}）`;
}

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
      return `${getRoleEmoji(entry.actorRoleId)} ${subject(getRoleDisplayName(entry.actorRoleId), entry.actorSeat)}选择了 ${getRoleDisplayName(entry.chosenRoleId)}`;
    case 'cupidLink':
      return `${getRoleEmoji('cupid')} ${subject('丘比特', entry.actorSeat)}连线了 ${formatSeat(entry.seats[0])} 和 ${formatSeat(entry.seats[1])}`;
    case 'wolfAttack': {
      // Real votes first (voter→target), then each abstention as 「N号空刀」;
      // abstainSeats are split out by the fact layer, so no sentinel can be
      // formatted as a seat here.
      const voteText = entry.votes
        .map((v) => `${formatSeat(v.voterSeat)}→${formatSeat(v.targetSeat)}`)
        .join('，');
      const abstainText = entry.abstainSeats.map((seat) => `${formatSeat(seat)}空刀`).join('，');
      const parts = [voteText, abstainText].filter((part) => part.length > 0);
      return `${getRoleEmoji('wolf')} 狼人袭击：${parts.join('，')}`;
    }
    case 'wolfNoTarget':
      return `${getRoleEmoji('wolf')} 狼人空刀（未选择目标）`;
    case 'wolfGiveUp':
      return `${getRoleEmoji('wolf')} 狼人放弃袭击（${entry.reason === 'poisonerPresent' ? '毒师在场' : `被${getRoleDisplayName('nightmare')}封锁`}）`;
    case 'nightmareBlock':
      return `${getRoleEmoji('nightmare')} ${subject(getRoleDisplayName('nightmare'), entry.actorSeat)}封锁了 ${formatSeat(entry.targetSeat)}${entry.targetRoleId ? `（${getRoleDisplayName(entry.targetRoleId)}，技能无效）` : ''}`;
    case 'nightmareIdle':
      return `${getRoleEmoji('nightmare')} ${subject(getRoleDisplayName('nightmare'), entry.actorSeat)}未封锁`;
    case 'shelter':
      return `${getRoleEmoji('eclipseWolfQueen')} ${subject(getRoleDisplayName('eclipseWolfQueen'), entry.actorSeat)}庇护了 ${formatSeat(entry.targetSeat)}`;
    case 'shelterIdle':
      return `${getRoleEmoji('eclipseWolfQueen')} ${subject(getRoleDisplayName('eclipseWolfQueen'), entry.actorSeat)}未庇护`;
    case 'hiddenWolfConfirmed':
      return `${getRoleEmoji('hiddenWolf')} ${subject(getRoleDisplayName('hiddenWolf'), entry.actorSeat)}已确认狼同伴`;
    case 'guard':
      return `${ACTION.GUARD} ${subject('守卫', entry.actorSeat)}守护了 ${formatSeat(entry.targetSeat)}`;
    case 'guardIdle':
      return `${ACTION.GUARD} ${subject('守卫', entry.actorSeat)}未守护`;
    case 'silence':
      return `${getRoleEmoji('silenceElder')} ${subject('禁言长老', entry.actorSeat)}禁言了 ${formatSeat(entry.targetSeat)}`;
    case 'silenceIdle':
      return `${getRoleEmoji('silenceElder')} ${subject('禁言长老', entry.actorSeat)}未禁言`;
    case 'voteban':
      return `${getRoleEmoji('votebanElder')} ${subject('禁票长老', entry.actorSeat)}禁票了 ${formatSeat(entry.targetSeat)}`;
    case 'votebanIdle':
      return `${getRoleEmoji('votebanElder')} ${subject('禁票长老', entry.actorSeat)}未禁票`;
    case 'save':
      return `${ACTION.SAVE} ${subject('女巫', entry.actorSeat)}使用解药救了 ${formatSeat(entry.targetSeat)}`;
    case 'poison':
      return entry.actorRoleId === 'poisoner'
        ? `${ACTION.POISON} ${subject('毒师', entry.actorSeat)}毒杀了 ${formatSeat(entry.targetSeat)}`
        : `${ACTION.POISON} ${subject('女巫', entry.actorSeat)}使用毒药毒杀了 ${formatSeat(entry.targetSeat)}`;
    case 'witchIdleAll':
      return `${ACTION.SAVE} ${subject('女巫', entry.actorSeat)}未使用药水`;
    case 'witchNoSave':
      return `${ACTION.SAVE} ${subject('女巫', entry.actorSeat)}未使用解药`;
    case 'witchNoPoison':
      return `${ACTION.POISON} ${subject('女巫', entry.actorSeat)}未使用毒药`;
    case 'poisonerNoPoison':
      return `${ACTION.POISON} ${subject('毒师', entry.actorSeat)}未使用毒药`;
    case 'curse':
      return `${getRoleEmoji('crow')} ${subject('乌鸦', entry.actorSeat)}诅咒了 ${formatSeat(entry.targetSeat)}`;
    case 'curseIdle':
      return `${getRoleEmoji('crow')} ${subject('乌鸦', entry.actorSeat)}未诅咒`;
    case 'dream':
      return `${getRoleEmoji('dreamcatcher')} ${subject('摄梦人', entry.actorSeat)}摄梦了 ${formatSeat(entry.targetSeat)}`;
    case 'dreamIdle':
      return `${getRoleEmoji('dreamcatcher')} ${subject('摄梦人', entry.actorSeat)}未摄梦`;
    case 'swap':
      return `${getRoleEmoji('magician')} ${subject('魔术师', entry.actorSeat)}交换了 ${formatSeat(entry.seats[0])} 和 ${formatSeat(entry.seats[1])}`;
    case 'swapIdle':
      return `${getRoleEmoji('magician')} ${subject('魔术师', entry.actorSeat)}未交换`;
    case 'idolChoice':
      return entry.actorRoleId === 'slacker'
        ? `${getRoleEmoji('slacker')} ${subject(getRoleDisplayName('slacker'), entry.actorSeat)}选择了 ${formatSeat(entry.targetSeat)} 为榜样`
        : `${getRoleEmoji('wildChild')} ${subject('野孩子', entry.actorSeat)}选择了 ${formatSeat(entry.targetSeat)} 为榜样`;
    case 'mimic':
      return `${getRoleEmoji('shadow')} ${subject('影子', entry.actorSeat)}模仿了 ${formatSeat(entry.targetSeat)}${entry.isBound ? '（绑定）' : ''}`;
    case 'avengerConfirmed':
      return `${getRoleEmoji('avenger')} ${subject('复仇者', entry.actorSeat)}已确认阵营`;
    case 'charm':
      return `${ACTION.CHARM} ${subject('狼美人', entry.actorSeat)}魅惑了 ${formatSeat(entry.targetSeat)}`;
    case 'charmIdle':
      return `${ACTION.CHARM} ${subject('狼美人', entry.actorSeat)}未魅惑`;
    case 'convert':
      return `${getRoleEmoji('awakenedGargoyle')} ${subject(getRoleDisplayName('awakenedGargoyle'), entry.actorSeat)}转化了 ${formatSeat(entry.targetSeat)}`;
    case 'hypnotize':
      return `${getRoleEmoji('piper')} ${subject('吹笛者', entry.actorSeat)}催眠了 ${entry.targetSeats.map((seat) => formatSeat(seat)).join('、')}`;
    case 'hypnotizeIdle':
      return `${getRoleEmoji('piper')} ${subject('吹笛者', entry.actorSeat)}未催眠`;
    case 'check':
      return `${ACTION.CHECK} ${subject(checkLabel(entry.actorRoleId), entry.actorSeat)}查验 ${formatSeat(entry.targetSeat)}：${entry.result}`;
    case 'checkIdle':
      return `${ACTION.CHECK} ${subject(checkLabel(entry.actorRoleId), entry.actorSeat)}未查验`;
    case 'learn':
      return `${ACTION.LEARN} ${subject(getRoleDisplayName('wolfRobot'), entry.actorSeat)}学习了 ${formatSeat(entry.targetSeat)}（${getRoleDisplayName(entry.learnedRoleId)}）`;
    case 'learnIdle':
      return `${ACTION.LEARN} ${subject(getRoleDisplayName('wolfRobot'), entry.actorSeat)}未学习`;
    case 'shootStatus':
      return entry.actorRoleId === 'hunter'
        ? `${ACTION.SHOOT} ${subject('猎人', entry.actorSeat)}${entry.canShoot ? '可以' : '不能'}发动技能`
        : `${getRoleEmoji('darkWolfKing')} ${subject(getRoleDisplayName('darkWolfKing'), entry.actorSeat)}${entry.canShoot ? '可以' : '不能'}发动技能`;
    case 'infectConverted':
      return `${getRoleEmoji('seedWolf')} ${subject(getRoleDisplayName('seedWolf'), entry.actorSeat)}成功感染了 ${formatSeat(entry.targetSeat)}`;
    case 'infectFailed':
      return `${getRoleEmoji('seedWolf')} ${subject(getRoleDisplayName('seedWolf'), entry.actorSeat)}感染 ${formatSeat(entry.targetSeat)}失败`;
    case 'infectIdle':
      return `${getRoleEmoji('seedWolf')} ${subject(getRoleDisplayName('seedWolf'), entry.actorSeat)}未使用感染`;
    case 'guardSaveConflict':
      return `⚠️ 同守同救：${formatSeat(entry.targetSeat)} 仍然死亡`;
    case 'poisonImmune':
      return `⚠️ ${formatSeat(entry.targetSeat)}（${getRoleDisplayName(entry.targetRoleId)}）免疫毒药`;
    case 'reflectDamage':
      return `⚠️ ${getRoleDisplayName(entry.checkerRoleId)} 查验了 ${formatSeat(entry.targetSeat)}（${getRoleDisplayName(entry.targetRoleId)}），遭到反伤`;
    case 'peacefulNight':
      return `${STATUS.PEACEFUL_NIGHT} ${NIGHT_REVIEW_PEACEFUL_HEADLINE}`;
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

/**
 * Format the derived night outcome as the text channel's headline line.
 * Mirrors the DOM hero (same outcome, same death order and reason labels);
 * the canvas fallback draws this line right under the share title instead of
 * drawing the outcome entry in action order.
 */
export function formatNightReviewOutcomeLine(outcome: NightReviewOutcome): string {
  if (outcome.type === 'peaceful') {
    return `${STATUS.PEACEFUL_NIGHT} ${NIGHT_REVIEW_PEACEFUL_HEADLINE}`;
  }
  const list = outcome.deaths
    .map((d) =>
      d.reason ? `${formatSeat(d.seat)}（${DEATH_REASON_LABELS[d.reason]}）` : formatSeat(d.seat),
    )
    .join('、');
  return `${STATUS.DEATH} 昨夜出局：${list}`;
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

/** Format the derived stats tallies as the text channel's stats line. */
export function formatNightReviewStatsLine(stats: NightReportStats): string {
  return [
    `${NIGHT_REPORT_STAT_LABELS.wolfKill} ${stats.wolfKills}`,
    `${NIGHT_REPORT_STAT_LABELS.poison} ${stats.poisonKills}`,
    `${NIGHT_REPORT_STAT_LABELS.save} ${stats.saves}`,
    `${NIGHT_REPORT_STAT_LABELS.check} ${stats.checks}`,
  ].join(' · ');
}

/** Format a wolf verdict as its line, drawn right after the wolf attack line. */
export function formatNightReviewWolfVerdictLine(verdict: NightReviewWolfVerdict): string {
  switch (verdict.type) {
    case 'sharedTarget':
      return NIGHT_REPORT_WOLF_VERDICT_SHARED;
    case 'splitKilled':
      return NIGHT_REPORT_WOLF_VERDICT_SPLIT_KILLED;
    case 'splitTied':
      return NIGHT_REPORT_WOLF_VERDICT_SPLIT_TIED;
    case 'allAbstain':
      return NIGHT_REPORT_WOLF_VERDICT_ALL_ABSTAIN;
  }
}

/** Convenience: the verdict line for a wolfAttack entry, from the fact layer. */
export function formatNightReviewWolfVerdictForEntry(
  entry: Extract<NightReviewActionEntry, { kind: 'wolfAttack' }>,
): string {
  return formatNightReviewWolfVerdictLine(deriveWolfVerdict(entry));
}

/**
 * Seat list in the election record's compact form: bare numbers joined by
 * 、 with a single trailing 号 （「1、4、9、11号」).
 */
function formatSheriffSeatList(seats: readonly number[]): string {
  return `${seats.map((seat) => seat + 1).join('、')}号`;
}

/** Format one closed sheriff round as its record line. */
export function formatNightReviewSheriffRoundLine(round: NightReviewSheriffRound): string {
  const label = NIGHT_REPORT_SHERIFF_ROUND_LABELS[round.round];
  const candidateParts = [...round.perCandidate]
    .sort((a, b) => b.votes - a.votes || a.seat - b.seat)
    .map(
      (candidate) =>
        `${formatSeat(candidate.seat)} ${candidate.votes}票（${formatSheriffSeatList(candidate.voterSeats)}）`,
    );
  const parts = [...candidateParts];
  if (round.abstainingSeats.length > 0) {
    parts.push(
      `${NIGHT_REPORT_SHERIFF_ABSTAIN_LABEL}：${formatSheriffSeatList(round.abstainingSeats)}`,
    );
  }
  return `${label}：${parts.join('，')}`;
}

/**
 * Format the sheriff section as text lines (status-only while the election
 * is in flight; the full public record once it completes). The section
 * itself guarantees nothing secret is present, so this formatter renders
 * whatever the section carries.
 */
export function formatNightReviewSheriffLines(section: NightReviewSheriffSection): string[] {
  switch (section.kind) {
    case 'registration':
      return [`${NIGHT_REPORT_SHERIFF_TITLE}：${NIGHT_REPORT_SHERIFF_REGISTRATION_STATUS}`];
    case 'inProgress': {
      const lines: string[] = [
        `${NIGHT_REPORT_SHERIFF_TITLE}：${NIGHT_REPORT_SHERIFF_IN_PROGRESS}`,
      ];
      if (section.candidateSeats.length > 0) {
        const withdrawn =
          section.withdrawnSeats.length > 0
            ? `（${NIGHT_REPORT_SHERIFF_WITHDRAWN_LABEL}：${formatSheriffSeatList(section.withdrawnSeats)}）`
            : '';
        lines.push(
          `${NIGHT_REPORT_SHERIFF_CANDIDATES_LABEL}：${section.candidateSeats.map((seat) => formatSeat(seat)).join('、')}${withdrawn}`,
        );
      }
      for (const round of section.closedRounds) {
        lines.push(formatNightReviewSheriffRoundLine(round));
      }
      if (section.activeRound !== null) {
        const label = NIGHT_REPORT_SHERIFF_ROUND_LABELS[section.activeRound.round];
        lines.push(
          `${label}投票中：候选 ${section.activeRound.candidateSeats.map((seat) => formatSeat(seat)).join('、')}`,
        );
      }
      return lines;
    }
    case 'completed': {
      const lines: string[] = [];
      if (section.result.kind === 'elected') {
        const decidingRound = section.rounds[section.rounds.length - 1];
        const winner = decidingRound?.perCandidate.find(
          (candidate) => candidate.seat === section.result.sheriffSeat,
        );
        if (decidingRound !== undefined && winner !== undefined) {
          const total =
            decidingRound.perCandidate.reduce((sum, candidate) => sum + candidate.votes, 0) +
            decidingRound.abstainingSeats.length;
          const label = NIGHT_REPORT_SHERIFF_ROUND_LABELS[decidingRound.round];
          lines.push(
            `${NIGHT_REPORT_SHERIFF_TITLE}：${formatSeat(section.result.sheriffSeat)} ${NIGHT_REPORT_SHERIFF_ELECTED_TITLE}（${label} ${winner.votes}/${total} 票）`,
          );
        } else {
          lines.push(
            `${NIGHT_REPORT_SHERIFF_TITLE}：${formatSeat(section.result.sheriffSeat)} ${NIGHT_REPORT_SHERIFF_ELECTED_TITLE}`,
          );
        }
      } else {
        lines.push(
          `${NIGHT_REPORT_SHERIFF_TITLE}：${NIGHT_REPORT_SHERIFF_NONE_TITLE}（${NIGHT_REPORT_SHERIFF_REASON_LABELS[section.result.reason]}）`,
        );
      }
      if (section.registeredSeats.length > 0) {
        const withdrawn =
          section.withdrawnSeats.length > 0
            ? `（${NIGHT_REPORT_SHERIFF_WITHDRAWN_LABEL}：${formatSheriffSeatList(section.withdrawnSeats)}）`
            : '';
        lines.push(
          `${NIGHT_REPORT_SHERIFF_CANDIDATES_LABEL}：${section.registeredSeats.map((seat) => formatSeat(seat)).join('、')}${withdrawn}`,
        );
      }
      for (const round of section.rounds) {
        lines.push(formatNightReviewSheriffRoundLine(round));
      }
      return lines;
    }
  }
}
