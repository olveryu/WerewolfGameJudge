/** Avalon pure game rules: quest sizes, fail thresholds, leader rotation, night info. No IO. */

import {
  AVALON_BOARDS,
  AVALON_FOURTH_QUEST_DOUBLE_FAIL_MIN_PLAYERS,
  AVALON_QUEST_SIZES,
  type AvalonNightInfo,
  type AvalonNightStep,
  type AvalonPlayerCount,
  type AvalonQuestRound,
  type AvalonRoleId,
  isAvalonEvilRole,
} from '../state/types';

/** 揭晓倒计时（秒）：全员投完票/出完牌后才开始计时，到点自动结算揭晓。 */
export const AVALON_SETTLE_COUNTDOWN_SECONDS = 5;

/** 第 R 轮需要的队员数（官方任务人数表）。 */
export function getAvalonQuestSize(
  numberOfPlayers: AvalonPlayerCount,
  round: AvalonQuestRound,
): number {
  return AVALON_QUEST_SIZES[numberOfPlayers][round - 1]!;
}

/** 任务失败需要的失败票数：7 人及以上第 4 轮需 2 张，其余 1 张（官方规则）。 */
export function getAvalonFailsNeeded(
  numberOfPlayers: AvalonPlayerCount,
  round: AvalonQuestRound,
): number {
  return round === 4 && numberOfPlayers >= AVALON_FOURTH_QUEST_DOUBLE_FAIL_MIN_PLAYERS ? 2 : 1;
}

/**
 * 队长顺时针移交：座位号按顺时针方向递增编号，下一任队长为 (leader + 1) % N。
 * 湖仙 token 给首任队长"右手边"的玩家：面向圆心时右手指向逆时针邻座，
 * 即 (leader - 1 + N) % N。
 */
export function nextAvalonLeaderSeat(
  leaderSeat: number,
  numberOfPlayers: AvalonPlayerCount,
): number {
  return (leaderSeat + 1) % numberOfPlayers;
}

/** 首任湖仙 token 持有人：首任队长右手边的玩家（见上）。 */
export function getAvalonLadyInitialHolderSeat(
  leaderSeat: number,
  numberOfPlayers: AvalonPlayerCount,
): number {
  return (leaderSeat - 1 + numberOfPlayers) % numberOfPlayers;
}

/** night 各步骤的参与者集合（§4.1）。 */
export function getAvalonNightParticipants(
  roles: Readonly<Record<number, AvalonRoleId>>,
  step: AvalonNightStep,
): readonly number[] {
  const seats = Object.keys(roles).map(Number);
  switch (step) {
    case 'evilReveal':
      // 坏人互认：奥伯伦全程闭眼，不参与、不确认。
      return seats.filter((seat) => isAvalonEvilRole(roles[seat]!) && roles[seat] !== 'oberon');
    case 'merlinReveal':
      return seats.filter((seat) => roles[seat] === 'merlin');
    case 'percivalReveal':
      return seats.filter((seat) => roles[seat] === 'percival');
  }
}

/** 发牌时服务端算好的可见集合（§4.3）。 */
export function buildAvalonNightInfo(
  roles: Readonly<Record<number, AvalonRoleId>>,
): AvalonNightInfo {
  const seats = Object.keys(roles).map(Number);
  const evilSeats = seats.filter((seat) => isAvalonEvilRole(roles[seat]!));
  const evilPeers: Record<number, readonly number[]> = {};
  for (const seat of evilSeats) {
    // 奥伯伦不互认：他看不到别人，别人也看不到他。
    evilPeers[seat] =
      roles[seat] === 'oberon'
        ? []
        : evilSeats.filter((other) => other !== seat && roles[other] !== 'oberon');
  }
  return {
    evilPeers,
    // 梅林看不到莫德雷德。
    merlinSees: evilSeats.filter((seat) => roles[seat] !== 'mordred'),
    // 派西维尔看到梅林 + 莫甘娜（分不清谁是谁）；固定板子下两人必定同时在场。
    percivalSees: seats.filter((seat) => roles[seat] === 'merlin' || roles[seat] === 'morgana'),
  };
}

/** 校验发牌结果与人数板子一致（D2 表）。 */
export function isAvalonBoardCompositionValid(
  roles: Readonly<Record<number, AvalonRoleId>>,
  numberOfPlayers: AvalonPlayerCount,
): boolean {
  const seats = Object.keys(roles).map(Number);
  if (seats.length !== numberOfPlayers) return false;
  if (!seats.every((seat, index) => seat === index)) return false;
  const dealt = seats.map((seat) => roles[seat]!).sort();
  const expected = [...AVALON_BOARDS[numberOfPlayers]].sort();
  return dealt.length === expected.length && dealt.every((role, index) => role === expected[index]);
}
