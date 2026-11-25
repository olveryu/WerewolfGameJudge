import { defineCopy } from '../../../platform/steps';
import type { DealCard, PresenceDeclaration } from './presence';
import { defineRole } from './role';
import { createCardSelectionStep } from './roleSteps';

const COPY = defineCopy({
  name: '盗宝大师',
  shortName: '盗',
  emoji: '💎',
  description:
    '首夜查看三张底牌；每晚从神职牌和平民牌中选一张获得该角色完整技能；永久狼人阵营；不与狼队见面、不共享信息；被查验时以当夜选择的身份为准；其他狼人全部出局后选蒙面人，白天被投票放逐且负伤免死未触发过，可触发免死；触发免死后于当夜袭击两名不同玩家，袭击结束后立即出局；不能连续两晚选同一张；所有底牌技能仅当夜生效，未触发则失效；底牌固定为一张普通狼人牌、一张神职牌、一张平民牌（不含技能狼）；其他狼人全部出局后可主导袭击',
  skillText: '首夜查看三张底牌；每晚从神职牌和平民牌中选一张获得该角色完整技能',
  passiveText: '永久狼人阵营；不与狼队见面、不共享信息；被查验时以当夜选择的身份为准',
  triggerText:
    '其他狼人全部出局后选蒙面人，白天被投票放逐且负伤免死未触发过，可触发免死；触发免死后于当夜袭击两名不同玩家，袭击结束后立即出局',
  restrictionText: '不能连续两晚选同一张；所有底牌技能仅当夜生效，未触发则失效',
  specialText:
    '底牌固定为一张普通狼人牌、一张神职牌、一张平民牌（不含技能狼）；其他狼人全部出局后可主导袭击',
  action: '选择底牌',
  hint: '你的阵营：狼人阵营',
  resultTitle: '获得的技能',
  wolfCardUnavailable: '不可选择狼人阵营底牌',
  needsPlainWolf: '含宝藏猎人时必须有至少 1 名普通狼人（底牌需要）',
  needsGod: '含宝藏猎人时必须有至少 1 名神职（底牌需要）',
  needsVillager: '含宝藏猎人时必须有至少 1 名村民（底牌需要）',
});

function isPlainWolf(card: DealCard): boolean {
  return card.roleId === 'wolf';
}

function countFaction(cards: readonly DealCard[], faction: DealCard['faction']): number {
  return cards.filter((card) => card.faction === faction).length;
}

export const treasureMasterPresence = [
  {
    role: 'treasureMaster',
    effect: {
      kind: 'useBottomCardSelection',
      deck: {
        size: 3,
        // One plain wolf, one god and one villager.
        isLegal: (cards) =>
          countFaction(cards, 'wolf') === 1 &&
          countFaction(cards, 'god') === 1 &&
          countFaction(cards, 'villager') === 1 &&
          cards.some(isPlainWolf),
        boardRequirement: (otherCards) => {
          if (!otherCards.some(isPlainWolf)) return COPY.needsPlainWolf;
          if (countFaction(otherCards, 'god') === 0) return COPY.needsGod;
          if (countFaction(otherCards, 'villager') === 0) return COPY.needsVillager;
          return null;
        },
        // Plague mode leaves no wolf card to set aside.
        isRemovedInPlagueMode: true,
      },
    },
  },
] as const satisfies readonly PresenceDeclaration<'treasureMaster'>[];

export const treasureMaster = defineRole({
  id: 'treasureMaster',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: COPY.emoji,
    description: COPY.description,
    sections: {
      skill: COPY.skillText,
      passive: COPY.passiveText,
      trigger: COPY.triggerText,
      restriction: COPY.restrictionText,
      special: COPY.specialText,
    },
    tags: ['transform'],
  },
  traits: { faction: 'special', team: 'third' },
  presence: treasureMasterPresence[0],
  nightSchedule: 'everyNight',
  steps: [
    createCardSelectionStep({
      id: 'treasureMasterChoose',
      roleId: 'treasureMaster',
      roleName: COPY.name,
      actionName: COPY.action,
      hint: () => COPY.hint,
      resultTitle: COPY.resultTitle,
      identityChange: 'grantBorrowedAbility',
      cardUnavailableReason: (card) => (card.faction === 'wolf' ? COPY.wolfCardUnavailable : null),
    }),
  ],
});
