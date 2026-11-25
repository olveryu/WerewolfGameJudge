import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import type { DeathResolution } from './deathEffects';
import type {
  WerewolfPersonalDaytimeViewDeclaration,
  WerewolfRoleCard,
  WerewolfRoleDefinition,
  WerewolfRoleStepContext,
} from './role';
import { defineRole } from './role';

const COPY = defineCopy({
  villagerName: '平民',
  villagerShortName: '民',
  villagerEmoji: '👤',
  villagerDescription: '没有特殊技能，依靠推理和投票帮助好人阵营获胜',
  idiotName: '愚者',
  idiotShortName: '愚',
  idiotEmoji: '🤡',
  idiotDescription: '被投票放逐时可翻牌免死；翻牌后失去投票权和技能使用权',
  knightName: '骑士',
  knightShortName: '骑',
  knightEmoji: '🗡️',
  knightDescription: '白天可翻牌与一名玩家决斗；对方是狼人则对方出局；对方是好人则自身出局',
  witcherName: '猎魔人',
  witcherShortName: '魔',
  witcherEmoji: '🔪',
  witcherDescription:
    '从第二夜起，每晚可选择一名玩家狩猎；对方是狼人则对方次日出局；对方是好人则自身次日出局；免疫女巫毒药',
  graveyardKeeperName: '守墓人',
  graveyardKeeperShortName: '墓',
  graveyardKeeperEmoji: '⚰️',
  graveyardKeeperDescription: '每晚可得知上一个白天被放逐玩家的阵营（好人/狼人）',
  dancerName: '舞者',
  dancerShortName: '舞',
  dancerEmoji: '💃',
  dancerDescription:
    '从第二夜起，每晚必须选择三名玩家共舞（可含自身）；若三人分属不同阵营则人数少的一方出局；仅当自身参舞时，舞池中三人当夜免疫狼人袭击；免疫女巫毒药',
  sequencePrinceName: '定序王子',
  sequencePrinceShortName: '序',
  sequencePrinceEmoji: '⏮️',
  sequencePrinceDescription:
    '每个白天第一次放逐投票结束后可选择翻牌发动技能；若翻牌则逆转时空回到本次投票前重新投票；重新投票前可额外发言一次；每局限用一次',
  wolfKingName: '白狼王',
  wolfKingShortName: '白',
  wolfKingEmoji: '👑🐺',
  wolfKingDescription: '白天可自爆并带走一名玩家；非自爆出局时不能发动技能',
  bloodMoonName: '血月使徒',
  bloodMoonShortName: '血',
  bloodMoonEmoji: '🩸',
  bloodMoonDescription:
    '自爆后的当晚所有好人阵营的技能被封印；若为最后一个被放逐的狼人，可存活至下一个白天天亮后才出局',
  spiritKnightName: '恶灵骑士',
  spiritKnightShortName: '灵',
  spiritKnightEmoji: '⚔️',
  spiritKnightDescription:
    '永久免疫夜间伤害；被非狼人阵营角色查验或女巫毒杀时反伤，次日对方出局；不能自爆',
  masqueradeName: '假面',
  masqueradeShortName: '假',
  masqueradeEmoji: '🎭🐺',
  masqueradeDescription:
    '从第二夜起可查看一名玩家是否在舞池中，并可赐予一名玩家面具；被赐予面具的玩家共舞结算时阵营反转；与其他狼人互不相认；免疫女巫毒药；其他狼人全部出局后可主导袭击',
  wardenName: '典狱长',
  wardenShortName: '狱',
  wardenEmoji: '⛓️',
  wardenDescription:
    '从第二夜起，每晚选择两名玩家进行交易，随后与狼人共同袭击；双方得知对象但不知身份，各自选「交易」或「背叛」；每人限交易一次；双方同选「交易」则免夜间伤害；双方同选「背叛」则互为当夜技能目标；一人选「交易」、另一人选「背叛」则选「交易」的玩家出局；选自身交易时，对方与自身同选则自身出局，不同则对方出局',
  cursedFoxName: '咒狐',
  cursedFoxShortName: '狐',
  cursedFoxEmoji: '🦊',
  cursedFoxDescription:
    '独立第三方阵营；免疫狼人袭击；被预言家查验时直接出局，查验结果仍为好人；任一阵营达成胜利条件时若咒狐存活，则咒狐窃取胜利成为唯一赢家',
  maskedManName: '蒙面人',
  maskedManShortName: '蒙',
  maskedManEmoji: '🥷',
  maskedManDescription:
    '首次在夜晚因狼人袭击、毒杀或摄梦连带受到致命伤害时负伤免死，转为负伤状态而非出局；进入负伤状态后，于下一次白天自己发言结束后强制出局',
  maskedManViewLabel: '查看负伤状态',
  maskedManViewPrompt: '请在自己发言结束后再查看',
  maskedManViewTitle: '负伤状态',
  maskedManWounded: '你已负伤，请宣布出局',
  maskedManNotWounded: '你没有负伤',
  maskedManWoundedReview: '{seat}蒙面人负伤，次日发言后出局',
});

type PassiveRoleTraits = WerewolfRoleDefinition['traits'];
type PassiveDeathEffect = NonNullable<WerewolfRoleDefinition['passiveDeathEffects']>;

/** The masked man is only wounded by these; any other cause of death takes him at dawn. */
const MASKED_MAN_WOUND_CAUSES = ['wolfKill', 'poison', 'dreamcatcherLink'] as const;

function isWounded(seat: number, resolution: DeathResolution): boolean {
  return resolution.trace.some((entry) => entry.kind === 'wound' && entry.target === seat);
}

function createRoleCard(
  name: string,
  shortName: string,
  emoji: string,
  description: string,
): WerewolfRoleCard {
  return { name, shortName, emoji, description };
}

function createPassiveRole<const TId extends string>(
  id: TId,
  card: WerewolfRoleCard,
  traits: PassiveRoleTraits,
  passiveDeathEffects?: PassiveDeathEffect,
  personalDaytimeView?: WerewolfPersonalDaytimeViewDeclaration,
): WerewolfRoleDefinition<TId> {
  const definition = {
    id,
    card,
    traits,
    steps: [],
    ...(passiveDeathEffects === undefined ? {} : { passiveDeathEffects }),
    ...(personalDaytimeView === undefined ? {} : { personalDaytimeView }),
  } satisfies WerewolfRoleDefinition<TId>;
  return defineRole(definition);
}

export const villager = createPassiveRole(
  'villager',
  createRoleCard(
    COPY.villagerName,
    COPY.villagerShortName,
    COPY.villagerEmoji,
    COPY.villagerDescription,
  ),
  {
    faction: 'villager',
    team: 'good',
  },
);

export const idiot = createPassiveRole(
  'idiot',
  createRoleCard(COPY.idiotName, COPY.idiotShortName, COPY.idiotEmoji, COPY.idiotDescription),
  { faction: 'god', team: 'good' },
);
export const knight = createPassiveRole(
  'knight',
  createRoleCard(COPY.knightName, COPY.knightShortName, COPY.knightEmoji, COPY.knightDescription),
  { faction: 'god', team: 'good' },
);
export const witcher = createPassiveRole(
  'witcher',
  createRoleCard(
    COPY.witcherName,
    COPY.witcherShortName,
    COPY.witcherEmoji,
    COPY.witcherDescription,
  ),
  {
    faction: 'god',
    team: 'good',
    immunities: ['poison'],
  },
);
export const graveyardKeeper = createPassiveRole(
  'graveyardKeeper',
  createRoleCard(
    COPY.graveyardKeeperName,
    COPY.graveyardKeeperShortName,
    COPY.graveyardKeeperEmoji,
    COPY.graveyardKeeperDescription,
  ),
  {
    faction: 'god',
    team: 'good',
  },
);
export const dancer = createPassiveRole(
  'dancer',
  createRoleCard(COPY.dancerName, COPY.dancerShortName, COPY.dancerEmoji, COPY.dancerDescription),
  {
    faction: 'god',
    team: 'good',
    immunities: ['poison'],
  },
);
export const sequencePrince = createPassiveRole(
  'sequencePrince',
  createRoleCard(
    COPY.sequencePrinceName,
    COPY.sequencePrinceShortName,
    COPY.sequencePrinceEmoji,
    COPY.sequencePrinceDescription,
  ),
  {
    faction: 'god',
    team: 'good',
  },
);
export const wolfKing = createPassiveRole(
  'wolfKing',
  createRoleCard(
    COPY.wolfKingName,
    COPY.wolfKingShortName,
    COPY.wolfKingEmoji,
    COPY.wolfKingDescription,
  ),
  {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
);
export const bloodMoon = createPassiveRole(
  'bloodMoon',
  createRoleCard(
    COPY.bloodMoonName,
    COPY.bloodMoonShortName,
    COPY.bloodMoonEmoji,
    COPY.bloodMoonDescription,
  ),
  {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
);
export const spiritKnight = createPassiveRole(
  'spiritKnight',
  createRoleCard(
    COPY.spiritKnightName,
    COPY.spiritKnightShortName,
    COPY.spiritKnightEmoji,
    COPY.spiritKnightDescription,
  ),
  {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    wolfKillTargetForbidden: true,
    checkReaction: 'reflect',
    immunities: ['wolfKill', 'poison', 'checkDeath'],
  },
  (_context: WerewolfRoleStepContext, seat) => [
    { kind: 'reflect', seat, against: ['poison', 'checkDeath'] },
  ],
);
export const masquerade = createPassiveRole(
  'masquerade',
  createRoleCard(
    COPY.masqueradeName,
    COPY.masqueradeShortName,
    COPY.masqueradeEmoji,
    COPY.masqueradeDescription,
  ),
  {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: false, participatesInWolfVote: false, actsSolo: true },
    immunities: ['poison'],
  },
);
export const warden = createPassiveRole(
  'warden',
  createRoleCard(COPY.wardenName, COPY.wardenShortName, COPY.wardenEmoji, COPY.wardenDescription),
  {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
);
export const cursedFox = createPassiveRole(
  'cursedFox',
  createRoleCard(
    COPY.cursedFoxName,
    COPY.cursedFoxShortName,
    COPY.cursedFoxEmoji,
    COPY.cursedFoxDescription,
  ),
  {
    faction: 'special',
    team: 'third',
    checkReaction: 'targetDeath',
    immunities: ['wolfKill'],
  },
);
export const maskedMan = createPassiveRole(
  'maskedMan',
  createRoleCard(
    COPY.maskedManName,
    COPY.maskedManShortName,
    COPY.maskedManEmoji,
    COPY.maskedManDescription,
  ),
  {
    faction: 'god',
    team: 'good',
  },
  (_context, seat) => [{ kind: 'wound', seat, against: MASKED_MAN_WOUND_CAUSES }],
  {
    label: COPY.maskedManViewLabel,
    prompt: COPY.maskedManViewPrompt,
    title: COPY.maskedManViewTitle,
    content: (seat, resolution) =>
      isWounded(seat, resolution) ? COPY.maskedManWounded : COPY.maskedManNotWounded,
    reviewLine: (seat, resolution) =>
      isWounded(seat, resolution)
        ? renderCopy(COPY.maskedManWoundedReview, { seat: formatSeat(seat) })
        : null,
  },
);
