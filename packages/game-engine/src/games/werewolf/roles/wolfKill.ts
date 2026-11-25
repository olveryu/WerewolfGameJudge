import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderBlockedPrompt, renderCopy } from '../../../platform/steps';
import { defineWerewolfStepAudio } from './audio';
import type { WerewolfRoleStepContext, WerewolfRoleStepDefinition } from './role';
import { getActingSeat } from './roleSteps';

const COPY = defineCopy({
  name: '狼人',
  title: '袭击',
  prompt: '请选择今晚的袭击目标',
  attack: '袭击{seat}',
  abstain: '放弃袭击',
  withdraw: '撤回袭击投票',
  blockedTarget: '该角色不能被狼人直接袭击',
  actualLanding: '（实际为{seat}）',
  unanimousHint: '投票不一致将视为放弃袭击',
  majorityHint: '平票将随机刀人',
  reviewShared: '狼队（{voters}号）袭击{seat}',
  reviewMajority: '按多数票击杀{seat}',
  reviewTiePicked: '平票抽中{seat}',
  reviewSplit: '狼队放弃袭击',
  reviewDisagreement: '狼队投票不一致（{votes}），{verdict}',
  reviewVote: '{actor}投{target}',
  reviewVoteSeparator: '、',
  reviewAbstained: '狼队放弃袭击',
  voterSeparator: '、',
});

/** The wolves' shared step is announced and labelled as the plain wolf's. */
export const WOLF_KILL_STEP_OWNER_ROLE_ID = 'wolf' as const;

export const wolfKillStep: WerewolfRoleStepDefinition = {
  id: 'wolfKill',
  wolfPackViewers: 'wolfVoters',
  title: COPY.title,
  audio: defineWerewolfStepAudio('wolf'),
  actors: getWolfVoters,
  progressActors: getRequiredWolfVoters,
  actions: [
    {
      kind: 'pickSeats',
      key: 'wolfKill',
      name: COPY.title,
      count: { min: 1, max: 1 },
      prompt: COPY.prompt,
      commit: 'revisable',
      revisionGroup: 'wolfVote',
      availability: (context) => {
        const reason = getWolfVoteLockReason(context, getActingSeat(context));
        return reason === null ? { kind: 'available' } : { kind: 'unavailable', reason };
      },
      seats: (context) =>
        context.state.seatedSeats.map((seat) => ({
          seat,
          unavailableReason: context.isWolfKillTargetForbidden(seat) ? COPY.blockedTarget : null,
        })),
      phrase: (seats) =>
        seats[0] === undefined
          ? COPY.abstain
          : renderCopy(COPY.attack, { seat: formatSeat(seats[0]) }),
      resolve: (context, seats) => {
        const actorSeat = getActingSeat(context);
        const chosenSeat = seats[0] ?? null;
        const landingSeat = chosenSeat === null ? null : context.role.landing(chosenSeat);
        return {
          facts: {
            wolfVotes: [{ actorSeat, chosenSeat, landingSeat }],
          },
        };
      },
    },
    {
      kind: 'direct',
      key: 'wolfKillAbstain',
      name: COPY.abstain,
      commit: 'revisable',
      revisionGroup: 'wolfVote',
      resolve: (context) => ({
        facts: {
          wolfVotes: [{ actorSeat: getActingSeat(context), chosenSeat: null, landingSeat: null }],
        },
      }),
    },
    {
      kind: 'direct',
      key: 'wolfKillWithdraw',
      name: COPY.withdraw,
      availability: (context) =>
        getRecordedWolfVote(context) === undefined ? { kind: 'hidden' } : { kind: 'available' },
      resolve: (context) => {
        const vote = getRecordedWolfVote(context);
        if (vote === undefined) throw new Error('[FAIL-FAST] No wolf vote to withdraw');
        return { withdrawActionKey: vote.actionKey };
      },
    },
  ],
  skippable: () => false,
  // A pack that cannot attack is told why and to give up; how votes are counted no longer matters.
  situationHints: (context) => {
    const reason = getWolfVoteLockReason(context, getActingSeat(context));
    return reason === null ? [] : [renderBlockedPrompt(reason, COPY.abstain)];
  },
  ruleHints: (context) => {
    if (getWolfVoteLockReason(context, getActingSeat(context)) !== null) return [];
    return [
      context.nightPresence.doesWolfVoteRequireUnanimity ? COPY.unanimousHint : COPY.majorityHint,
    ];
  },
  reviewSubject: () => COPY.name,
  reviewSuffix: (context, submission) => {
    const chosenSeat = submission.seats[0];
    if (chosenSeat === undefined) return null;
    const landingSeat = context.role.landing(chosenSeat);
    return landingSeat === chosenSeat
      ? null
      : renderCopy(COPY.actualLanding, { seat: formatSeat(landingSeat) });
  },
  reviewSummary: (context) => {
    const verdict = context.resolvedWolfKillVerdict;
    if (verdict === undefined) return [];
    if (verdict === null) {
      const stoppedBy =
        context.nightPresence.firstNightWolfAttackDisabledBy ??
        context.facts.disabledAbilities.find((ability) => ability.roleId === 'wolfKill')
          ?.sourceRoleId;
      if (stoppedBy === undefined) {
        throw new Error('[FAIL-FAST] The wolf attack was disabled without a recorded reason');
      }
      return [context.wolfAttackLockOf(stoppedBy).review];
    }
    if (verdict.type === 'allAbstain') return [COPY.reviewAbstained];
    if (verdict.type === 'splitTied') {
      return [
        renderCopy(COPY.reviewDisagreement, {
          votes: formatReviewVotes(context),
          verdict: COPY.reviewSplit,
        }),
      ];
    }
    const template =
      verdict.type === 'sharedTarget'
        ? COPY.reviewShared
        : verdict.type === 'splitKilled'
          ? COPY.reviewMajority
          : COPY.reviewTiePicked;
    const voters = Object.entries(context.record.bySeat)
      .filter(([, record]) =>
        record?.submissions.some((submission) => submission.actionKey === 'wolfKill'),
      )
      .map(([seat]) => Number(seat) + 1)
      .sort((first, second) => first - second)
      .join(COPY.voterSeparator);
    const chosen = renderCopy(template, { seat: formatSeat(verdict.targetSeat), voters });
    const landing = context.role.landing(verdict.targetSeat);
    const outcome =
      landing === verdict.targetSeat
        ? chosen
        : chosen + renderCopy(COPY.actualLanding, { seat: formatSeat(landing) });
    return [
      verdict.type === 'sharedTarget'
        ? outcome
        : renderCopy(COPY.reviewDisagreement, {
            votes: formatReviewVotes(context),
            verdict: outcome,
          }),
    ];
  },
  completion: (context) => {
    const requiredVoters = getRequiredWolfVoters(context);
    const votes = requiredVoters.map((seat) =>
      context.record.bySeat[seat]?.submissions.find(
        (submission) =>
          submission.actionKey === 'wolfKill' || submission.actionKey === 'wolfKillAbstain',
      ),
    );
    if (votes.some((vote) => vote === undefined)) return { kind: 'pending' };
    return { kind: 'armCountdown' };
  },
};

function getWolfVoters(context: WerewolfRoleStepContext): readonly number[] {
  return context.state.seatedSeats.filter((seat) =>
    context.doesRoleVoteWithWolves(context.role.roleOf(seat)),
  );
}

function getRequiredWolfVoters(context: WerewolfRoleStepContext): readonly number[] {
  const voters = getWolfVoters(context);
  const active = voters.filter((seat) => getWolfVoteLockReason(context, seat) === null);
  return active.length === 0 ? voters : active;
}

function getRecordedWolfVote(context: WerewolfRoleStepContext) {
  const seat = getActingSeat(context);
  return context.record.bySeat[seat]?.submissions.find(
    (submission) =>
      submission.actionKey === 'wolfKill' || submission.actionKey === 'wolfKillAbstain',
  );
}

function formatReviewVotes(context: WerewolfRoleStepContext): string {
  const votes = Object.entries(context.record.bySeat).flatMap(([seat, record]) => {
    const vote = record?.submissions.find((submission) => submission.actionKey === 'wolfKill');
    const target = vote?.seats[0];
    return target === undefined ? [] : [{ seat: Number(seat), target }];
  });
  const counts = new Map<number, number>();
  for (const vote of votes) counts.set(vote.target, (counts.get(vote.target) ?? 0) + 1);
  return votes
    .sort(
      (left, right) =>
        (counts.get(right.target) ?? 0) - (counts.get(left.target) ?? 0) ||
        left.target - right.target ||
        left.seat - right.seat,
    )
    .map((vote) => {
      const chosen = renderCopy(COPY.reviewVote, {
        actor: formatSeat(vote.seat),
        target: formatSeat(vote.target),
      });
      const landing = context.role.landing(vote.target);
      return landing === vote.target
        ? chosen
        : chosen + renderCopy(COPY.actualLanding, { seat: formatSeat(landing) });
    })
    .join(COPY.reviewVoteSeparator);
}

/** The role that keeps this seat from voting tonight, if any. */
function getWolfVoteLockSource(context: WerewolfRoleStepContext, seat: number): string | null {
  const roleId = context.role.roleOf(seat);
  const lock = context.facts.disabledAbilities.find(
    (ability) =>
      ability.seat === seat &&
      (ability.roleId === '*' || ability.roleId === 'wolfKill' || ability.roleId === roleId),
  );
  return lock?.sourceRoleId ?? context.nightPresence.firstNightWolfAttackDisabledBy;
}

function getWolfVoteLockReason(context: WerewolfRoleStepContext, seat: number): string | null {
  const source = getWolfVoteLockSource(context, seat);
  return source === null ? null : context.wolfAttackLockOf(source).reason;
}
