import { defineCopy } from '../../../platform/steps';
import type { PresenceDeclaration } from './presence';
import { defineRole } from './role';
import { createSingleTargetStep, getActingSeat } from './roleSteps';

const COPY = defineCopy({
  name: '毒师',
  shortName: '毒',
  description:
    '拥有一瓶毒药；可在夜间毒杀一名玩家；被毒杀的角色无法开枪；有毒师在场时首夜狼人无法袭击',
  skillText: '拥有一瓶毒药；可在夜间毒杀一名玩家',
  specialText: '被毒杀的角色无法开枪；有毒师在场时首夜狼人无法袭击',
  action: '毒杀',
  wolfAttackLocked: '本局有毒师在场，首夜无法袭击',
  wolfAttackReview: '狼队放弃袭击，毒师在场',
});

export const poisonerPresence = [
  { role: 'poisoner', effect: { kind: 'disableFirstNightWolfAttack' } },
] as const satisfies readonly PresenceDeclaration<'poisoner'>[];

export const poisoner = defineRole({
  id: 'poisoner',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '☠️',
    description: COPY.description,
    sections: { skill: COPY.skillText, special: COPY.specialText },
    tags: ['kill'],
  },
  traits: { faction: 'god', team: 'good' },
  presence: poisonerPresence[0],
  wolfAttackLock: { reason: COPY.wolfAttackLocked, review: COPY.wolfAttackReview },
  resources: [{ kind: 'poison', uses: 1, refreshPerNight: false }],
  steps: [
    createSingleTargetStep({
      id: 'poisonerPoison',
      roleId: 'poisoner',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: true,
      selectionEffects: (context, selection) => ({
        disabledAbilities: [],
        deathEffects: [
          {
            kind: 'attack',
            cause: 'poison',
            source: getActingSeat(context),
            target: selection.landingSeat,
          },
        ],
      }),
    }),
  ],
});
