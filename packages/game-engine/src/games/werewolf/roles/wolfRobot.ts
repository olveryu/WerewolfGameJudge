import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import type { SeatSubmissionForReview } from '../../../platform/steps/step';
import { STEP_SKIP_ACTION_KEY } from '../../../platform/steps/step';
import type { SeatRecord } from '../../../platform/steps/types';
import { defineWerewolfStepAudio } from './audio';
import { resolveTargetSelection } from './location';
import type {
  WerewolfRoleStepContext,
  WerewolfRoleStepDefinition,
  WerewolfRoleStepResult,
} from './role';
import { defineRole } from './role';
import { getActingSeat, getRoleAbilityLockReason, renderIdentityCheckResult } from './roleSteps';

const COPY = defineCopy({
  name: '机械狼人',
  shortName: '机',
  emoji: '🤖🐺',
  description:
    '首夜可学习一名玩家的技能并获知其身份；学习到的技能当夜不能使用，次夜可用；学习其他角色时正常继承其技能；与其他狼人互不相认；不能自爆；若学习到守卫，从次夜起可守护一名玩家；机械狼人守护的玩家被毒杀时，毒药反弹至施法者自身；若学习到狼人，可额外袭击一名玩家，限用一次；其他狼人全部出局后可主导袭击',
  stepTitle: '学习',
  prompt: '请选择要学习的玩家',
  selfDisallowed: '不能选择自己',
  viewKey: 'wolfRobotHunterStatus',
  viewTitle: '技能状态',
  canShoot: '可以发动技能',
  cannotShoot: '不能发动技能',
  resultTitle: '学习结果',
  actualLanding: '（实际为{seat}）',
});

const LEARN_ACTION_KEY = 'wolfRobotLearn';

const wolfRobotLearnStep: WerewolfRoleStepDefinition = {
  id: LEARN_ACTION_KEY,
  title: COPY.stepTitle,
  audio: defineWerewolfStepAudio('wolfRobot'),
  actors: (context) =>
    context.state.nightNumber === 1
      ? context.state.seatedSeats.filter((seat) =>
          context.role.activeRoleIdsOf(seat).includes('wolfRobot'),
        )
      : [],
  actions: [
    {
      kind: 'pickSeats',
      key: LEARN_ACTION_KEY,
      name: COPY.stepTitle,
      count: { min: 1, max: 1 },
      prompt: COPY.prompt,
      seats: (context) =>
        context.state.seatedSeats.map((seat) => ({
          seat,
          unavailableReason: seat === context.seat ? COPY.selfDisallowed : null,
        })),
      resolve: (context, [chosenSeat]) => {
        if (chosenSeat === undefined) throw new Error('[FAIL-FAST] Wolf robot has no target');
        const actorSeat = getActingSeat(context);
        const selection = resolveTargetSelection(chosenSeat, context.state.location);
        const result: WerewolfRoleStepResult = {
          kind: 'identityCheck',
          ...selection,
          roleId: context.role.roleOf(selection.landingSeat),
        };
        return {
          facts: {
            selections: [{ roleId: 'wolfRobot', actorSeat, ...selection }],
            identityChanges: [
              { kind: 'grantBorrowedAbility', seat: actorSeat, roleId: result.roleId },
            ],
            sightOverrides: [{ seat: actorSeat, roleId: result.roleId }],
            disabledAbilities: [{ roleId: result.roleId, seat: actorSeat }],
            cardSelections: [],
            deathEffects: [],
          },
          result,
        };
      },
    },
    {
      kind: 'view',
      key: COPY.viewKey,
      name: COPY.viewTitle,
      title: COPY.viewTitle,
      availability: (context) => {
        const result = getActorRecord(context)?.result;
        return result?.kind === 'identityCheck' && result.roleId === 'hunter'
          ? { kind: 'available' }
          : { kind: 'hidden' };
      },
      content: (context) =>
        context.canShootAtNight(getActingSeat(context), 'hunter')
          ? COPY.canShoot
          : COPY.cannotShoot,
      reviewPhrase: () => null,
    },
  ],
  skippable: () => true,
  lock: (context) => getRoleAbilityLockReason(context, 'wolfRobot'),
  renderResult: (context, result) => renderIdentityCheckResult(context, result, COPY.resultTitle),
  reviewSubject: () => COPY.name,
  reviewSuffix: (context, submission: SeatSubmissionForReview) => {
    if (submission.actionKey !== LEARN_ACTION_KEY) return null;
    const chosenSeat = submission.seats[0];
    if (chosenSeat === undefined) return null;
    const landingSeat = context.role.landing(chosenSeat);
    return landingSeat === chosenSeat
      ? null
      : renderCopy(COPY.actualLanding, { seat: formatSeat(landingSeat) });
  },
  isSeatSettled: (context, record) => {
    if (record.submissions.some((submission) => submission.actionKey === STEP_SKIP_ACTION_KEY)) {
      return true;
    }
    if (record.result !== null && !record.isResultAcknowledged) return false;
    if (record.result?.kind !== 'identityCheck' || record.result.roleId !== 'hunter') {
      return record.submissions.some((submission) => submission.actionKey === LEARN_ACTION_KEY);
    }
    return record.submissions.some((submission) => submission.actionKey === COPY.viewKey);
  },
};

function getActorRecord(
  context: WerewolfRoleStepContext,
): SeatRecord<WerewolfRoleStepResult> | undefined {
  return context.seat === null ? undefined : context.record.bySeat[context.seat];
}

export const wolfRobot = defineRole({
  id: 'wolfRobot',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: COPY.emoji,
    description: COPY.description,
  },
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: false, participatesInWolfVote: false },
  },
  nightSchedule: 'firstNight',
  steps: [wolfRobotLearnStep],
});
