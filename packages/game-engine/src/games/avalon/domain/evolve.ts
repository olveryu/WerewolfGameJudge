/** Applies Avalon domain events; reset paths clear all game-owned state. */

import { markSeatViewed } from '../../../platform/room/identityViewing';
import {
  AVALON_LADY_MIN_PLAYERS,
  type AvalonLastVoteResult,
  type AvalonQuestRound,
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

/** Evolves a committed domain event without persistence or broadcasts. */
export function evolveAvalonState(state: AvalonState, event: AvalonEvent): AvalonState {
  const bumped = { ...state, phaseRevision: state.phaseRevision + 1 };
  switch (event.type) {
    case 'avalon.seats.changed': {
      const realSeats = { ...state.realSeats };
      for (const change of event.changes) {
        if (change.next === null) delete realSeats[change.seat];
        else realSeats[change.seat] = change.next;
      }
      return {
        ...bumped,
        realSeats,
        excludedBotSeats: [...event.excludedBotSeats],
        fillEmptySeatsWithBots: event.fillEmptySeatsWithBots,
      };
    }
    case 'avalon.config.updated':
      return { ...bumped, config: event.config };
    case 'avalon.game.started':
      return {
        ...resetAvalonGame(state),
        phaseRevision: state.phaseRevision + 1,
        phase: { kind: 'night', step: 'evilReveal', confirmedSeats: [] },
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
        },
      };
    }
    case 'avalon.audio.queued': {
      if (event.effects.length === 0) return state;
      return {
        ...bumped,
        pendingAudioEffects: [...event.effects],
        isAudioPlaying: true,
      };
    }
    case 'avalon.audio.cleared': {
      if (!state.isAudioPlaying && state.pendingAudioEffects.length === 0) return state;
      return { ...bumped, pendingAudioEffects: [], isAudioPlaying: false };
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
        },
        // 新一轮组队开始，上一轮的结算面板不再展示。
        lastVoteResult: null,
      };
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
            ballots: { ...event.ballots },
            approveCount: event.approveCount,
            rejectCount: event.rejectCount,
            abstainCount: event.abstainCount,
          },
          lastVoteResult,
          rejectStreak: 0,
        };
      }
      return {
        ...bumped,
        phase: {
          kind: 'nominate',
          round: state.phase.round,
          requiredSize: getAvalonQuestSize(state.config.numberOfPlayers, state.phase.round),
        },
        lastVoteResult,
        leaderSeat: event.nextLeaderSeat,
        rejectStreak: state.rejectStreak + 1,
      };
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
