import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createViewStep, getActingSeat } from './viewStep';

const COPY = defineCopy({
  name: '隐狼',
  shortName: '隐',
  description:
    '首夜可获知狼同伴身份；与其他狼人互不相认；预言家查验为好人；不能自爆；其他狼人全部出局后可主导袭击',
  skillText: '首夜可获知狼同伴身份',
  passiveText: '与其他狼人互不相认；预言家查验为好人',
  restrictionText: '不能自爆',
  specialText: '其他狼人全部出局后可主导袭击',
  stepTitle: '狼同伴确认',
  viewTitle: '狼同伴',
  teammates: '你的狼同伴为：{seats}',
  noTeammates: '无',
  confirmed: '已确认狼同伴',
  seatSeparator: '、',
});

export const hiddenWolf = defineRole({
  id: 'hiddenWolf',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '👤🐺',
    description: COPY.description,
    sections: {
      skill: COPY.skillText,
      passive: COPY.passiveText,
      restriction: COPY.restrictionText,
      special: COPY.specialText,
    },
    tags: ['confirm'],
  },
  traits: { faction: 'wolf', team: 'good' },
  steps: [
    createViewStep({
      id: 'hiddenWolfReveal',
      roleId: 'hiddenWolf',
      roleName: COPY.name,
      stepTitle: COPY.stepTitle,
      viewTitle: COPY.viewTitle,
      reviewPhrase: () => COPY.confirmed,
      content: (context) => {
        const seat = getActingSeat(context);
        const teammates = context.state.seatedSeats
          .filter(
            (otherSeat) =>
              otherSeat !== seat &&
              context.role
                .activeRoleIdsOf(otherSeat)
                .some((roleId) => context.teamOfRole(roleId) === 'wolf'),
          )
          .map(formatSeat);
        return renderCopy(COPY.teammates, {
          seats: teammates.length === 0 ? COPY.noTeammates : teammates.join(COPY.seatSeparator),
        });
      },
    }),
  ],
});
