/**
 * NightReviewReportBody - The one presentation body for the night review report.
 *
 * 2026 "verdict ticket" presentation (identical on every surface): a white
 * page — conclusion header (accent bar, masthead, headline with the death
 * count as the display numeral, one stamp per death) → timeline ("第一夜":
 * one sentence per action in night order, behind a rail of dots) → sheriff
 * election group (when an election exists) → perforation → identity roster
 * (two columns) → footer.
 *
 * The action area is a text timeline, in night order (the engine's summary
 * order; no faction grouping). Each row is one sentence: the actor's seat
 * and role in the body text color, the verb in the actor's faction color,
 * and a result role word / dead seat number in that role's / player's
 * faction color; words with no faction to point at (success/failure,
 * 不能发动, 好人, 本夜无人出局, warning predicates, 未…) stay in the body
 * text color. The night-report tone slots are gone: color comes only from
 * the theme faction colors via FACTION_COLOR_MAP. A potion family merges
 * into one row per owner; a family that did nothing at all dissolves into
 * idle rows; the outcome entry (deaths / peacefulNight) is the last row.
 * No service imports, no business logic: every fact comes from the engine
 * derivations, all shared copy/geometry from nightReviewLayout, flat colors
 * only (no gradients — the segmented screenshot capture composites bands).
 */
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import {
  Faction,
  getRoleDisplayName,
  isValidRoleId,
  ROLE_SPECS,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  deriveDeathNotes,
  deriveWolfVerdict,
  getNightReviewOutcome,
  type NightReviewActionEntry,
  nightReviewActorRoleId,
  type NightReviewDeathNote,
  type NightReviewIdentityEntry,
  type WerewolfNightReview,
} from '@game-judge/game-engine/games/werewolf/public';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FACTION_COLOR_MAP } from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import { borderRadius, colors, fixed, spacing, typography } from '@/theme';

import { DEATH_REASON_LABELS, formatCheckResultLabel } from '../NightReview.helpers';
import {
  NIGHT_REPORT_DEATH_CAUSE_SUFFIX,
  NIGHT_REPORT_FOOTER_TEXT,
  NIGHT_REPORT_HEADLINE_PREFIX,
  NIGHT_REPORT_HEADLINE_SUFFIX,
  NIGHT_REPORT_KICKER,
  NIGHT_REPORT_MEDAL_SIZES,
  NIGHT_REPORT_PALETTE,
  NIGHT_REPORT_ROSTER_ALIVE,
  NIGHT_REPORT_ROSTER_OUT,
  NIGHT_REPORT_SHERIFF_TITLE,
  NIGHT_REPORT_TIMELINE_TITLE,
  NIGHT_REVIEW_IDENTITIES_TITLE,
  NIGHT_REVIEW_PEACEFUL_HEADLINE,
} from '../nightReviewLayout';
import { SheriffElectionReportSection } from './SheriffElectionReportSection';

const P = NIGHT_REPORT_PALETTE;

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

type MedalTone = 'neutral' | 'wolf' | 'god' | 'good' | 'dead';

const MEDAL_SLOTS: Record<
  MedalTone,
  { readonly bg: string; readonly border: string; readonly text: string }
> = {
  neutral: P.medalNeutral,
  wolf: P.medalWolf,
  god: P.medalGod,
  good: P.medalGood,
  dead: P.medalDead,
};
type MedalSize = keyof typeof NIGHT_REPORT_MEDAL_SIZES;

const MEDAL_TEXT_SIZES: Record<MedalSize, number> = {
  large: typography.title,
  roster: typography.caption,
};

/** Medal tone for a role: wolf red / god violet / villager green / neutral. */
function medalToneForRole(roleId: RoleId | null): MedalTone {
  if (roleId === null) return 'neutral';
  switch (ROLE_SPECS[roleId]?.faction) {
    case Faction.Wolf:
      return 'wolf';
    case Faction.God:
      return 'god';
    case Faction.Villager:
      return 'good';
    default:
      return 'neutral';
  }
}

interface SeatMedalProps {
  readonly seat: number;
  readonly size: MedalSize;
  readonly tone?: MedalTone;
  /** Filled stamp emphasis (a death stamp). */
  readonly stamped?: boolean;
}

/**
 * The one carrier of a seat number in the report. Every seat mention in
 * the header and the roster is a medal; the timeline sentences carry
 * their numbers as text.
 */
function SeatMedal({ seat, size, tone = 'neutral', stamped }: SeatMedalProps) {
  const slot = MEDAL_SLOTS[tone];
  const diameter = NIGHT_REPORT_MEDAL_SIZES[size];
  return (
    <View
      style={[
        styles.medal,
        {
          width: diameter,
          height: diameter,
          backgroundColor: stamped === true ? P.stampMedal.bg : slot.bg,
          borderColor: stamped === true ? P.stampMedal.bg : slot.border,
        },
      ]}
    >
      <Text
        style={[
          styles.medalText,
          {
            fontSize: MEDAL_TEXT_SIZES[size],
            color: stamped === true ? P.stampMedal.text : slot.text,
          },
        ]}
      >
        {seat + 1}
      </Text>
    </View>
  );
}

/**
 * One timeline sentence segment: plain body text, or one word in a
 * faction color. A segment carries no other styling: there are no pills,
 * no backgrounds, no muted tones in the timeline.
 */
interface TimelineSegment {
  readonly text: string;
  /** Theme faction color; absent renders in the body text color. */
  readonly color?: string;
}

/**
 * The one faction-color rule, in the render layer: a role's faction maps
 * through the shared FACTION_COLOR_MAP to a theme color. An unknown
 * faction renders uncolored rather than in a wrong color.
 */
function factionColorForRole(roleId: RoleId): string | undefined {
  const faction = ROLE_SPECS[roleId]?.faction;
  if (faction === undefined) return undefined;
  const key = FACTION_COLOR_MAP[faction];
  return key === undefined ? undefined : colors[key];
}

/**
 * Faction color for a faction-check result word. Only '狼人' carries a
 * faction; '好人' is Team.Good (god + villager + third) and has no single
 * faction color, so it stays in the body text color. Any label never seen
 * before likewise stays uncolored — a label is display text, not a
 * verdict, so no color is invented for it.
 */
function factionCheckResultColor(resultLabel: string): string | undefined {
  return resultLabel === '狼人' ? colors.wolf : undefined;
}

function SectionTitle({ text }: { readonly text: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{text}</Text>
      <View style={styles.sectionDivider} />
    </View>
  );
}

/** Role display text for an identity entry (empty seat / unassigned fallbacks). */
function identityRoleText(entry: NightReviewIdentityEntry): string {
  return entry.isEmptySeat ? '空座' : entry.roleId ? getRoleDisplayName(entry.roleId) : '未分配';
}

// ─────────────────────────────────────────────────────────────────────────────
// Conclusion header: accent bar, masthead, headline, death stamps
// ─────────────────────────────────────────────────────────────────────────────

function DeathStamp({
  seat,
  identity,
  reason,
  note,
}: {
  readonly seat: number;
  readonly identity: NightReviewIdentityEntry;
  readonly reason: keyof typeof DEATH_REASON_LABELS | null;
  readonly note: NightReviewDeathNote | undefined;
}) {
  const byline =
    note === undefined
      ? null
      : note.kind === 'wolfVotes'
        ? `狼队 ${note.votes} 票锁定`
        : `${getRoleDisplayName(note.actorRoleId)}下毒`;
  return (
    <View style={styles.stamp}>
      <SeatMedal seat={seat} size="large" stamped />
      <View style={styles.stampBody}>
        <Text style={styles.stampRole}>{identityRoleText(identity)}</Text>
        <Text style={styles.stampCause}>
          {reason !== null
            ? `${DEATH_REASON_LABELS[reason]}${NIGHT_REPORT_DEATH_CAUSE_SUFFIX}`
            : NIGHT_REPORT_DEATH_CAUSE_SUFFIX}
        </Text>
        {byline !== null && <Text style={styles.stampByline}>{byline}</Text>}
      </View>
    </View>
  );
}

function ReportHeader({
  data,
  shareTitle,
}: {
  readonly data: WerewolfNightReview;
  readonly shareTitle: string | undefined;
}) {
  const outcome = getNightReviewOutcome(data);
  const deathNotes = deriveDeathNotes(data);
  const identitiesBySeat = new Map(data.identities.map((entry) => [entry.seat, entry]));
  return (
    <View style={styles.header}>
      <View style={styles.accentBar} />
      <View style={styles.masthead}>
        <Text style={styles.kicker}>{NIGHT_REPORT_KICKER}</Text>
        {shareTitle !== undefined && <Text style={styles.mastheadTitle}>{shareTitle}</Text>}
      </View>
      <Text style={styles.headline}>
        {outcome.type === 'peaceful' ? (
          NIGHT_REVIEW_PEACEFUL_HEADLINE
        ) : (
          <>
            {NIGHT_REPORT_HEADLINE_PREFIX}
            <Text style={styles.headlineNumber}>{outcome.deaths.length}</Text>
            {NIGHT_REPORT_HEADLINE_SUFFIX}
          </>
        )}
      </Text>
      {outcome.type === 'deaths' && (
        <View style={styles.stampRow}>
          {outcome.deaths.map((death) => {
            const identity = identitiesBySeat.get(death.seat);
            if (identity === undefined) {
              throw new Error(
                `[FAIL-FAST] Night review death at seat ${death.seat} has no identity entry`,
              );
            }
            return (
              <DeathStamp
                key={death.seat}
                seat={death.seat}
                identity={identity}
                reason={death.reason}
                note={deathNotes.get(death.seat)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline sentences
// ─────────────────────────────────────────────────────────────────────────────

interface CardContext {
  readonly identitiesBySeat: ReadonlyMap<number, NightReviewIdentityEntry>;
}

/** Identity entry for a seat named by an action; a missing entry is a fact error. */
function identityForSeat(seat: number, context: CardContext): NightReviewIdentityEntry {
  const identity = context.identitiesBySeat.get(seat);
  if (identity === undefined) {
    throw new Error(`[FAIL-FAST] Night review action names seat ${seat} with no identity entry`);
  }
  return identity;
}

/**
 * The seat holding a role, resolved from the identities: the reflectDamage
 * entry carries the checker's role but no checker seat, and roles are
 * unique among seated players.
 */
function seatForRole(roleId: RoleId, context: CardContext): number {
  for (const identity of context.identitiesBySeat.values()) {
    if (identity.roleId === roleId) return identity.seat;
  }
  throw new Error(`[FAIL-FAST] Night review action names role ${roleId} with no seated identity`);
}

type ActorRef = { readonly seat: number; readonly roleId: RoleId };

/** The actor of an entry that acts; a missing actor is a fact error. */
function actorOf(entry: NightReviewActionEntry): ActorRef {
  if (!('actorSeat' in entry)) {
    throw new Error(`[FAIL-FAST] Night review timeline row cannot head entry kind ${entry.kind}`);
  }
  const roleId = nightReviewActorRoleId(entry);
  if (roleId === null) {
    throw new Error(`[FAIL-FAST] Night review timeline row cannot head entry kind ${entry.kind}`);
  }
  return { seat: entry.actorSeat, roleId };
}

/** The sentence head: "N号<角色名>", always in the body text color. */
function whoSegment(actor: ActorRef): TimelineSegment {
  return { text: `${actor.seat + 1}号${getRoleDisplayName(actor.roleId)}` };
}

/**
 * One directed verb + its plain tail: "X号<角色><动词>Y号。" with the
 * verb in the actor's faction color and the tail uncolored.
 */
function directedSegments(actor: ActorRef, verb: string, tail: string): readonly TimelineSegment[] {
  return [
    whoSegment(actor),
    { text: verb, color: factionColorForRole(actor.roleId) },
    { text: tail },
  ];
}

/** Idle / confirmation phrase per idle entry kind (subject is the sentence head). */
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
      return '未使用毒药';
    case 'poisonerNoPoison':
      return '未使用毒药';
    default:
      throw new Error(`[FAIL-FAST] Night review idle row received unhandled kind ${entry.kind}`);
  }
}

/** Aggregate votes by target: most votes first, ties by target seat ascending. */
function groupWolfVotes(
  votes: readonly { readonly voterSeat: number; readonly targetSeat: number }[],
): readonly { readonly targetSeat: number; readonly voterSeats: readonly number[] }[] {
  const byTarget = new Map<number, number[]>();
  for (const vote of votes) {
    const list = byTarget.get(vote.targetSeat);
    if (list) list.push(vote.voterSeat);
    else byTarget.set(vote.targetSeat, [vote.voterSeat]);
  }
  return Array.from(byTarget.entries())
    .map(([targetSeat, voterSeats]) => ({ targetSeat, voterSeats }))
    .sort((a, b) => b.voterSeats.length - a.voterSeats.length || a.targetSeat - b.targetSeat);
}

/**
 * The wolf team's one line. The voters name themselves in the shared-target
 * parenthetical; a split vote lists the vote pairs in target-group order
 * (most votes first, ties by target seat ascending) and the recorded
 * verdict phrase; a split or pending vote colors nothing, because no
 * resolved target exists to color. The entry's votes are display only:
 * the verdict comes from deriveWolfVerdict, never from a tally.
 */
function wolfSegments(
  entry: Extract<NightReviewActionEntry, { kind: 'wolfAttack' }>,
): readonly TimelineSegment[] {
  const verdict = deriveWolfVerdict(entry);
  switch (verdict.type) {
    case 'sharedTarget': {
      const voters = entry.votes.map((vote) => vote.voterSeat);
      return [
        { text: `狼队（${voters.map((seat) => seat + 1).join('、')}号）` },
        { text: `袭击${verdict.targetSeat + 1}号`, color: colors.wolf },
        { text: '。' },
      ];
    }
    case 'splitKilled':
    case 'tiePicked':
    case 'splitTied':
    case 'tiePending': {
      const pairs = groupWolfVotes(entry.votes)
        .flatMap((group) =>
          group.voterSeats.map((seat) => `${seat + 1}号投${group.targetSeat + 1}号`),
        )
        .join('、');
      const tail =
        verdict.type === 'splitKilled'
          ? `按多数票击杀${verdict.targetSeat + 1}号`
          : verdict.type === 'tiePicked'
            ? `平票抽中${verdict.targetSeat + 1}号`
            : verdict.type === 'splitTied'
              ? '平票，未击杀'
              : '平票，目标未记录';
      const tailColor =
        verdict.type === 'splitKilled' || verdict.type === 'tiePicked' ? colors.wolf : undefined;
      return [
        { text: `狼队投票不一致（${pairs}），` },
        { text: tail, color: tailColor },
        { text: '。' },
      ];
    }
    case 'allAbstain':
      return [{ text: '狼队全员空刀。' }];
  }
}

/**
 * One potion owner's one line: the owner head once, then one clause per
 * potion — a used potion names its target in the owner's faction color,
 * an unused potion reads as plain words. The two "未使用" clauses carry
 * no ✗ and no separate note line.
 */
function potionSegments(
  actor: PotionActor,
  entries: readonly NightReviewActionEntry[],
): readonly TimelineSegment[] {
  const first = entries[0];
  if (first === undefined || !('actorSeat' in first)) {
    throw new Error('[FAIL-FAST] Night review potion row has no headed entry');
  }
  const segments: TimelineSegment[] = [
    { text: `${first.actorSeat + 1}号${getRoleDisplayName(actor)}` },
  ];
  const color = factionColorForRole(actor);
  for (const entry of entries) {
    switch (entry.kind) {
      case 'save':
        segments.push({ text: `使用解药救起${entry.targetSeat + 1}号`, color }, { text: '。' });
        break;
      case 'poison':
        segments.push({ text: `毒杀${entry.targetSeat + 1}号`, color }, { text: '。' });
        break;
      case 'witchNoSave':
        segments.push({ text: '解药未使用。' });
        break;
      case 'witchNoPoison':
      case 'poisonerNoPoison':
        segments.push({ text: '毒药未使用。' });
        break;
      case 'witchIdleAll':
        // Defensive only: the builder emits witchIdleAll solely when the
        // family used nothing, so groupEntries dissolves it into an idle
        // row and it never reaches this row. If it ever does, both
        // potions read as unused rather than dropping the fact.
        segments.push({ text: '解药未使用。毒药未使用。' });
        break;
      default:
        break;
    }
  }
  return segments;
}

/**
 * One action as one timeline sentence. The switch is exhaustive over the
 * 51 kinds; a potion entry (save / poison) only renders inside a potion
 * row, and anything unhandled fails fast — a new kind with no sentence
 * cannot slip into the report.
 *
 * Sentence grammar (one rule, not one sentence per kind): "X号<角色名>
 * <动词>Y号", the verb in the actor's faction color; the exceptions are
 * the wolf line, the warnings, the setup line, and the outcome line,
 * each composed below from the same segments.
 */
function timelineSegments(
  entry: NightReviewActionEntry,
  context: CardContext,
): readonly TimelineSegment[] {
  // The kind is read once so the exhaustive default below can name it:
  // inside the default arm the entry itself narrows to never.
  const kind = entry.kind;
  switch (entry.kind) {
    case 'bottomCards': {
      const segments: TimelineSegment[] = [{ text: '底牌：' }];
      entry.roleIds.forEach((roleId, index) => {
        if (index > 0) segments.push({ text: '、' });
        segments.push({ text: getRoleDisplayName(roleId), color: factionColorForRole(roleId) });
      });
      segments.push({ text: '。' });
      return segments;
    }
    case 'cardChoice': {
      const actor = actorOf(entry);
      return [
        whoSegment(actor),
        { text: '选择了', color: factionColorForRole(actor.roleId) },
        {
          text: getRoleDisplayName(entry.chosenRoleId),
          color: factionColorForRole(entry.chosenRoleId),
        },
        { text: '。' },
      ];
    }
    case 'cupidLink': {
      const actor = actorOf(entry);
      return directedSegments(actor, '连线', `${entry.seats[0] + 1}号和${entry.seats[1] + 1}号。`);
    }
    case 'wolfAttack':
      return wolfSegments(entry);
    case 'wolfNoTarget':
      return [{ text: '狼队未选择目标。' }];
    case 'wolfGiveUp':
      return [
        {
          text:
            entry.reason === 'poisonerPresent'
              ? '狼队放弃袭击，毒师在场。'
              : `狼队放弃袭击，被${getRoleDisplayName('nightmare')}封锁。`,
        },
      ];
    case 'nightmareBlock': {
      const actor = actorOf(entry);
      const segments: TimelineSegment[] = [
        whoSegment(actor),
        { text: '封锁', color: factionColorForRole(actor.roleId) },
        { text: `${entry.targetSeat + 1}号` },
      ];
      if (entry.targetRoleId !== null) {
        segments.push({ text: `（${getRoleDisplayName(entry.targetRoleId)}，技能无效）` });
      }
      segments.push({ text: '。' });
      return segments;
    }
    case 'shelter':
      return directedSegments(actorOf(entry), '庇护', `${entry.targetSeat + 1}号。`);
    case 'guard':
      return directedSegments(actorOf(entry), '守护', `${entry.targetSeat + 1}号。`);
    case 'silence':
      return directedSegments(actorOf(entry), '禁言', `${entry.targetSeat + 1}号。`);
    case 'voteban':
      return directedSegments(actorOf(entry), '禁票', `${entry.targetSeat + 1}号。`);
    case 'curse':
      return directedSegments(actorOf(entry), '诅咒', `${entry.targetSeat + 1}号。`);
    case 'dream':
      return directedSegments(actorOf(entry), '摄梦', `${entry.targetSeat + 1}号。`);
    case 'swap': {
      const actor = actorOf(entry);
      return directedSegments(actor, '交换', `${entry.seats[0] + 1}号和${entry.seats[1] + 1}号。`);
    }
    case 'idolChoice':
      return directedSegments(actorOf(entry), '选择榜样', `${entry.targetSeat + 1}号。`);
    case 'mimic': {
      const actor = actorOf(entry);
      return directedSegments(
        actor,
        '模仿',
        entry.isBound ? `${entry.targetSeat + 1}号（绑定）。` : `${entry.targetSeat + 1}号。`,
      );
    }
    case 'charm':
      return directedSegments(actorOf(entry), '魅惑', `${entry.targetSeat + 1}号。`);
    case 'convert':
      return directedSegments(actorOf(entry), '转化', `${entry.targetSeat + 1}号。`);
    case 'wolfGirlConfess':
      return directedSegments(actorOf(entry), '表白', `${entry.targetSeat + 1}号。`);
    case 'hypnotize': {
      const actor = actorOf(entry);
      return directedSegments(
        actor,
        '催眠',
        `${entry.targetSeats.map((seat) => `${seat + 1}号`).join('、')}。`,
      );
    }
    case 'check': {
      const actor = actorOf(entry);
      const label = formatCheckResultLabel(entry.result, entry.resultFormat);
      if (entry.resultFormat === 'factionCheck') {
        return [
          whoSegment(actor),
          { text: '查验', color: factionColorForRole(actor.roleId) },
          { text: `${entry.targetSeat + 1}号，结果：` },
          { text: label, color: factionCheckResultColor(label) },
          { text: '。' },
        ];
      }
      if (!isValidRoleId(entry.result)) {
        throw new Error(`[FAIL-FAST] Reveal result ${entry.result} is not a role id`);
      }
      return [
        whoSegment(actor),
        { text: '查验', color: factionColorForRole(actor.roleId) },
        { text: `${entry.targetSeat + 1}号，结果：` },
        { text: label, color: factionColorForRole(entry.result) },
        { text: '。' },
      ];
    }
    case 'learn': {
      const actor = actorOf(entry);
      return [
        whoSegment(actor),
        { text: '学习', color: factionColorForRole(actor.roleId) },
        { text: `${entry.targetSeat + 1}号，学到身份：` },
        {
          text: getRoleDisplayName(entry.learnedRoleId),
          color: factionColorForRole(entry.learnedRoleId),
        },
        { text: '。' },
      ];
    }
    case 'shootStatus': {
      const actor = actorOf(entry);
      return [
        whoSegment(actor),
        entry.canShoot
          ? { text: '可以发动', color: factionColorForRole(actor.roleId) }
          : { text: '不能发动' },
        { text: '。' },
      ];
    }
    case 'infectConverted': {
      const actor = actorOf(entry);
      return directedSegments(actor, '感染', `${entry.targetSeat + 1}号，成功。`);
    }
    case 'infectFailed': {
      const actor = actorOf(entry);
      return directedSegments(actor, '感染', `${entry.targetSeat + 1}号，失败。`);
    }
    case 'guardSaveConflict':
      return [{ text: `${entry.targetSeat + 1}号同守同救，仍然死亡。` }];
    case 'poisonImmune':
      return [
        { text: `${entry.targetSeat + 1}号` },
        {
          text: getRoleDisplayName(entry.targetRoleId),
          color: factionColorForRole(entry.targetRoleId),
        },
        { text: '免疫毒药。' },
      ];
    case 'reflectDamage': {
      const checker: ActorRef = {
        seat: seatForRole(entry.checkerRoleId, context),
        roleId: entry.checkerRoleId,
      };
      return directedSegments(checker, '查验', `${entry.targetSeat + 1}号，反伤。`);
    }
    case 'peacefulNight':
      return [{ text: '本夜无人出局。' }];
    case 'deaths': {
      const segments: TimelineSegment[] = [];
      entry.deaths.forEach((death, index) => {
        if (index > 0) {
          segments.push({ text: index === entry.deaths.length - 1 ? '和' : '、' });
        }
        const identity = identityForSeat(death.seat, context);
        segments.push({
          text: `${death.seat + 1}号`,
          color: identity.roleId === null ? undefined : factionColorForRole(identity.roleId),
        });
      });
      segments.push({ text: '出局。' });
      return segments;
    }
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
    case 'poisonerNoPoison': {
      const actor = actorOf(entry);
      return [whoSegment(actor), { text: idlePhrase(entry) }, { text: '。' }];
    }
    case 'hiddenWolfConfirmed':
    case 'avengerConfirmed': {
      const actor = actorOf(entry);
      return [
        whoSegment(actor),
        { text: idlePhrase(entry), color: factionColorForRole(actor.roleId) },
        { text: '。' },
      ];
    }
    case 'save':
    case 'poison':
      throw new Error(
        `[FAIL-FAST] Night review potion entry ${entry.kind} must render inside a potion row`,
      );
    default:
      throw new Error(`[FAIL-FAST] Night review timeline row received unhandled kind ${kind}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline grouping and rows
// ─────────────────────────────────────────────────────────────────────────────

/** Kinds that render as a did-not-act sentence when they stand alone. */
const IDLE_KINDS: ReadonlySet<NightReviewActionEntry['kind']> = new Set([
  'nightmareIdle',
  'shelterIdle',
  'hiddenWolfConfirmed',
  'guardIdle',
  'silenceIdle',
  'votebanIdle',
  'curseIdle',
  'dreamIdle',
  'swapIdle',
  'charmIdle',
  'hypnotizeIdle',
  'checkIdle',
  'learnIdle',
  'avengerConfirmed',
  'infectIdle',
]);

type PotionActor = 'witch' | 'poisoner';

/** The potion family an entry belongs to, if any (one row per potion owner). */
function potionActorOf(entry: NightReviewActionEntry): PotionActor | null {
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

type ReportBlock =
  | { readonly type: 'card'; readonly entry: NightReviewActionEntry }
  | {
      readonly type: 'potion';
      readonly actor: PotionActor;
      readonly entries: readonly NightReviewActionEntry[];
    }
  | { readonly type: 'idle'; readonly entry: NightReviewActionEntry };

/**
 * Turn the entries into blocks in night order (the engine's summary
 * order). The potion family merges into a single block per owner when
 * the owner used a potion; a family that did nothing at all dissolves
 * into idle rows. The outcome entry (deaths / peacefulNight) stays in
 * order — the builder emits it last, so it is the last row. No faction
 * grouping: the order on the page is the order the night happened.
 */
function groupEntries(actions: readonly NightReviewActionEntry[]): readonly ReportBlock[] {
  const familyEffective = new Map<PotionActor, boolean>();
  for (const entry of actions) {
    const actor = potionActorOf(entry);
    if (actor === null) continue;
    if (entry.kind === 'save' || entry.kind === 'poison') familyEffective.set(actor, true);
    else if (!familyEffective.has(actor)) familyEffective.set(actor, false);
  }

  const blocks: ReportBlock[] = [];
  const potionBlocks = new Map<PotionActor, NightReviewActionEntry[]>();
  for (const entry of actions) {
    const actor = potionActorOf(entry);
    if (actor !== null) {
      if (familyEffective.get(actor)) {
        let family = potionBlocks.get(actor);
        if (family === undefined) {
          family = [];
          potionBlocks.set(actor, family);
          blocks.push({ type: 'potion', actor, entries: family });
        }
        family.push(entry);
      } else {
        blocks.push({ type: 'idle', entry });
      }
      continue;
    }
    blocks.push(IDLE_KINDS.has(entry.kind) ? { type: 'idle', entry } : { type: 'card', entry });
  }

  return blocks;
}

function blockKey(block: ReportBlock, index: number): string {
  if (block.type === 'potion') return `potion-${block.actor}`;
  return `${block.type}-${block.entry.kind}-${index}`;
}

/**
 * One timeline row: a hollow dot on the rail, then the sentence. The
 * rail below the dot runs to the next row's dot (the last row has none);
 * the sentence's bottom padding carries the rail across the gap between
 * rows, so the line reads as one continuous rail.
 */
function TimelineRow({
  segments,
  isLast,
}: {
  readonly segments: readonly TimelineSegment[];
  readonly isLast: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRailColumn}>
        <View style={styles.timelineDot} />
        {isLast ? null : <View style={styles.timelineRail} />}
      </View>
      <Text style={[styles.timelineText, isLast ? styles.timelineTextLast : null]}>
        {segments.map((segment, index) => (
          <Text
            key={index}
            style={segment.color === undefined ? undefined : { color: segment.color }}
          >
            {segment.text}
          </Text>
        ))}
      </Text>
    </View>
  );
}

/** One night's timeline sentences in night order, under the section title. */
function TimelineBlock({
  blocks,
  context,
}: {
  readonly blocks: readonly ReportBlock[];
  readonly context: CardContext;
}) {
  return (
    <View>
      {blocks.map((block, index) => (
        <TimelineRow
          key={blockKey(block, index)}
          segments={
            block.type === 'potion'
              ? potionSegments(block.actor, block.entries)
              : timelineSegments(block.entry, context)
          }
          isLast={index === blocks.length - 1}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity roster
// ─────────────────────────────────────────────────────────────────────────────

function RosterList({ data }: { readonly data: WerewolfNightReview }) {
  const outcome = getNightReviewOutcome(data);
  const reasonBySeat = new Map<number, keyof typeof DEATH_REASON_LABELS | null>(
    outcome.type === 'deaths' ? outcome.deaths.map((death) => [death.seat, death.reason]) : [],
  );
  return (
    <View style={styles.roster}>
      {data.identities.map((entry) => {
        const reason = reasonBySeat.get(entry.seat);
        return (
          <View key={entry.seat} style={styles.rosterRow}>
            <SeatMedal
              seat={entry.seat}
              size="roster"
              tone={entry.isAlive ? medalToneForRole(entry.roleId) : 'dead'}
            />
            <Text
              style={[styles.rosterName, entry.isAlive ? null : styles.rosterNameOut]}
              numberOfLines={1}
            >
              {identityRoleText(entry)}
            </Text>
            <Text style={[styles.rosterStatus, entry.isAlive ? null : styles.rosterStatusOut]}>
              {entry.isAlive
                ? NIGHT_REPORT_ROSTER_ALIVE
                : reason
                  ? `${DEATH_REASON_LABELS[reason]}${NIGHT_REPORT_DEATH_CAUSE_SUFFIX}`
                  : NIGHT_REPORT_ROSTER_OUT}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

interface NightReviewReportBodyProps {
  readonly data: WerewolfNightReview;
  /** Masthead title on the share image (room label); absent in the modal. */
  readonly shareTitle?: string;
}

export function NightReviewReportBody({ data, shareTitle }: NightReviewReportBodyProps) {
  const blocks = groupEntries(data.actions);
  const context: CardContext = useMemo(
    () => ({
      identitiesBySeat: new Map(data.identities.map((entry) => [entry.seat, entry])),
    }),
    [data],
  );

  return (
    <View style={styles.root}>
      <ReportHeader data={data} shareTitle={shareTitle} />
      <View style={styles.page}>
        <SectionTitle text={NIGHT_REPORT_TIMELINE_TITLE} />
        <TimelineBlock blocks={blocks} context={context} />
        {data.sheriff !== undefined && (
          <>
            <SectionTitle text={NIGHT_REPORT_SHERIFF_TITLE} />
            <View style={styles.group}>
              <View style={[styles.groupRail, { backgroundColor: P.rail.neutral }]} />
              <View style={[styles.groupInner, styles.sheriffInner]}>
                <SheriffElectionReportSection section={data.sheriff} />
              </View>
            </View>
          </>
        )}
        <View style={styles.perforation} />
        <SectionTitle text={NIGHT_REVIEW_IDENTITIES_TITLE} />
        <RosterList data={data} />
        <Text style={styles.footer}>{NIGHT_REPORT_FOOTER_TEXT}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (every value from @/theme tokens or the layout palette)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    backgroundColor: P.background,
    borderRadius: borderRadius.xlarge,
    overflow: 'hidden',
  },
  page: {
    paddingHorizontal: spacing.large,
    paddingBottom: spacing.large,
    gap: spacing.medium,
  },
  // ── Conclusion header ──
  header: {
    gap: spacing.medium,
    paddingBottom: spacing.medium,
  },
  accentBar: {
    height: spacing.small,
    backgroundColor: P.accent,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.large,
    paddingTop: spacing.small,
  },
  kicker: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
    color: P.text,
  },
  mastheadTitle: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
    color: P.textMuted,
  },
  headline: {
    paddingHorizontal: spacing.large,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.display,
    fontWeight: typography.weights.bold,
    color: P.text,
  },
  headlineNumber: {
    fontSize: typography.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: typography.weights.bold,
    color: P.danger,
  },
  stampRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
    paddingHorizontal: spacing.large,
  },
  stamp: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    borderWidth: fixed.borderWidthThick,
    borderColor: P.stampBorder,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.small,
  },
  stampBody: {
    flex: 1,
  },
  stampRole: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: P.text,
  },
  stampCause: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: P.danger,
    marginTop: spacing.micro,
  },
  stampByline: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    color: P.textMuted,
  },
  // ── Section titles ──
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  sectionTitle: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    letterSpacing: spacing.micro,
    color: P.text,
  },
  sectionDivider: {
    flex: 1,
    height: fixed.divider,
    backgroundColor: P.cardBorder,
  },
  // ── Timeline ──
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  timelineRailColumn: {
    width: spacing.small + spacing.tight,
    alignItems: 'center',
  },
  timelineDot: {
    width: spacing.small + spacing.tight,
    height: spacing.small + spacing.tight,
    marginTop: spacing.tight,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: P.textMuted,
    backgroundColor: P.background,
  },
  timelineRail: {
    flex: 1,
    width: fixed.divider,
    backgroundColor: P.divider,
  },
  timelineText: {
    flex: 1,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: P.text,
    paddingBottom: spacing.small,
  },
  timelineTextLast: {
    paddingBottom: 0,
  },
  // ── Sheriff group (panel section keeps its rail) ──
  group: {
    flexDirection: 'row',
    borderWidth: fixed.borderWidth,
    borderColor: P.cardBorder,
    borderRadius: borderRadius.small,
    overflow: 'hidden',
  },
  groupRail: {
    width: spacing.tight + spacing.micro,
  },
  groupInner: {
    flex: 1,
    minWidth: 0,
  },
  sheriffInner: {
    padding: spacing.medium,
  },
  medal: {
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: {
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  // ── Perforation + roster ──
  perforation: {
    borderTopWidth: fixed.borderWidthThick,
    borderTopColor: P.cardBorder,
    borderStyle: 'dashed',
    marginTop: spacing.small,
  },
  roster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.small,
  },
  rosterRow: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.small - spacing.micro,
    borderBottomWidth: fixed.divider,
    borderBottomColor: P.divider,
  },
  rosterName: {
    flex: 1,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: P.text,
  },
  rosterNameOut: {
    color: P.textMuted,
    textDecorationLine: 'line-through',
  },
  rosterStatus: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    fontWeight: typography.weights.semibold,
    color: P.textMuted,
  },
  rosterStatusOut: {
    color: P.danger,
    fontWeight: typography.weights.bold,
  },
  footer: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    color: P.textFaint,
    textAlign: 'center',
  },
});
