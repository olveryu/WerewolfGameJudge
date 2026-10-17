/** Applies Avalon domain events; reset paths clear all game-owned state. */

import { acknowledgeAudioQueue, queueAudioBatch } from '../../../platform/audio';
import { markSeatViewed } from '../../../platform/room/identityViewing';
import { applyRosterChanges } from '../../../platform/room/seating';
import {
  AVALON_LADY_MIN_PLAYERS,
  type AvalonLastVoteResult,
  type AvalonProposalRecord,
  type AvalonQuestRecord,
  type AvalonQuestRound,
  type AvalonRoundRecord,
  type AvalonState,
  isAvalonQuestRound,
} from '../state/types';
import type { AvalonEvent } from './decision';
import { getAvalonQuestSize, nextAvalonLeaderSeat } from './rules';

/** Resets mutable game data while preserving room configuration and seats. */
function resetAvalonGame(state: AvalonState): AvalonState {
  return {
    ...state,
    phase: { kind: 'lobby' },
    phaseRevision: state.phaseRevision + 1,
    roles: {},
    roleViewedSeats: [],
    nightInfo: { evilPeers: {}, merlinSees: [], percivalSees: [] },
    leaderSeat: -1,
    rejectStreak: 0,
    questResults: [],
    questHistory: [],
    roundHistory: [],
    ladyHolderSeat: null,
    ladyExaminedSeats: [],
    lastLadyCheck: null,
    lastVoteResult: null,
    xpSettled: false,
    pendingAudioEffects: [],
    isAudioPlaying: false,
  };
}

function isLadyRound(round: AvalonQuestRound): round is 2 | 3 | 4 {
  return round === 2 || round === 3 || round === 4;
}

/**
 * Appends a settled proposal to its round's record, creating the round
 * entry on first use. Records are immutable: prior rounds keep their
 * identity, the touched round is a fresh object.
 */
function appendAvalonProposalRecord(
  roundHistory: readonly AvalonRoundRecord[],
  round: AvalonQuestRound,
  proposal: AvalonProposalRecord,
): readonly AvalonRoundRecord[] {
  const existing = roundHistory.find((record) => record.round === round);
  if (existing === undefined) {
    return [...roundHistory, { round, proposals: [proposal], quest: null }];
  }
  return roundHistory.map((record) =>
    record.round === round ? { ...record, proposals: [...record.proposals, proposal] } : record,
  );
}

/**
 * Fills the quest outcome into the round whose approved proposal opened
 * the quest. The round entry always exists by then (the approval was
 * recorded when its vote settled); normalize enforces the mirror.
 */
function completeAvalonRoundQuest(
  roundHistory: readonly AvalonRoundRecord[],
  round: AvalonQuestRound,
  quest: AvalonQuestRecord,
): readonly AvalonRoundRecord[] {
  return roundHistory.map((record) => (record.round === round ? { ...record, quest } : record));
}

/** Evolves a committed domain event without persistence or broadcasts. */
export function evolveAvalonState(state: AvalonState, event: AvalonEvent): AvalonState {
  const bumped = { ...state, phaseRevision: state.phaseRevision + 1 };
  switch (event.type) {
    case 'avalon.seats.changed':
      return { ...bumped, roster: applyRosterChanges(state.roster, event.changes) };
    case 'avalon.config.updated':
      return { ...bumped, config: event.config };
    case 'avalon.game.started':
      return {
        ...resetAvalonGame(state),
        phaseRevision: state.phaseRevision + 1,
        // Dealing lands in the viewing stage; the night only opens
        // when the host begins the game after the checkpoint.
        phase: { kind: 'viewing' },
        // 身份查看协议：发牌时无人落标记；bot 座位由房主用脚手架
        // 动作标记，检查点对每个座位一视同仁。
        roleViewedSeats: [],
        roles: { ...event.roles },
        nightInfo: {
          evilPeers: { ...event.nightInfo.evilPeers },
          merlinSees: [...event.nightInfo.merlinSees],
          percivalSees: [...event.nightInfo.percivalSees],
        },
        leaderSeat: event.leaderSeat,
        ladyHolderSeat: event.ladyHolderSeat,
        ladyExaminedSeats: event.ladyHolderSeat === null ? [] : [event.ladyHolderSeat],
        gameSequence: event.gameSequence,
      };
    case 'avalon.game.begun': {
      if (state.phase.kind !== 'viewing') return state;
      return {
        ...bumped,
        phase: { kind: 'night', step: 'evilReveal', confirmedSeats: [] },
      };
    }
    case 'avalon.night.confirmed': {
      if (state.phase.kind !== 'night') return state;
      if (state.phase.confirmedSeats.includes(event.seat)) return state;
      return {
        ...bumped,
        phase: { ...state.phase, confirmedSeats: [...state.phase.confirmedSeats, event.seat] },
      };
    }
    case 'avalon.role.viewed': {
      if (state.roleViewedSeats.includes(event.seat)) return state;
      return { ...bumped, roleViewedSeats: markSeatViewed(state.roleViewedSeats, event.seat) };
    }
    case 'avalon.night.stepped': {
      if (state.phase.kind !== 'night') return state;
      return { ...bumped, phase: { kind: 'night', step: event.step, confirmedSeats: [] } };
    }
    case 'avalon.night.completed': {
      if (state.phase.kind !== 'night') return state;
      return {
        ...bumped,
        phase: {
          kind: 'nominate',
          round: 1,
          requiredSize: getAvalonQuestSize(state.config.numberOfPlayers, 1),
          draftSeats: [],
        },
      };
    }
    case 'avalon.audio.queued': {
      // The shared machine owns the transition (replace + gate close);
      // an empty batch cannot reach here — queueing fail-fasts in decide.
      return { ...bumped, ...queueAudioBatch(event.effects) };
    }
    case 'avalon.audio.cleared': {
      const cleared = acknowledgeAudioQueue(state);
      if (cleared === null) return state;
      return { ...bumped, ...cleared };
    }
    case 'avalon.team.draftUpdated': {
      if (state.phase.kind !== 'nominate') return state;
      return { ...bumped, phase: { ...state.phase, draftSeats: [...event.seats] } };
    }
    case 'avalon.team.proposed': {
      if (state.phase.kind !== 'nominate') return state;
      return {
        ...bumped,
        phase: {
          kind: 'vote',
          round: state.phase.round,
          proposedSeats: [...event.seats],
          ballots: {},
          deadlineAt: null,
        },
        // 新一轮组队开始，上一轮的结算面板不再展示。
        lastVoteResult: null,
      };
    }
    case 'avalon.vote.allCast': {
      if (state.phase.kind !== 'vote') return state;
      return { ...bumped, phase: { ...state.phase, deadlineAt: event.deadlineAt } };
    }
    case 'avalon.team.vote.cast': {
      if (state.phase.kind !== 'vote') return state;
      return {
        ...bumped,
        phase: { ...state.phase, ballots: { ...state.phase.ballots, [event.seat]: event.vote } },
      };
    }
    case 'avalon.vote.settled': {
      if (state.phase.kind !== 'vote') return state;
      // 投票结算面板（设计稿 §7）：三种路径都写入，展示后随下一阶段推进。
      const lastVoteResult: AvalonLastVoteResult = {
        approved: event.approved,
        rejectStreak: event.approved ? 0 : state.rejectStreak + 1,
        ballots: { ...event.ballots },
        approveCount: event.approveCount,
        rejectCount: event.rejectCount,
        abstainCount: event.abstainCount,
      };
      // 对局记录：每次组队投票结算（通过/否决/触发否决终局）都把本提案
      // 追加进本轮记录，否决提案不再被丢弃。
      const roundHistory = appendAvalonProposalRecord(state.roundHistory, state.phase.round, {
        leaderSeat: state.leaderSeat,
        teamSeats: [...state.phase.proposedSeats],
        ballots: { ...event.ballots },
        approveCount: event.approveCount,
        rejectCount: event.rejectCount,
        abstainCount: event.abstainCount,
        approved: event.approved,
      });
      if (event.vetoLimitReached) {
        return {
          ...bumped,
          phase: {
            kind: 'ended',
            winner: 'evil',
            reason: 'vetoLimitReached',
            accusedSeat: null,
          },
          lastVoteResult,
          roundHistory,
          xpSettled: true,
        };
      }
      if (event.approved) {
        return {
          ...bumped,
          phase: {
            kind: 'quest',
            round: state.phase.round,
            teamSeats: [...state.phase.proposedSeats],
            plays: {},
            deadlineAt: null,
            ballots: { ...event.ballots },
            approveCount: event.approveCount,
            rejectCount: event.rejectCount,
            abstainCount: event.abstainCount,
          },
          lastVoteResult,
          roundHistory,
          rejectStreak: 0,
        };
      }
      return {
        ...bumped,
        phase: {
          kind: 'nominate',
          round: state.phase.round,
          requiredSize: getAvalonQuestSize(state.config.numberOfPlayers, state.phase.round),
          draftSeats: [],
        },
        lastVoteResult,
        roundHistory,
        leaderSeat: event.nextLeaderSeat,
        rejectStreak: state.rejectStreak + 1,
      };
    }
    case 'avalon.quest.allPlayed': {
      if (state.phase.kind !== 'quest') return state;
      return { ...bumped, phase: { ...state.phase, deadlineAt: event.deadlineAt } };
    }
    case 'avalon.quest.played': {
      if (state.phase.kind !== 'quest') return state;
      return {
        ...bumped,
        phase: { ...state.phase, plays: { ...state.phase.plays, [event.seat]: event.play } },
      };
    }
    case 'avalon.quest.settled': {
      if (state.phase.kind !== 'quest') return state;
      const questResults = [...state.questResults, event.result];
      const questHistory = [...state.questHistory, event.historyEntry];
      const successes = questResults.filter((result) => result === 'success').length;
      const failures = questResults.filter((result) => result === 'fail').length;
      const settled = {
        ...bumped,
        questResults,
        questHistory,
        // 任务结论补进同轮记录（任务区与投票区自此同属一轮）。
        roundHistory: completeAvalonRoundQuest(state.roundHistory, event.round, {
          result: event.result,
          successCount: event.successCount,
          failCount: event.failCount,
        }),
      };
      if (successes >= 3) {
        return { ...settled, phase: { kind: 'assassin', accusedSeat: null } };
      }
      if (failures >= 3) {
        return {
          ...settled,
          phase: { kind: 'ended', winner: 'evil', reason: 'threeFail', accusedSeat: null },
          xpSettled: true,
        };
      }
      // 9/10 人局第 2/3/4 轮任务结算后进入湖仙查验（§2.3）。
      if (
        state.config.numberOfPlayers >= AVALON_LADY_MIN_PLAYERS &&
        isLadyRound(event.round) &&
        state.ladyHolderSeat !== null
      ) {
        return {
          ...settled,
          phase: {
            kind: 'lady',
            afterRound: event.round,
            holderSeat: state.ladyHolderSeat,
            examinedSeats: [...state.ladyExaminedSeats],
            targetSeat: null,
          },
        };
      }
      const nextRoundNumber = event.round + 1;
      if (!isAvalonQuestRound(nextRoundNumber)) return state;
      const nextRound = nextRoundNumber;
      return {
        ...settled,
        phase: {
          kind: 'nominate',
          round: nextRound,
          requiredSize: getAvalonQuestSize(state.config.numberOfPlayers, nextRound),
          draftSeats: [],
        },
        leaderSeat: nextAvalonLeaderSeat(state.leaderSeat, state.config.numberOfPlayers),
      };
    }
    case 'avalon.lady.checked': {
      if (state.phase.kind !== 'lady') return state;
      return {
        ...bumped,
        phase: { ...state.phase, targetSeat: event.targetSeat },
        lastLadyCheck: null,
      };
    }
    case 'avalon.lady.acknowledged': {
      if (state.phase.kind !== 'lady' || state.phase.targetSeat !== event.targetSeat) return state;
      return {
        ...bumped,
        phase: {
          kind: 'nominate',
          round: event.nextRound,
          requiredSize: event.nextRequiredSize,
          draftSeats: [],
        },
        leaderSeat: event.nextLeaderSeat,
        ladyHolderSeat: event.targetSeat,
        ladyExaminedSeats: [...state.ladyExaminedSeats, event.targetSeat],
        lastLadyCheck: {
          holderSeat: state.phase.holderSeat,
          targetSeat: event.targetSeat,
          faction: event.faction,
        },
      };
    }
    case 'avalon.game.ended':
      return {
        ...bumped,
        phase: {
          kind: 'ended',
          winner: event.winner,
          reason: event.reason,
          accusedSeat: event.accusedSeat,
        },
        xpSettled: true,
      };
    case 'avalon.game.returnedToLobby':
      return resetAvalonGame(state);
  }
}
