import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import { STEP_SKIP_ACTION_KEY, type StepDefinition } from '../../../platform/steps/step';
import type { WerewolfNightFacts, WerewolfRoleStepContext, WerewolfRoleStepResult } from './role';
import { getActingSeat } from './roleSteps';

const COPY = defineCopy({
  name: '狼人',
  title: '袭击',
  prompt: '请选择今晚的袭击目标',
  attack: '袭击{seat}',
  abstain: '放弃袭击',
  blockedTarget: '该角色免疫狼人袭击',
  nightmareLocked: '被噩梦之影恐惧，本夜无法袭击',
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
  actors: (context) =>
    context.state.nightNumber === 1 && context.nightPresence.isFirstNightWolfAttackDisabled
      ? []
      : getWolfVoters(context),
  actions: [
    {
      kind: 'pickSeats',
      key: 'wolfKill',
      name: COPY.title,
      count: { min: 0, max: 1 },
      prompt: COPY.prompt,
      commit: 'revisable',
      seats: (context) =>
        context.state.seatedSeats.map((seat) => ({
          seat,
          unavailableReason: context.isImmuneToAttack(seat, 'wolfKill') ? COPY.blockedTarget : null,
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
  ],
  skippable: () => false,
  lock: (context) => {
    if (context.seat === null) return null;
    return isWolfVoteDisabled(context, context.seat) ? COPY.nightmareLocked : null;
  },
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
    if (context.state.nightNumber === 1 && context.nightPresence.isFirstNightWolfAttackDisabled) {
      return { kind: 'complete' };
    }
    const activeVoters = getWolfVoters(context).filter(
      (seat) => !isWolfVoteDisabled(context, seat),
    );
    if (activeVoters.length === 0) return { kind: 'complete' };
    const votes = activeVoters.map((seat) =>
      context.record.bySeat[seat]?.submissions.find(
        (submission) =>
          submission.actionKey === 'wolfKill' || submission.actionKey === STEP_SKIP_ACTION_KEY,
      ),
    );
    if (votes.some((vote) => vote === undefined)) return { kind: 'pending' };
    if (context.nightPresence.doesWolfVoteRequireUnanimity) {
      const targets = new Set(
        votes.map((vote) =>
          vote?.actionKey === STEP_SKIP_ACTION_KEY ? null : (vote?.seats[0] ?? null),
        ),
      );
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

function isWolfVoteDisabled(context: WerewolfRoleStepContext, seat: number): boolean {
  const roleId = context.role.roleOf(seat);
  return context.facts.disabledAbilities.some(
    (ability) =>
      ability.seat === seat &&
      (ability.roleId === '*' || ability.roleId === 'wolfKill' || ability.roleId === roleId),
  );
}
