/** 阿瓦隆房间交互策略单测：阶段选型、私密投影、投票/出牌/查验/刺杀 gating。 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';

import {
  AVALON_END_REASON_COPY,
  eligibleStrikeTargets,
  resolveAssassinInstruction,
  resolveAvalonStageKind,
  resolveEndedInstruction,
  resolveLadyInstruction,
  resolveNightInstruction,
  resolveNominateInstruction,
  resolveQuestInstruction,
  resolveVoteInstruction,
} from '../policy/avalonInteractionPolicy';

function baseViewModel(overrides: Partial<AvalonViewModel> = {}): AvalonViewModel {
  return {
    phase: 'lobby',
    mySeat: 0,
    myRole: 'loyalServant',
    seats: [0, 1, 2, 3, 4].map((seat) => ({
      seat,
      displayName: `玩家${seat + 1}`,
      isBot: false,
      isLeader: seat === 0,
      role: null,
    })),
    leaderSeat: 0,
    nightStep: null,
    evilPeers: null,
    merlinSees: null,
    percivalSees: null,
    nightConfirmed: false,
    requiredSize: null,
    proposedSeats: null,
    teamSeats: null,
    myBallot: null,
    ballots: null,
    voteCounts: null,
    myPlay: null,
    questResults: [],
    questHistory: [],
    lady: null,
    ladyCheckResult: null,
    isAssassin: false,
    canEarlyStrike: false,
    accusedSeat: null,
    winner: null,
    endReason: null,
    rejectStreak: 0,
    vetoLimit: 5,
    voteMode: 'public',
    lastVoteResult: null,
    ...overrides,
  };
}

describe('resolveAvalonStageKind', () => {
  it.each([
    ['night', 'night'],
    ['nominate', 'nominate'],
    ['vote', 'vote'],
    ['quest', 'quest'],
    ['lady', 'lady'],
    ['assassin', 'assassin'],
    ['ended', 'ended'],
  ] as const)('maps the %s phase to the %s view', (phaseKind, expected) => {
    expect(resolveAvalonStageKind({ kind: phaseKind } as never)).toBe(expected);
  });

  it('throws for the lobby phase', () => {
    expect(() => resolveAvalonStageKind({ kind: 'lobby' })).toThrow(
      '[FAIL-FAST] Avalon workspace received the lobby phase',
    );
  });
});

describe('resolveNightInstruction', () => {
  it('shows evil peers to a bad player', () => {
    const instruction = resolveNightInstruction(
      baseViewModel({ phase: 'night', nightStep: 'evilReveal', evilPeers: [1, 2] }),
    );
    expect(instruction).toEqual({ kind: 'evilPeers', peers: [1, 2], isAlone: false });
  });

  it('marks Oberon as alone when no peers are visible', () => {
    const instruction = resolveNightInstruction(
      baseViewModel({ phase: 'night', nightStep: 'evilReveal', evilPeers: [] }),
    );
    expect(instruction).toEqual({ kind: 'evilPeers', peers: [], isAlone: true });
  });

  it('shows the seen evils to Merlin', () => {
    const instruction = resolveNightInstruction(
      baseViewModel({ phase: 'night', nightStep: 'merlinReveal', merlinSees: [3] }),
    );
    expect(instruction).toEqual({ kind: 'merlin', sees: [3] });
  });

  it('shows Merlin and Morgana to Percival', () => {
    const instruction = resolveNightInstruction(
      baseViewModel({ phase: 'night', nightStep: 'percivalReveal', percivalSees: [0, 1] }),
    );
    expect(instruction).toEqual({ kind: 'percival', sees: [0, 1] });
  });

  it('shows waiting to non-participants', () => {
    expect(
      resolveNightInstruction(baseViewModel({ phase: 'night', nightStep: 'merlinReveal' })),
    ).toEqual({ kind: 'waiting' });
  });

  it('shows confirmed after the viewer confirms', () => {
    expect(
      resolveNightInstruction(
        baseViewModel({
          phase: 'night',
          nightStep: 'merlinReveal',
          merlinSees: [3],
          nightConfirmed: true,
        }),
      ),
    ).toEqual({ kind: 'confirmed' });
  });
});

describe('resolveNominateInstruction', () => {
  it('identifies the leader', () => {
    expect(
      resolveNominateInstruction(baseViewModel({ leaderSeat: 2, requiredSize: 3 }), 2),
    ).toEqual({ isLeader: true, leaderSeat: 2, requiredSize: 3 });
  });

  it('marks non-leaders as waiting', () => {
    expect(
      resolveNominateInstruction(baseViewModel({ leaderSeat: 2, requiredSize: 3 }), 0),
    ).toEqual({ isLeader: false, leaderSeat: 2, requiredSize: 3 });
  });

  it('throws without nominate data', () => {
    expect(() => resolveNominateInstruction(baseViewModel(), 0)).toThrow(
      '[FAIL-FAST] Avalon nominate instruction without nominate data',
    );
  });
});

describe('resolveVoteInstruction', () => {
  it('exposes the viewer ballot and public ballots', () => {
    const instruction = resolveVoteInstruction(
      baseViewModel({ phase: 'vote', myBallot: 'approve', ballots: { 0: 'approve', 1: 'reject' } }),
    );
    expect(instruction.canVote).toBe(true);
    expect(instruction.myBallot).toBe('approve');
    expect(instruction.ballots).toEqual({ 0: 'approve', 1: 'reject' });
  });

  it('hides personal ballots in secret vote mode', () => {
    const instruction = resolveVoteInstruction(
      baseViewModel({
        phase: 'vote',
        voteMode: 'secret',
        voteCounts: { approve: 3, reject: 2, abstain: 0 },
      }),
    );
    expect(instruction.ballots).toBeNull();
    expect(instruction.voteCounts).toEqual({ approve: 3, reject: 2, abstain: 0 });
  });

  it('disallows voting without a seat', () => {
    expect(resolveVoteInstruction(baseViewModel({ mySeat: null })).canVote).toBe(false);
  });
});

describe('resolveQuestInstruction', () => {
  it('only shows the success card to good players', () => {
    const instruction = resolveQuestInstruction(
      baseViewModel({ phase: 'quest', myRole: 'merlin', teamSeats: [0, 1], myPlay: null }),
    );
    expect(instruction.isTeamMember).toBe(true);
    expect(instruction.availableCards).toEqual(['success']);
  });

  it('shows both cards to evil players', () => {
    const instruction = resolveQuestInstruction(
      baseViewModel({ phase: 'quest', myRole: 'assassin', teamSeats: [1, 2], mySeat: 1 }),
    );
    expect(instruction.availableCards).toEqual(['success', 'fail']);
  });

  it('never reveals other players plays', () => {
    const instruction = resolveQuestInstruction(
      baseViewModel({ phase: 'quest', myRole: 'morgana', teamSeats: [0, 1], myPlay: 'fail' }),
    );
    expect(instruction.myPlay).toBe('fail');
    expect(instruction.isTeamMember).toBe(true);
  });
});

describe('resolveLadyInstruction', () => {
  it('lets the holder pick from eligible seats', () => {
    const instruction = resolveLadyInstruction(
      baseViewModel({
        phase: 'lady',
        mySeat: 1,
        lady: {
          holderSeat: 1,
          examinedSeats: [1, 3],
          targetSeat: null,
          canCheck: true,
          needsAcknowledge: false,
        },
      }),
    );
    expect(instruction).toEqual({ kind: 'holderPick', eligibleSeats: [0, 2, 4] });
  });

  it('prompts the target to confirm', () => {
    expect(
      resolveLadyInstruction(
        baseViewModel({
          phase: 'lady',
          mySeat: 2,
          lady: {
            holderSeat: 1,
            examinedSeats: [1],
            targetSeat: 2,
            canCheck: false,
            needsAcknowledge: true,
          },
        }),
      ),
    ).toEqual({ kind: 'targetConfirm', holderSeat: 1 });
  });

  it('shows waiting to everyone else once a target is chosen', () => {
    expect(
      resolveLadyInstruction(
        baseViewModel({
          phase: 'lady',
          mySeat: 0,
          lady: {
            holderSeat: 1,
            examinedSeats: [1],
            targetSeat: 2,
            canCheck: false,
            needsAcknowledge: false,
          },
        }),
      ),
    ).toEqual({ kind: 'holderWait', targetSeat: 2 });
  });

  it('throws without lady data', () => {
    expect(() => resolveLadyInstruction(baseViewModel({ phase: 'lady' }))).toThrow(
      '[FAIL-FAST] Avalon lady instruction without lady data',
    );
  });
});

describe('resolveAssassinInstruction', () => {
  it('lets the assassin pick', () => {
    expect(
      resolveAssassinInstruction(baseViewModel({ phase: 'assassin', isAssassin: true })),
    ).toEqual({ kind: 'assassinPick' });
  });

  it('shows the evil waiting copy to other evil players', () => {
    expect(
      resolveAssassinInstruction(
        baseViewModel({ phase: 'assassin', myRole: 'morgana', isAssassin: false }),
      ),
    ).toEqual({ kind: 'evilWait' });
  });

  it('shows the good waiting copy to good players', () => {
    expect(
      resolveAssassinInstruction(baseViewModel({ phase: 'assassin', myRole: 'merlin' })),
    ).toEqual({ kind: 'goodWait' });
  });
});

describe('eligibleStrikeTargets', () => {
  it('excludes the assassin themself', () => {
    expect(eligibleStrikeTargets(baseViewModel({ mySeat: 1 }))).toEqual([0, 2, 3, 4]);
  });
});

describe('resolveEndedInstruction', () => {
  it('exposes the winner and reason', () => {
    expect(
      resolveEndedInstruction(
        baseViewModel({ phase: 'ended', winner: 'evil', endReason: 'assassinationHit' }),
      ),
    ).toEqual({ winner: 'evil', reason: 'assassinationHit', accusedSeat: null });
  });

  it('throws without a winner', () => {
    expect(() => resolveEndedInstruction(baseViewModel({ phase: 'ended' }))).toThrow(
      '[FAIL-FAST] Avalon ended instruction without winner',
    );
  });

  it('has Chinese copy for every end reason', () => {
    expect(Object.keys(AVALON_END_REASON_COPY).sort()).toEqual([
      'assassinationHit',
      'assassinationMiss',
      'earlyAssassinationHit',
      'earlyAssassinationMiss',
      'threeFail',
      'vetoLimitReached',
    ]);
    for (const copy of Object.values(AVALON_END_REASON_COPY)) {
      expect(copy.title).toMatch(/获胜/);
      expect(copy.description.length).toBeGreaterThan(0);
    }
  });
});
