/**
 * The werewolf review document: the first night's report, the sheriff
 * election record when one was held, and the identity wall.
 *
 * Every fact comes from the engine's night review projection
 * (`getWerewolfNightReview` and its derivations); this module only turns
 * facts into the report's sentences and semantic tones. The action area
 * is one sentence per action in night order: the actor's seat and role in
 * the body tone, the verb in the actor's faction tone, a result role word
 * or a dead seat number in that role's / player's faction tone; words
 * with no faction to point at stay neutral. A potion family merges into
 * one sentence per owner; a family that did nothing dissolves into idle
 * sentences; the outcome (deaths / peaceful night) is the last sentence.
 */

import type {
  DeathReason,
  GameState,
  NightReviewActionEntry,
  NightReviewIdentityEntry,
  NightReviewSheriffSection,
  RoleId,
  WerewolfNightReview,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  deriveDeathNotes,
  deriveWolfVerdict,
  Faction,
  getNightReviewOutcome,
  getRoleDisplayName,
  isValidRoleId,
  nightReviewActorRoleId,
  ROLE_SPECS,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { formatPendingSeats } from '@/features/room/components/PendingSeatsRow';
import type {
  ReviewBlock,
  ReviewInline,
  ReviewRosterRow,
  ReviewStamp,
  ReviewTimelineStep,
  ReviewTone,
  RoomReviewDocument,
} from '@/features/room/review/types';
import { createSheriffElectionPresentationFromSection } from '@/games/werewolf/room/day/sheriffElectionPresentation';
import {
  DEATH_REASON_LABELS,
  formatCheckResultLabel,
} from '@/games/werewolf/room/NightReview.helpers';

const KICKER = '🌙 第一夜 · 夜报';
const FOOTER = '仅供裁判及观战者参考 · 本夜报由对局记录自动生成';
const TIMELINE_TITLE = '第一夜';
const SHERIFF_TITLE = '警长竞选';
const IDENTITIES_TITLE = '全员身份';
const PEACEFUL_HEADLINE = '昨夜平安夜';
const ROSTER_ALIVE = '存活';
const ROSTER_OUT = '已出局';
const DEATH_CAUSE_SUFFIX = '出局';

type TextInline = Extract<ReviewInline, { readonly kind: 'text' }>;

function plain(text: string): TextInline {
  return { kind: 'text', text, tone: 'neutral' };
}

function toned(text: string, tone: ReviewTone): TextInline {
  return { kind: 'text', text, tone };
}

function seatInline(seat: number, tone: ReviewTone): ReviewInline {
  return { kind: 'seat', seat, tone };
}

function tagInline(text: string, tone: ReviewTone): ReviewInline {
  return { kind: 'tag', text, tone };
}

/** The one faction-tone rule: a role's faction names its tone in running text. */
function factionTone(roleId: RoleId): ReviewTone {
  switch (ROLE_SPECS[roleId].faction) {
    case Faction.Wolf:
      return 'evil';
    case Faction.God:
      return 'special';
    case Faction.Villager:
      return 'good';
    case Faction.Special:
      return 'highlight';
  }
}

/** A seat medal's tone: the three main factions; third parties and unknowns stay neutral. */
function medalTone(roleId: RoleId | null): ReviewTone {
  if (roleId === null) return 'neutral';
  const tone = factionTone(roleId);
  return tone === 'highlight' ? 'neutral' : tone;
}

/**
 * A faction-check result word: only 狼人 points at a faction; 好人 spans
 * god, villager and third parties and has no single faction tone.
 */
function checkResultTone(resultLabel: string): ReviewTone {
  return resultLabel === '狼人' ? 'evil' : 'neutral';
}

function identityRoleText(entry: NightReviewIdentityEntry): string {
  if (entry.isEmptySeat) return '空座';
  return entry.roleId === null ? '未分配' : getRoleDisplayName(entry.roleId);
}

/** 狼杀出局 for a recorded reason, the bare 出局 for a death with none. */
function deathCause(reason: DeathReason | null): string {
  return reason === null
    ? DEATH_CAUSE_SUFFIX
    : `${DEATH_REASON_LABELS[reason]}${DEATH_CAUSE_SUFFIX}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Night timeline sentences
// ─────────────────────────────────────────────────────────────────────────────

interface Actor {
  readonly seat: number;
  readonly roleId: RoleId;
}

type IdentityIndex = ReadonlyMap<number, NightReviewIdentityEntry>;

function identityForSeat(seat: number, identities: IdentityIndex): NightReviewIdentityEntry {
  const identity = identities.get(seat);
  if (identity === undefined) {
    throw new Error(`[FAIL-FAST] Night review names seat ${seat} with no identity entry`);
  }
  return identity;
}

/** The seat holding a role: reflectDamage carries the checker's role but no seat; roles are unique. */
function seatForRole(roleId: RoleId, identities: IdentityIndex): number {
  for (const identity of identities.values()) {
    if (identity.roleId === roleId) return identity.seat;
  }
  throw new Error(`[FAIL-FAST] Night review names role ${roleId} with no seated identity`);
}

function actorOf(entry: NightReviewActionEntry): Actor {
  const roleId = nightReviewActorRoleId(entry);
  if (!('actorSeat' in entry) || roleId === null) {
    throw new Error(`[FAIL-FAST] Night review sentence cannot head entry kind ${entry.kind}`);
  }
  return { seat: entry.actorSeat, roleId };
}

/** The sentence head: "N号<角色名>", always neutral. */
function who(actor: Actor): TextInline {
  return plain(`${formatSeat(actor.seat)}${getRoleDisplayName(actor.roleId)}`);
}

/** "X号<角色><动词>Y号。": the verb in the actor's faction tone, the tail neutral. */
function directed(actor: Actor, verb: string, tail: string): readonly TextInline[] {
  return [who(actor), toned(verb, factionTone(actor.roleId)), plain(tail)];
}

function idlePhrase(entry: NightReviewActionEntry): string {
  switch (entry.kind) {
    case 'nightmareIdle':
      return '未封锁';
    case 'shelterIdle':
      return '未庇护';
    case 'hiddenWolfConfirmed':
      return '已确认狼同伴';
    case 'guardIdle':
      return '未守护';
    case 'silenceIdle':
      return '未禁言';
    case 'votebanIdle':
      return '未禁票';
    case 'curseIdle':
      return '未诅咒';
    case 'dreamIdle':
      return '未摄梦';
    case 'swapIdle':
      return '未交换';
    case 'charmIdle':
      return '未魅惑';
    case 'hypnotizeIdle':
      return '未催眠';
    case 'checkIdle':
      return '未查验';
    case 'learnIdle':
      return '未学习';
    case 'avengerConfirmed':
      return '已确认阵营';
    case 'infectIdle':
      return '未使用感染';
    case 'witchIdleAll':
      return '未使用药水';
    case 'witchNoSave':
      return '未使用解药';
    case 'witchNoPoison':
    case 'poisonerNoPoison':
      return '未使用毒药';
    default:
      throw new Error(`[FAIL-FAST] Night review idle sentence received kind ${entry.kind}`);
  }
}

/** Votes grouped by target: most votes first, ties by target seat ascending. */
function groupWolfVotes(
  votes: readonly { readonly voterSeat: number; readonly targetSeat: number }[],
): readonly { readonly targetSeat: number; readonly voterSeats: readonly number[] }[] {
  const byTarget = new Map<number, number[]>();
  for (const vote of votes) {
    const voters = byTarget.get(vote.targetSeat);
    if (voters === undefined) byTarget.set(vote.targetSeat, [vote.voterSeat]);
    else voters.push(vote.voterSeat);
  }
  return Array.from(byTarget, ([targetSeat, voterSeats]) => ({ targetSeat, voterSeats })).sort(
    (a, b) => b.voterSeats.length - a.voterSeats.length || a.targetSeat - b.targetSeat,
  );
}

/**
 * The wolf team's sentence. The verdict is the recorded one
 * (`deriveWolfVerdict`), never a tally of the displayed votes; a split
 * vote lists the vote pairs in target-group order, and a vote with no
 * resolved target tones nothing.
 */
function wolfSentence(
  entry: Extract<NightReviewActionEntry, { readonly kind: 'wolfAttack' }>,
): readonly TextInline[] {
  const verdict = deriveWolfVerdict(entry);
  switch (verdict.type) {
    case 'sharedTarget': {
      const voters = entry.votes.map((vote) => vote.voterSeat + 1).join('、');
      return [
        plain(`狼队（${voters}号）`),
        toned(`袭击${formatSeat(verdict.targetSeat)}`, 'evil'),
        plain('。'),
      ];
    }
    case 'splitKilled':
    case 'tiePicked':
    case 'splitTied':
    case 'tiePending': {
      const pairs = groupWolfVotes(entry.votes)
        .flatMap((group) =>
          group.voterSeats.map((seat) => `${formatSeat(seat)}投${formatSeat(group.targetSeat)}`),
        )
        .join('、');
      const verdictInline =
        verdict.type === 'splitKilled'
          ? toned(`按多数票击杀${formatSeat(verdict.targetSeat)}`, 'evil')
          : verdict.type === 'tiePicked'
            ? toned(`平票抽中${formatSeat(verdict.targetSeat)}`, 'evil')
            : plain(verdict.type === 'splitTied' ? '平票，未击杀' : '平票，目标未记录');
      return [plain(`狼队投票不一致（${pairs}），`), verdictInline, plain('。')];
    }
    case 'allAbstain':
      return [plain('狼队全员空刀。')];
  }
}

type PotionOwner = 'witch' | 'poisoner';

function potionOwnerOf(entry: NightReviewActionEntry): PotionOwner | null {
  switch (entry.kind) {
    case 'save':
    case 'witchIdleAll':
    case 'witchNoSave':
    case 'witchNoPoison':
      return 'witch';
    case 'poison':
      return entry.actorRoleId;
    case 'poisonerNoPoison':
      return 'poisoner';
    default:
      return null;
  }
}

/**
 * One potion owner's sentence: the owner once, then one clause per potion
 * — a used potion names its target in the owner's faction tone, an unused
 * potion reads as plain words. A family that acted never carries
 * 未使用药水 (the projection emits it only for a family that did nothing).
 */
function potionSentence(
  owner: PotionOwner,
  entries: readonly NightReviewActionEntry[],
): readonly TextInline[] {
  const [first] = entries;
  if (first === undefined || !('actorSeat' in first)) {
    throw new Error('[FAIL-FAST] Night review potion sentence has no headed entry');
  }
  const tone = factionTone(owner);
  const inlines: TextInline[] = [
    plain(`${formatSeat(first.actorSeat)}${getRoleDisplayName(owner)}`),
  ];
  for (const entry of entries) {
    switch (entry.kind) {
      case 'save':
        inlines.push(toned(`使用解药救起${formatSeat(entry.targetSeat)}`, tone), plain('。'));
        break;
      case 'poison':
        inlines.push(toned(`毒杀${formatSeat(entry.targetSeat)}`, tone), plain('。'));
        break;
      case 'witchNoSave':
        inlines.push(plain('解药未使用。'));
        break;
      case 'witchNoPoison':
      case 'poisonerNoPoison':
        inlines.push(plain('毒药未使用。'));
        break;
      default:
        throw new Error(
          `[FAIL-FAST] Night review potion sentence received ${entry.kind} from a family that acted`,
        );
    }
  }
  return inlines;
}

function deathsSentence(
  entry: Extract<NightReviewActionEntry, { readonly kind: 'deaths' }>,
  identities: IdentityIndex,
): readonly TextInline[] {
  const inlines: TextInline[] = [];
  entry.deaths.forEach((death, index) => {
    if (index > 0) inlines.push(plain(index === entry.deaths.length - 1 ? '和' : '、'));
    const { roleId } = identityForSeat(death.seat, identities);
    inlines.push(
      roleId === null
        ? plain(formatSeat(death.seat))
        : toned(formatSeat(death.seat), factionTone(roleId)),
    );
  });
  inlines.push(plain('出局。'));
  return inlines;
}

function checkSentence(
  entry: Extract<NightReviewActionEntry, { readonly kind: 'check' }>,
): readonly TextInline[] {
  const actor = actorOf(entry);
  const label = formatCheckResultLabel(entry.result, entry.resultFormat);
  let resultTone: ReviewTone;
  if (entry.resultFormat === 'factionCheck') {
    resultTone = checkResultTone(label);
  } else {
    if (!isValidRoleId(entry.result)) {
      throw new Error(`[FAIL-FAST] Reveal result ${entry.result} is not a role id`);
    }
    resultTone = factionTone(entry.result);
  }
  return [
    who(actor),
    toned('查验', factionTone(actor.roleId)),
    plain(`${formatSeat(entry.targetSeat)}，结果：`),
    toned(label, resultTone),
    plain('。'),
  ];
}

/**
 * One action as one sentence, exhaustive over the action kinds; a potion
 * entry only appears inside its owner's sentence, and anything unhandled
 * fails fast — a new kind with no sentence cannot slip into the report.
 */
function actionSentence(
  entry: NightReviewActionEntry,
  identities: IdentityIndex,
): readonly TextInline[] {
  // Read once so the exhaustive default can name it: there the entry narrows to never.
  const kind = entry.kind;
  switch (entry.kind) {
    case 'bottomCards':
      return [
        plain('底牌：'),
        ...entry.roleIds.flatMap((roleId, index) => [
          ...(index > 0 ? [plain('、')] : []),
          toned(getRoleDisplayName(roleId), factionTone(roleId)),
        ]),
        plain('。'),
      ];
    case 'cardChoice': {
      const actor = actorOf(entry);
      return [
        who(actor),
        toned('选择了', factionTone(actor.roleId)),
        toned(getRoleDisplayName(entry.chosenRoleId), factionTone(entry.chosenRoleId)),
        plain('。'),
      ];
    }
    case 'cupidLink':
      return directed(
        actorOf(entry),
        '连线',
        `${formatSeat(entry.seats[0])}和${formatSeat(entry.seats[1])}。`,
      );
    case 'wolfAttack':
      return wolfSentence(entry);
    case 'wolfNoTarget':
      return [plain('狼队未选择目标。')];
    case 'wolfGiveUp':
      return [
        plain(
          entry.reason === 'poisonerPresent'
            ? '狼队放弃袭击，毒师在场。'
            : `狼队放弃袭击，被${getRoleDisplayName('nightmare')}封锁。`,
        ),
      ];
    case 'nightmareBlock': {
      const actor = actorOf(entry);
      return [
        who(actor),
        toned('封锁', factionTone(actor.roleId)),
        plain(formatSeat(entry.targetSeat)),
        ...(entry.targetRoleId === null
          ? []
          : [plain(`（${getRoleDisplayName(entry.targetRoleId)}，技能无效）`)]),
        plain('。'),
      ];
    }
    case 'shelter':
      return directed(actorOf(entry), '庇护', `${formatSeat(entry.targetSeat)}。`);
    case 'guard':
      return directed(actorOf(entry), '守护', `${formatSeat(entry.targetSeat)}。`);
    case 'silence':
      return directed(actorOf(entry), '禁言', `${formatSeat(entry.targetSeat)}。`);
    case 'voteban':
      return directed(actorOf(entry), '禁票', `${formatSeat(entry.targetSeat)}。`);
    case 'curse':
      return directed(actorOf(entry), '诅咒', `${formatSeat(entry.targetSeat)}。`);
    case 'dream':
      return directed(actorOf(entry), '摄梦', `${formatSeat(entry.targetSeat)}。`);
    case 'swap':
      return directed(
        actorOf(entry),
        '交换',
        `${formatSeat(entry.seats[0])}和${formatSeat(entry.seats[1])}。`,
      );
    case 'idolChoice':
      return directed(actorOf(entry), '选择榜样', `${formatSeat(entry.targetSeat)}。`);
    case 'mimic':
      return directed(
        actorOf(entry),
        '模仿',
        `${formatSeat(entry.targetSeat)}${entry.isBound ? '（绑定）' : ''}。`,
      );
    case 'charm':
      return directed(actorOf(entry), '魅惑', `${formatSeat(entry.targetSeat)}。`);
    case 'convert':
      return directed(actorOf(entry), '转化', `${formatSeat(entry.targetSeat)}。`);
    case 'wolfGirlConfess':
      return directed(actorOf(entry), '表白', `${formatSeat(entry.targetSeat)}。`);
    case 'hypnotize':
      return directed(
        actorOf(entry),
        '催眠',
        `${entry.targetSeats.map((seat) => formatSeat(seat)).join('、')}。`,
      );
    case 'check':
      return checkSentence(entry);
    case 'learn': {
      const actor = actorOf(entry);
      return [
        who(actor),
        toned('学习', factionTone(actor.roleId)),
        plain(`${formatSeat(entry.targetSeat)}，学到身份：`),
        toned(getRoleDisplayName(entry.learnedRoleId), factionTone(entry.learnedRoleId)),
        plain('。'),
      ];
    }
    case 'shootStatus': {
      const actor = actorOf(entry);
      return [
        who(actor),
        entry.canShoot ? toned('可以发动', factionTone(actor.roleId)) : plain('不能发动'),
        plain('。'),
      ];
    }
    case 'infectConverted':
      return directed(actorOf(entry), '感染', `${formatSeat(entry.targetSeat)}，成功。`);
    case 'infectFailed':
      return directed(actorOf(entry), '感染', `${formatSeat(entry.targetSeat)}，失败。`);
    case 'guardSaveConflict':
      return [plain(`${formatSeat(entry.targetSeat)}同守同救，仍然死亡。`)];
    case 'poisonImmune':
      return [
        plain(formatSeat(entry.targetSeat)),
        toned(getRoleDisplayName(entry.targetRoleId), factionTone(entry.targetRoleId)),
        plain('免疫毒药。'),
      ];
    case 'reflectDamage':
      return directed(
        { seat: seatForRole(entry.checkerRoleId, identities), roleId: entry.checkerRoleId },
        '查验',
        `${formatSeat(entry.targetSeat)}，反伤。`,
      );
    case 'peacefulNight':
      return [plain('本夜无人出局。')];
    case 'deaths':
      return deathsSentence(entry, identities);
    case 'nightmareIdle':
    case 'shelterIdle':
    case 'guardIdle':
    case 'silenceIdle':
    case 'votebanIdle':
    case 'curseIdle':
    case 'dreamIdle':
    case 'swapIdle':
    case 'charmIdle':
    case 'hypnotizeIdle':
    case 'checkIdle':
    case 'learnIdle':
    case 'infectIdle':
    case 'witchIdleAll':
    case 'witchNoSave':
    case 'witchNoPoison':
    case 'poisonerNoPoison':
      return [who(actorOf(entry)), plain(idlePhrase(entry)), plain('。')];
    case 'hiddenWolfConfirmed':
    case 'avengerConfirmed': {
      const actor = actorOf(entry);
      return [who(actor), toned(idlePhrase(entry), factionTone(actor.roleId)), plain('。')];
    }
    case 'save':
    case 'poison':
      throw new Error(
        `[FAIL-FAST] Night review potion entry ${entry.kind} belongs inside its owner's sentence`,
      );
    default:
      throw new Error(`[FAIL-FAST] Night review sentence received unhandled kind ${kind}`);
  }
}

type NightLine =
  | { readonly kind: 'sentence'; readonly inlines: readonly TextInline[] }
  | { readonly kind: 'potion'; readonly owner: PotionOwner };

/**
 * The night's sentences in night order (the engine's summary order). A
 * potion family that used a potion merges into one sentence per owner at
 * its first entry; a family that used nothing dissolves into its idle
 * sentences. The outcome entry stays last, where the projection emits it.
 */
function nightSentences(
  review: WerewolfNightReview,
  identities: IdentityIndex,
): readonly (readonly TextInline[])[] {
  const familyActed = new Map<PotionOwner, boolean>();
  for (const entry of review.actions) {
    const owner = potionOwnerOf(entry);
    if (owner === null) continue;
    const isPotionUse = entry.kind === 'save' || entry.kind === 'poison';
    familyActed.set(owner, familyActed.get(owner) === true || isPotionUse);
  }
  const lines: NightLine[] = [];
  const families = new Map<PotionOwner, NightReviewActionEntry[]>();
  for (const entry of review.actions) {
    const owner = potionOwnerOf(entry);
    if (owner !== null && familyActed.get(owner) === true) {
      const family = families.get(owner);
      if (family === undefined) {
        families.set(owner, [entry]);
        lines.push({ kind: 'potion', owner });
      } else {
        family.push(entry);
      }
      continue;
    }
    lines.push({ kind: 'sentence', inlines: actionSentence(entry, identities) });
  }
  return lines.map((line) => {
    if (line.kind === 'sentence') return line.inlines;
    const family = families.get(line.owner);
    if (family === undefined) {
      throw new Error(`[FAIL-FAST] Night review lost the ${line.owner} potion family`);
    }
    return potionSentence(line.owner, family);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheriff election record
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The public election record as timeline steps. Registration is
 * status-only (no seats, no counts, for anyone); an open vote shows
 * submission counts only, never a ballot.
 *
 * This is a mechanical translator over the presentation projection: it
 * branches only on the projection row kind and its semantic flags, never
 * on an election phase, result, or seat set. Which rows exist, in which
 * order, and who is marked winner is decided once in the projection;
 * this function only turns a row into the timeline's vocabulary (seat
 * medals, the [当选] tag, tones).
 */
function sheriffSteps(section: NightReviewSheriffSection): readonly ReviewTimelineStep[] {
  return createSheriffElectionPresentationFromSection(section).rows.flatMap(
    (row): readonly ReviewTimelineStep[] => {
      switch (row.kind) {
        case 'phase':
          return [{ title: row.title, tone: 'neutral', lines: [[plain(row.description)]] }];
        case 'result': {
          if (row.resultKind === 'elected') {
            if (row.sheriffSeat === null || row.bannerSubtitle === null) {
              throw new Error(
                '[FAIL-FAST] Sheriff election presentation has an elected result without a sheriff or an elected line',
              );
            }
            return [
              {
                title: row.timelineTitle,
                tone: 'highlight',
                lines: [[seatInline(row.sheriffSeat, 'highlight'), plain(row.bannerSubtitle)]],
              },
            ];
          }
          if (row.noSheriffText === null) {
            throw new Error(
              '[FAIL-FAST] Sheriff election presentation has a no-sheriff result without a reason',
            );
          }
          return [{ title: row.timelineTitle, tone: 'muted', lines: [[plain(row.noSheriffText)]] }];
        }
        case 'registration': {
          const lines: (readonly ReviewInline[])[] = [
            row.seats.length === 0
              ? [plain('无')]
              : row.seats.map(({ seat, isWithdrawn }) =>
                  seatInline(seat, isWithdrawn ? 'muted' : 'neutral'),
                ),
          ];
          if (row.withdrawnNote !== null) lines.push([plain(row.withdrawnNote)]);
          return [{ title: '上警', tone: 'neutral', lines }];
        }
        case 'candidates':
          return [
            {
              title: row.label,
              tone: 'neutral',
              lines: [row.seats.map((seat) => seatInline(seat, 'neutral'))],
            },
          ];
        case 'speaking':
          return [{ title: '发言顺序', tone: 'neutral', lines: [[plain(row.text)]] }];
        case 'voteProgress': {
          const lines: (readonly ReviewInline[])[] = [[plain(row.text)]];
          if (row.pendingSeats.length > 0) {
            lines.push([plain(formatPendingSeats('未投票', row.pendingSeats))]);
          }
          return [{ title: '投票进度', tone: 'neutral', lines }];
        }
        case 'round': {
          const lines: (readonly ReviewInline[])[] = row.candidates.map((candidate) => [
            seatInline(candidate.seat, candidate.isWinner ? 'highlight' : 'neutral'),
            plain(`${candidate.votes} 票${candidate.voterSeats.length > 0 ? '：' : ''}`),
            ...candidate.voterSeats.map((seat) => seatInline(seat, 'neutral')),
            ...(candidate.isWinner ? [tagInline('当选', 'highlight')] : []),
          ]);
          if (row.abstainingSeats.length > 0) {
            lines.push([
              plain('弃票：'),
              ...row.abstainingSeats.map((seat) => seatInline(seat, 'muted')),
            ]);
          }
          if (row.isEmpty) lines.push([plain('无投票人')]);
          return [{ title: row.title, tone: 'neutral', lines }];
        }
      }
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────

function heroBlock(review: WerewolfNightReview, identities: IdentityIndex): ReviewBlock {
  const outcome = getNightReviewOutcome(review);
  if (outcome.type === 'peaceful') {
    return {
      kind: 'hero',
      headline: [{ kind: 'text', text: PEACEFUL_HEADLINE }],
      tone: 'neutral',
      stamps: [],
      byline: null,
    };
  }
  const deathNotes = deriveDeathNotes(review);
  const stamps: ReviewStamp[] = outcome.deaths.map((death) => {
    const note = deathNotes.get(death.seat);
    return {
      seat: death.seat,
      tone: 'out',
      title: identityRoleText(identityForSeat(death.seat, identities)),
      caption: deathCause(death.reason),
      note:
        note === undefined
          ? null
          : note.kind === 'wolfVotes'
            ? `狼队 ${note.votes} 票锁定`
            : `${getRoleDisplayName(note.actorRoleId)}下毒`,
    };
  });
  return {
    kind: 'hero',
    headline: [
      { kind: 'text', text: '昨夜 ' },
      { kind: 'figure', text: String(outcome.deaths.length), tone: 'out' },
      { kind: 'text', text: ' 人出局' },
    ],
    tone: 'neutral',
    stamps,
    byline: null,
  };
}

function rosterRows(review: WerewolfNightReview): readonly ReviewRosterRow[] {
  const outcome = getNightReviewOutcome(review);
  const reasonBySeat = new Map<number, DeathReason | null>(
    outcome.type === 'deaths' ? outcome.deaths.map((death) => [death.seat, death.reason]) : [],
  );
  return review.identities.map((entry) => {
    const isOut = !entry.isAlive;
    // A seat out with no recorded reason reads 已出局, never a bare 出局.
    const reason = reasonBySeat.get(entry.seat) ?? null;
    return {
      seat: entry.seat,
      seatTone: isOut ? 'out' : medalTone(entry.roleId),
      name: null,
      role: identityRoleText(entry),
      status: !isOut ? ROSTER_ALIVE : reason === null ? ROSTER_OUT : deathCause(reason),
      statusTone: isOut ? 'out' : 'muted',
      isOut,
    };
  });
}

export function toWerewolfReviewDocument(input: {
  readonly review: WerewolfNightReview;
  readonly roomCode: string;
  readonly gameSequence: GameState['gameSequence'];
}): RoomReviewDocument {
  const { review, roomCode, gameSequence } = input;
  const identities: IdentityIndex = new Map(review.identities.map((entry) => [entry.seat, entry]));
  const blocks: ReviewBlock[] = [
    heroBlock(review, identities),
    { kind: 'section', title: TIMELINE_TITLE },
    {
      kind: 'timeline',
      steps: nightSentences(review, identities).map((sentence) => ({
        title: null,
        tone: 'neutral',
        lines: [sentence],
      })),
    },
  ];
  if (review.sheriff !== undefined) {
    blocks.push(
      { kind: 'section', title: SHERIFF_TITLE },
      { kind: 'timeline', steps: sheriffSteps(review.sheriff) },
    );
  }
  blocks.push(
    { kind: 'divider' },
    { kind: 'section', title: IDENTITIES_TITLE },
    { kind: 'roster', columns: 2, rows: rosterRows(review) },
  );
  return {
    roundKey: `game-${gameSequence}`,
    kicker: KICKER,
    fileStem: `werewolf-${roomCode}-${gameSequence + 1}`,
    footer: FOOTER,
    isAborted: false,
    pages: [{ key: 'night-1', label: null, blocks }],
  };
}
