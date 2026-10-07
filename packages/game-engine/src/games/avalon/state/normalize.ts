/** Avalon semantic invariants; invalid persisted or evolved states fail explicitly. */

import {
  buildAvalonNightInfo,
  getAvalonNightParticipants,
  getAvalonQuestSize,
  isAvalonBoardCompositionValid,
} from '../domain/rules';
import {
  AVALON_GAME_TYPE,
  AVALON_LADY_MIN_PLAYERS,
  AVALON_STATE_VERSION,
  type AvalonBallot,
  type AvalonPlay,
  type AvalonState,
  isAvalonEvilRole,
  isAvalonOccupiedSeat,
  isAvalonQuestRound,
  isValidAvalonConfig,
} from './types';

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid Avalon state: ${message}`);
}

/** Validates authoritative state without repairing or dropping submitted content. */
export function normalizeAvalonState(state: AvalonState): AvalonState {
  invariant(
    state.gameType === AVALON_GAME_TYPE && state.stateVersion === AVALON_STATE_VERSION,
    'identity',
  );
  invariant(isValidAvalonConfig(state.config), 'configuration');
  const count = state.config.numberOfPlayers;
  const isSeat = (seat: number) => Number.isSafeInteger(seat) && seat >= 0 && seat < count;
  invariant(
    Number.isSafeInteger(state.phaseRevision) && state.phaseRevision >= 0,
    'phase revision',
  );
  invariant(Number.isSafeInteger(state.gameSequence) && state.gameSequence >= 0, 'game sequence');
  const users = Object.entries(state.realSeats);
  invariant(
    users.every(
      ([seat, occupant]) =>
        occupant !== undefined &&
        isSeat(Number(seat)) &&
        occupant.seat === Number(seat) &&
        occupant.profile.displayName.trim().length > 0,
    ),
    'real seats',
  );
  invariant(
    new Set(users.map(([, occupant]) => occupant!.userId)).size === users.length,
    'duplicate user',
  );
  invariant(
    state.excludedBotSeats.every((seat) => isSeat(seat) && state.realSeats[seat] === undefined) &&
      new Set(state.excludedBotSeats).size === state.excludedBotSeats.length,
    'excluded bot seats',
  );
  invariant(typeof state.fillEmptySeatsWithBots === 'boolean', 'fill bots flag');
  invariant(
    Number.isSafeInteger(state.rejectStreak) &&
      state.rejectStreak >= 0 &&
      state.rejectStreak < state.config.vetoLimit,
    'reject streak',
  );
  invariant(typeof state.xpSettled === 'boolean', 'xp settled flag');

  const inGame = state.phase.kind !== 'lobby';
  if (!inGame) {
    invariant(Object.keys(state.roles).length === 0, 'lobby roles');
    invariant(state.leaderSeat === -1, 'lobby leader');
    invariant(state.questResults.length === 0, 'lobby quest results');
    invariant(state.questHistory.length === 0, 'lobby quest history');
    invariant(state.ladyHolderSeat === null, 'lobby lady holder');
    invariant(state.ladyExaminedSeats.length === 0, 'lobby lady examined');
    invariant(state.lastLadyCheck === null, 'lobby lady check');
    invariant(state.rejectStreak === 0, 'lobby reject streak');
    invariant(state.lastVoteResult === null, 'lobby last vote result');
  } else {
    // 发牌与板子一致：roles 覆盖全部座位且角色构成与人数板子一致。
    invariant(isAvalonBoardCompositionValid(state.roles, count), 'board composition');
    // nightInfo 必须与 roles 重新算出的可见集合一致（防篡改）。
    const expectedNightInfo = buildAvalonNightInfo(state.roles);
    invariant(
      JSON.stringify(normalizeNightInfo(state.nightInfo)) ===
        JSON.stringify(normalizeNightInfo(expectedNightInfo)),
      'night info',
    );
    invariant(isSeat(state.leaderSeat), 'leader seat');
  }

  invariant(
    state.questResults.every((result) => result === 'success' || result === 'fail') &&
      state.questResults.length <= 5,
    'quest results',
  );
  invariant(
    state.questHistory.length === state.questResults.length &&
      state.questHistory.every(
        (entry, index) =>
          isAvalonQuestRound(entry.round) &&
          (index === 0 || entry.round > state.questHistory[index - 1]!.round) &&
          isSeat(entry.leaderSeat) &&
          entry.teamSeats.length === getAvalonQuestSize(count, entry.round) &&
          entry.teamSeats.every(isSeat) &&
          new Set(entry.teamSeats).size === entry.teamSeats.length &&
          entry.result === state.questResults[index] &&
          entry.approveCount + entry.rejectCount + entry.abstainCount ===
            occupiedCount(state, count) &&
          Object.keys(entry.ballots).length === entry.approveCount + entry.rejectCount &&
          Object.keys(entry.ballots).every(
            (seat) =>
              isSeat(Number(seat)) &&
              (entry.ballots[Number(seat)] === 'approve' ||
                entry.ballots[Number(seat)] === 'reject'),
          ) &&
          Object.entries(entry.ballots).filter(([, vote]) => vote === 'approve').length ===
            entry.approveCount &&
          Object.entries(entry.ballots).filter(([, vote]) => vote === 'reject').length ===
            entry.rejectCount,
      ),
    'quest history',
  );

  if (count >= AVALON_LADY_MIN_PLAYERS) {
    invariant(
      inGame ? state.ladyHolderSeat !== null && isSeat(state.ladyHolderSeat) : true,
      'lady holder',
    );
  } else {
    invariant(state.ladyHolderSeat === null, 'no lady below 9 players');
  }
  invariant(
    state.ladyExaminedSeats.every(isSeat) &&
      new Set(state.ladyExaminedSeats).size === state.ladyExaminedSeats.length,
    'lady examined seats',
  );
  const lastCheck = state.lastLadyCheck;
  invariant(
    lastCheck === null ||
      (isSeat(lastCheck.holderSeat) &&
        isSeat(lastCheck.targetSeat) &&
        lastCheck.holderSeat !== lastCheck.targetSeat &&
        (lastCheck.faction === 'good' || lastCheck.faction === 'evil')),
    'last lady check',
  );

  // 投票结算面板数据：计数与逐人投票一致（否决上限终局时 rejectStreak 记为上限）。
  const lastVote = state.lastVoteResult;
  invariant(
    lastVote === null ||
      (typeof lastVote.approved === 'boolean' &&
        Number.isSafeInteger(lastVote.rejectStreak) &&
        lastVote.rejectStreak >= 0 &&
        lastVote.rejectStreak <= state.config.vetoLimit &&
        isValidBallots(lastVote.ballots, state, isSeat) &&
        lastVote.approveCount + lastVote.rejectCount + lastVote.abstainCount ===
          occupiedCount(state, count) &&
        Object.keys(lastVote.ballots).length === lastVote.approveCount + lastVote.rejectCount &&
        Object.entries(lastVote.ballots).filter(([, vote]) => vote === 'approve').length ===
          lastVote.approveCount &&
        Object.entries(lastVote.ballots).filter(([, vote]) => vote === 'reject').length ===
          lastVote.rejectCount),
    'last vote result',
  );

  switch (state.phase.kind) {
    case 'lobby':
      return state;
    case 'night': {
      const participants = getAvalonNightParticipants(state.roles, state.phase.step);
      invariant(
        state.phase.confirmedSeats.every((seat) => isSeat(seat) && participants.includes(seat)) &&
          new Set(state.phase.confirmedSeats).size === state.phase.confirmedSeats.length,
        'night confirmed seats',
      );
      return state;
    }
    case 'nominate': {
      const phase = state.phase;
      invariant(isAvalonQuestRound(phase.round), 'nominate round');
      invariant(phase.requiredSize === getAvalonQuestSize(count, phase.round), 'nominate size');
      return state;
    }
    case 'vote': {
      const phase = state.phase;
      invariant(isAvalonQuestRound(phase.round), 'vote round');
      invariant(
        phase.proposedSeats.length === getAvalonQuestSize(count, phase.round) &&
          phase.proposedSeats.every((seat) => isSeat(seat) && isAvalonOccupiedSeat(state, seat)) &&
          new Set(phase.proposedSeats).size === phase.proposedSeats.length,
        'vote proposal',
      );
      invariant(isValidBallots(phase.ballots, state, isSeat), 'vote ballots');
      return state;
    }
    case 'quest': {
      const phase = state.phase;
      invariant(isAvalonQuestRound(phase.round), 'quest round');
      invariant(
        phase.teamSeats.length === getAvalonQuestSize(count, phase.round) &&
          phase.teamSeats.every((seat) => isSeat(seat) && isAvalonOccupiedSeat(state, seat)) &&
          new Set(phase.teamSeats).size === phase.teamSeats.length,
        'quest team',
      );
      invariant(
        Object.keys(phase.plays).every((seatKey) => {
          const seat = Number(seatKey);
          const play: AvalonPlay | undefined = phase.plays[seat];
          return (
            phase.teamSeats.includes(seat) &&
            (play === 'success' || play === 'fail') &&
            // 好人只能出成功牌。
            (play !== 'fail' || isAvalonEvilRole(state.roles[seat]!))
          );
        }),
        'quest plays',
      );
      invariant(isValidBallots(phase.ballots, state, isSeat), 'quest ballots');
      invariant(
        phase.approveCount + phase.rejectCount + phase.abstainCount === occupiedCount(state, count),
        'quest vote counts',
      );
      return state;
    }
    case 'lady': {
      const phase = state.phase;
      invariant(count >= AVALON_LADY_MIN_PLAYERS, 'lady needs 9+ players');
      invariant(
        phase.afterRound === 2 || phase.afterRound === 3 || phase.afterRound === 4,
        'lady round',
      );
      invariant(isSeat(phase.holderSeat), 'lady holder seat');
      invariant(
        phase.examinedSeats.includes(phase.holderSeat) &&
          phase.examinedSeats.every(isSeat) &&
          new Set(phase.examinedSeats).size === phase.examinedSeats.length,
        'lady examined seats',
      );
      invariant(
        phase.targetSeat === null ||
          (isSeat(phase.targetSeat) &&
            isAvalonOccupiedSeat(state, phase.targetSeat) &&
            phase.targetSeat !== phase.holderSeat &&
            !phase.examinedSeats.includes(phase.targetSeat)),
        'lady target',
      );
      return state;
    }
    case 'assassin':
      invariant(state.phase.accusedSeat === null, 'assassin accused seat');
      return state;
    case 'ended': {
      const phase = state.phase;
      invariant(phase.winner === 'good' || phase.winner === 'evil', 'winner');
      invariant(phase.accusedSeat === null || isSeat(phase.accusedSeat), 'ended accused seat');
      // 刺杀类终局必须记录被指认座位。
      const needsAccused =
        phase.reason === 'assassinationHit' ||
        phase.reason === 'assassinationMiss' ||
        phase.reason === 'earlyAssassinationHit' ||
        phase.reason === 'earlyAssassinationMiss';
      invariant(
        needsAccused ? phase.accusedSeat !== null : phase.accusedSeat === null,
        'ended accused seat presence',
      );
      return state;
    }
  }
}

function normalizeNightInfo(info: {
  readonly evilPeers: Readonly<Record<number, readonly number[]>>;
  readonly merlinSees: readonly number[];
  readonly percivalSees: readonly number[];
}) {
  const evilPeers: Record<number, readonly number[]> = {};
  for (const key of Object.keys(info.evilPeers).sort()) {
    evilPeers[Number(key)] = [...info.evilPeers[Number(key)]!].sort((a, b) => a - b);
  }
  return {
    evilPeers,
    merlinSees: [...info.merlinSees].sort((a, b) => a - b),
    percivalSees: [...info.percivalSees].sort((a, b) => a - b),
  };
}

function occupiedCount(state: AvalonState, count: number): number {
  let total = 0;
  for (let seat = 0; seat < count; seat += 1) {
    if (isAvalonOccupiedSeat(state, seat)) total += 1;
  }
  return total;
}

function isValidBallots(
  ballots: Readonly<Record<number, AvalonBallot>>,
  state: AvalonState,
  isSeat: (seat: number) => boolean,
): boolean {
  return Object.keys(ballots).every((seatKey) => {
    const seat = Number(seatKey);
    const vote = ballots[seat];
    return (
      isSeat(seat) && isAvalonOccupiedSeat(state, seat) && (vote === 'approve' || vote === 'reject')
    );
  });
}
