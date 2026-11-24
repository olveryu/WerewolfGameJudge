import { defineCopy } from '../../../platform/steps';
import type { PresenceDeclaration } from './presence';
import { defineRole } from './role';
import { createCardSelectionStep } from './roleSteps';

const COPY = defineCopy({
  name: '盗宝大师',
  shortName: '盗',
  emoji: '💎',
  description:
    '首夜查看三张底牌；每晚从神职牌和平民牌中选一张获得该角色完整技能；永久狼人阵营；不与狼队见面、不共享信息；被查验时以当夜选择的身份为准；其他狼人全部出局后选蒙面人，白天被投票放逐且负伤免死未触发过，可触发免死；触发免死后于当夜袭击两名不同玩家，袭击结束后立即出局；不能连续两晚选同一张；所有底牌技能仅当夜生效，未触发则失效；底牌固定为一张普通狼人牌、一张神职牌、一张平民牌（不含技能狼）；其他狼人全部出局后可主导袭击',
  action: '盗宝',
  prompt: '请选择一张底牌获得该角色的技能',
  resultTitle: '获得的技能',
});

export const treasureMasterPresence = [
  { role: 'treasureMaster', effect: { kind: 'useBottomCardSelection' } },
] as const satisfies readonly PresenceDeclaration<'treasureMaster'>[];

export const treasureMaster = defineRole({
  id: 'treasureMaster',
  card: COPY,
  traits: { faction: 'special', team: 'third' },
  presence: treasureMasterPresence[0],
  nightSchedule: 'everyNight',
  steps: [
    createCardSelectionStep({
      id: 'treasureMasterChoose',
      roleId: 'treasureMaster',
      roleName: COPY.name,
      actionName: COPY.action,
      prompt: COPY.prompt,
      resultTitle: COPY.resultTitle,
      identityChange: 'grantBorrowedAbility',
      cannotRepeatCard: true,
    }),
  ],
});
