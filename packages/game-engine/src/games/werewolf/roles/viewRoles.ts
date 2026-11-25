import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy } from '../../../platform/steps';
import { defineWerewolfStepAudio } from './audio';
import type { WerewolfRoleStepContext, WerewolfRoleStepDefinition } from './role';
import { defineRole } from './role';
import { getRoleAbilityLockReason } from './roleSteps';

const COPY = defineCopy({
  hunterName: '猎人',
  hunterShortName: '猎',
  hunterEmoji: '🏹',
  hunterDescription: '出局时可开枪带走一名玩家；仅被狼人袭击或投票放逐出局时可发动',
  hunterStepTitle: '技能发动确认',
  hunterViewTitle: '技能状态',
  canShoot: '可以发动技能',
  cannotShoot: '不能发动技能',
  reviewCanShoot: '可以发动',
  reviewCannotShoot: '不能发动',
  darkWolfKingName: '狼王',
  darkWolfKingShortName: '王',
  darkWolfKingEmoji: '🖤🐺',
  darkWolfKingDescription: '出局时可开枪带走一名玩家；仅被狼人袭击或投票放逐出局时可发动',
  darkWolfKingStepTitle: '技能发动确认',
  darkWolfKingViewTitle: '技能状态',
  hiddenWolfName: '隐狼',
  hiddenWolfShortName: '隐',
  hiddenWolfEmoji: '👤🐺',
  hiddenWolfDescription:
    '首夜可获知狼同伴身份；与其他狼人互不相认；预言家查验为好人；不能自爆；其他狼人全部出局后可主导袭击',
  hiddenWolfStepTitle: '狼同伴确认',
  hiddenWolfViewTitle: '狼同伴',
  hiddenWolfTeammates: '你的狼同伴为：{seats}',
  hiddenWolfNoTeammates: '无',
  hiddenWolfConfirmed: '已确认狼同伴',
  avengerName: '复仇者',
  avengerShortName: '仇',
  avengerEmoji: '⚔️',
  avengerDescription:
    '首夜获知自身阵营；永远与影子模仿目标阵营对立；预言家查验为好人；非绑定时出局可刺杀一名玩家；刺杀不受毒杀影响；刺杀命中敌方有效、己方无效；刺杀命中未变身影子则单独胜利；若影子模仿复仇者则二人绑定；绑定后二人失去原技能，成为同生共死第三方；绑定后从第二夜起，每晚影子轮次二人睁眼，可袭击一名玩家；绑定后的袭击无视一切保护效果；帮好人时算神职；帮狼时与其他狼人互不相认；帮狼时其他狼人全部出局后可主导袭击；非绑定时随自身阵营胜利；绑定时胜利条件为屠城',
  avengerStepTitle: '阵营确认',
  avengerViewTitle: '阵营',
  avengerGood: '你属于好人阵营',
  avengerWolf: '你属于狼人阵营',
  avengerBonded: '你与影子绑定，同属第三方阵营',
  avengerConfirmed: '已确认阵营',
});

function createRoleCard(name: string, shortName: string, emoji: string, description: string) {
  return { name, shortName, emoji, description };
}

const CARDS = {
  hunter: createRoleCard(
    COPY.hunterName,
    COPY.hunterShortName,
    COPY.hunterEmoji,
    COPY.hunterDescription,
  ),
  darkWolfKing: createRoleCard(
    COPY.darkWolfKingName,
    COPY.darkWolfKingShortName,
    COPY.darkWolfKingEmoji,
    COPY.darkWolfKingDescription,
  ),
  hiddenWolf: createRoleCard(
    COPY.hiddenWolfName,
    COPY.hiddenWolfShortName,
    COPY.hiddenWolfEmoji,
    COPY.hiddenWolfDescription,
  ),
  avenger: createRoleCard(
    COPY.avengerName,
    COPY.avengerShortName,
    COPY.avengerEmoji,
    COPY.avengerDescription,
  ),
};
interface ViewStepOptions {
  readonly id: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly stepTitle: string;
  readonly viewTitle: string;
  readonly content: (context: WerewolfRoleStepContext) => string;
  readonly reviewPhrase: (context: WerewolfRoleStepContext) => string;
}

function createViewStep(options: ViewStepOptions): WerewolfRoleStepDefinition {
  return {
    id: options.id,
    title: options.stepTitle,
    audio: defineWerewolfStepAudio(options.roleId),
    actors: (context) =>
      context.state.seatedSeats.filter((seat) =>
        context.role.activeRoleIdsOf(seat).includes(options.roleId),
      ),
    actions: [
      {
        kind: 'view',
        key: options.id,
        name: options.viewTitle,
        title: options.viewTitle,
        content: options.content,
        reviewPhrase: options.reviewPhrase,
      },
    ],
    skippable: () => false,
    lock: getRoleAbilityLockReason,
    reviewSubject: () => options.roleName,
  };
}

export const hunter = defineRole({
  id: 'hunter',
  card: CARDS.hunter,
  traits: { faction: 'god', team: 'good' },
  nightSchedule: 'everyNight',
  steps: [
    createViewStep({
      id: 'hunterConfirm',
      roleId: 'hunter',
      roleName: COPY.hunterName,
      stepTitle: COPY.hunterStepTitle,
      viewTitle: COPY.hunterViewTitle,
      content: (context) =>
        context.canShootAtNight(getActingSeat(context), 'hunter')
          ? COPY.canShoot
          : COPY.cannotShoot,
      reviewPhrase: (context) =>
        context.canShootAtNight(getActingSeat(context), 'hunter')
          ? COPY.reviewCanShoot
          : COPY.reviewCannotShoot,
    }),
  ],
});

export const darkWolfKing = defineRole({
  id: 'darkWolfKing',
  card: CARDS.darkWolfKing,
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
  nightSchedule: 'everyNight',
  steps: [
    createViewStep({
      id: 'darkWolfKingConfirm',
      roleId: 'darkWolfKing',
      roleName: COPY.darkWolfKingName,
      stepTitle: COPY.darkWolfKingStepTitle,
      viewTitle: COPY.darkWolfKingViewTitle,
      content: (context) =>
        context.canShootAtNight(getActingSeat(context), 'darkWolfKing')
          ? COPY.canShoot
          : COPY.cannotShoot,
      reviewPhrase: (context) =>
        context.canShootAtNight(getActingSeat(context), 'darkWolfKing')
          ? COPY.reviewCanShoot
          : COPY.reviewCannotShoot,
    }),
  ],
});

export const hiddenWolf = defineRole({
  id: 'hiddenWolf',
  card: CARDS.hiddenWolf,
  traits: { faction: 'wolf', team: 'good' },
  nightSchedule: 'firstNight',
  steps: [
    createViewStep({
      id: 'hiddenWolfReveal',
      roleId: 'hiddenWolf',
      roleName: COPY.hiddenWolfName,
      stepTitle: COPY.hiddenWolfStepTitle,
      viewTitle: COPY.hiddenWolfViewTitle,
      reviewPhrase: () => COPY.hiddenWolfConfirmed,
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
        return COPY.hiddenWolfTeammates.replace(
          '{seats}',
          teammates.length === 0 ? COPY.hiddenWolfNoTeammates : teammates.join('、'),
        );
      },
    }),
  ],
});

export const avenger = defineRole({
  id: 'avenger',
  card: CARDS.avenger,
  traits: { faction: 'special', team: 'third' },
  nightSchedule: 'firstNight',
  steps: [
    createViewStep({
      id: 'avengerConfirm',
      roleId: 'avenger',
      roleName: COPY.avengerName,
      stepTitle: COPY.avengerStepTitle,
      viewTitle: COPY.avengerViewTitle,
      reviewPhrase: () => COPY.avengerConfirmed,
      content: (context) => {
        switch (context.avengerFactionOf(getActingSeat(context))) {
          case 'good':
            return COPY.avengerGood;
          case 'wolf':
            return COPY.avengerWolf;
          case 'bonded':
            return COPY.avengerBonded;
        }
      },
    }),
  ],
});

function getActingSeat(context: WerewolfRoleStepContext): number {
  if (context.seat === null) {
    throw new Error('[FAIL-FAST] A view action resolved without an acting seat');
  }
  return context.seat;
}
