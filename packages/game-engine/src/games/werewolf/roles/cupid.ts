import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import { defineWerewolfStepAudio } from './audio';
import { resolveTargetSelection } from './location';
import type { PresenceDeclaration } from './presence';
import type { WerewolfRoleStepDefinition } from './role';
import { defineRole } from './role';
import { createGroupConfirmStep, getActingSeat, getRoleAbilityLockReason } from './roleSteps';

export const cupidPresence = [
  { role: 'cupid', effect: { kind: 'requireUnanimousWolfVote' } },
] as const satisfies readonly PresenceDeclaration<'cupid'>[];

const COPY = defineCopy({
  name: '丘比特',
  shortName: '丘',
  emoji: '💘',
  description:
    '首夜选择两名玩家成为情侣（可含自身）；情侣互认但不知对方身份；任一情侣出局则另一人殉情；双好人时属好人阵营；双狼时属狼人阵营；一好一狼时与情侣组成第三方阵营；情侣杀死其他所有玩家则第三方阵营获胜',
  skillText: '首夜选择两名玩家成为情侣（可含自身）；情侣互认但不知对方身份',
  triggerText: '任一情侣出局则另一人殉情',
  winConditionText:
    '双好人时属好人阵营；双狼时属狼人阵营；一好一狼时与情侣组成第三方阵营；情侣杀死其他所有玩家则第三方阵营获胜',
  action: '连接情侣',
  prompt: '请选择两名玩家成为情侣，可以选择自己',
  confirmation: '连接{first}和{second}为情侣',
  revealTitle: '情侣信息',
  isLover: '你是情侣之一，你的另一半是：{seat}',
  notLover: '你不是情侣',
});

const chooseLoversStep: WerewolfRoleStepDefinition = {
  id: 'cupidChooseLovers',
  survivesConversion: true,
  title: COPY.action,
  audio: defineWerewolfStepAudio('cupid'),
  actors: (context) =>
    context.state.seatedSeats.filter((seat) =>
      context.role.activeRoleIdsOf(seat).includes('cupid'),
    ),
  actions: [
    {
      kind: 'pickSeats',
      key: 'cupidChooseLovers',
      name: COPY.action,
      count: { min: 2, max: 2 },
      prompt: COPY.prompt,
      seats: (context) =>
        context.state.seatedSeats.map((seat) => ({ seat, unavailableReason: null })),
      phrase: (seats) => {
        const [first, second] = seats;
        if (first === undefined || second === undefined) return COPY.action;
        return renderCopy(COPY.confirmation, {
          first: formatSeat(first),
          second: formatSeat(second),
        });
      },
      resolve: (context, chosenSeats) => {
        if (chosenSeats.length !== 2 || chosenSeats[0] === chosenSeats[1]) {
          throw new Error('[FAIL-FAST] Cupid must choose two distinct players');
        }
        const actorSeat = getActingSeat(context);
        const selections = chosenSeats.map((chosenSeat) => ({
          roleId: 'cupid',
          actorSeat,
          ...resolveTargetSelection(chosenSeat, { swap: null }),
        }));
        const firstSeat = selections[0]?.landingSeat;
        const secondSeat = selections[1]?.landingSeat;
        if (firstSeat === undefined || secondSeat === undefined) {
          throw new Error('[FAIL-FAST] Cupid target count changed after validation');
        }
        return {
          facts: {
            selections,
            identityChanges: [],
            cardSelections: [],
            disabledAbilities: [],
            deathEffects: [
              {
                kind: 'link',
                source: actorSeat,
                from: firstSeat,
                to: secondSeat,
                cause: 'coupleLink',
                isMutual: true,
              },
            ],
          },
        };
      },
    },
  ],
  skippable: () => false,
  lock: getRoleAbilityLockReason,
  reviewSubject: () => COPY.name,
};

const loversRevealStep = createGroupConfirmStep({
  id: 'cupidLoversReveal',
  roleName: COPY.name,
  title: COPY.revealTitle,
  content: (context) => {
    const pair = context.facts.selections.filter((selection) => selection.roleId === 'cupid');
    const partner = pair.find((selection) => selection.landingSeat === context.seat);
    if (partner === undefined) return COPY.notLover;
    const other = pair.find((selection) => selection.landingSeat !== context.seat);
    if (other === undefined) throw new Error('[FAIL-FAST] Cupid pair has only one member');
    return renderCopy(COPY.isLover, { seat: formatSeat(other.landingSeat) });
  },
});

export const cupid = defineRole({
  id: 'cupid',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: COPY.emoji,
    description: COPY.description,
    sections: {
      skill: COPY.skillText,
      trigger: COPY.triggerText,
      winCondition: COPY.winConditionText,
    },
    tags: ['link'],
  },
  traits: { faction: 'special', team: 'good', cannotBeBottomCard: true },
  presence: cupidPresence[0],
  steps: [chooseLoversStep, loversRevealStep],
});
