import { defineCopy, renderCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep } from './roleSteps';

const COPY = defineCopy({
  name: '噩梦之影',
  shortName: '魇',
  description:
    '每晚在多数角色行动之前恐惧一名玩家，使其当夜无法使用技能；不能连续两晚恐惧同一人；首夜行动时尚未与狼队互认；若恐惧到狼人，狼人阵营当夜无法袭击',
  skillText: '每晚在多数角色行动之前恐惧一名玩家，使其当夜无法使用技能',
  restrictionText: '不能连续两晚恐惧同一人',
  specialText: '首夜行动时尚未与狼队互认；若恐惧到狼人，狼人阵营当夜无法袭击',
  action: '恐惧',
  blockedRole: '（{role}，技能无效）',
  locked: '被噩梦之影恐惧，本夜无法使用技能',
  lockedStatus: '你被噩梦之影恐惧，本夜无法使用技能',
  wolfAttackLocked: '被噩梦之影恐惧，本夜无法袭击',
  wolfAttackReview: '狼队放弃袭击，被噩梦之影恐惧',
});

export const nightmare = defineRole({
  id: 'nightmare',
  abilityLock: { reason: COPY.locked, status: COPY.lockedStatus },
  wolfAttackLock: { reason: COPY.wolfAttackLocked, review: COPY.wolfAttackReview },
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '😱',
    description: COPY.description,
    sections: {
      skill: COPY.skillText,
      restriction: COPY.restrictionText,
      special: COPY.specialText,
    },
    tags: ['control'],
  },
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true, actsSolo: true },
  },
  steps: [
    createSingleTargetStep({
      id: 'nightmareBlock',
      roleId: 'nightmare',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: true,
      reviewSuffix: (context, chosenSeat) =>
        renderCopy(COPY.blockedRole, {
          role: context.roleNameOf(context.role.roleOf(context.role.landing(chosenSeat))),
        }),
      selectionEffects: (context, selection) => {
        const targetRole = context.role.roleOf(selection.landingSeat);
        const wolfVoteDisabled = context.factionOfRole(targetRole) === 'wolf';
        return {
          disabledAbilities: [
            { roleId: '*', seat: selection.landingSeat, sourceRoleId: 'nightmare' },
            ...(wolfVoteDisabled
              ? context.state.seatedSeats
                  .filter((seat) => context.doesRoleVoteWithWolves(context.role.roleOf(seat)))
                  .map((seat) => ({ roleId: 'wolfKill', seat, sourceRoleId: 'nightmare' }))
              : []),
          ],
          deathEffects: [],
        };
      },
    }),
  ],
});
