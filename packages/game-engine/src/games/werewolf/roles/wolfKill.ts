import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import type { StepDefinition } from '../../../platform/steps/step';
import type { WerewolfNightFacts, WerewolfRoleStepContext, WerewolfRoleStepResult } from './role';
import { getActingSeat } from './roleSteps';

const COPY = defineCopy({
  name: '狼人',
  title: '袭击',
  prompt: '请选择今晚的袭击目标',
  attack: '袭击{seat}',
  abstain: '放弃袭击',
  withdraw: '撤回袭击投票',
  blockedTarget: '该角色不能被狼人直接袭击',
  nightmareLocked: '被噩梦之影恐惧，本夜无法袭击',
  poisonerLocked: '本局有毒师在场，首夜无法袭击',
  actualLanding: '（实际为{seat}）',
  unanimousHint: '投票不一致将视为放弃袭击',
  majorityHint: '平票将随机刀人',
});

export const wolfKillStep: StepDefinition<
  string,
  WerewolfRoleStepContext,
  WerewolfNightFacts,
  WerewolfRoleStepResult
> = {
  id: 'wolfKill',
  title: COPY.title,
  audio: () => ({ begin: 'wolf', end: 'wolf' }),
  actors: getWolfVoters,
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
  ruleHints: (context) => [
    context.nightPresence.doesWolfVoteRequireUnanimity ? COPY.unanimousHint : COPY.majorityHint,
  ],
  reviewSubject: () => COPY.name,
  reviewSuffix: (context, submission) => {
    const chosenSeat = submission.seats[0];
    if (chosenSeat === undefined) return null;
    const landingSeat = context.role.landing(chosenSeat);
    return landingSeat === chosenSeat
      ? null
      : renderCopy(COPY.actualLanding, { seat: formatSeat(landingSeat) });
  },
  completion: (context) => {
    const voters = getWolfVoters(context);
    const activeVoters = voters.filter((seat) => getWolfVoteLockReason(context, seat) === null);
    const requiredVoters = activeVoters.length === 0 ? voters : activeVoters;
    const votes = requiredVoters.map((seat) =>
      context.record.bySeat[seat]?.submissions.find(
        (submission) =>
          submission.actionKey === 'wolfKill' || submission.actionKey === 'wolfKillAbstain',
      ),
    );
    if (votes.some((vote) => vote === undefined)) return { kind: 'pending' };
    if (activeVoters.length === 0) return { kind: 'complete' };
    if (context.nightPresence.doesWolfVoteRequireUnanimity) {
      const targets = new Set(votes.map((vote) => vote?.seats[0] ?? null));
      if (targets.size > 1) return { kind: 'pending' };
    }
    return { kind: 'armCountdown' };
  },
};

function getWolfVoters(context: WerewolfRoleStepContext): readonly number[] {
  return context.state.seatedSeats.filter((seat) =>
    context.doesRoleVoteWithWolves(context.role.roleOf(seat)),
  );
}

function getRecordedWolfVote(context: WerewolfRoleStepContext) {
  const seat = getActingSeat(context);
  return context.record.bySeat[seat]?.submissions.find(
    (submission) =>
      submission.actionKey === 'wolfKill' || submission.actionKey === 'wolfKillAbstain',
  );
}

function isWolfVoteDisabled(context: WerewolfRoleStepContext, seat: number): boolean {
  const roleId = context.role.roleOf(seat);
  return context.facts.disabledAbilities.some(
    (ability) =>
      ability.seat === seat &&
      (ability.roleId === '*' || ability.roleId === 'wolfKill' || ability.roleId === roleId),
  );
}

function getWolfVoteLockReason(context: WerewolfRoleStepContext, seat: number): string | null {
  if (isWolfVoteDisabled(context, seat)) return COPY.nightmareLocked;
  return context.state.nightNumber === 1 && context.nightPresence.isFirstNightWolfAttackDisabled
    ? COPY.poisonerLocked
    : null;
}
