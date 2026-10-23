/**
 * NightReviewReportBody - The one presentation body for the night review report.
 *
 * 2026 report presentation (identical on every surface): a light-surface
 * "night report" in five sections — conclusion header (kicker, headline,
 * stats strip, one card per death) → key actions (one card per actor; the
 * wolf team shares one team card) → did-not-act strip → sheriff election
 * card (when an election exists) → identity wall → footer line.
 *
 * Number discipline: a seat number appears exactly once per mention, on
 * its SeatMedal. Text next to a medal never repeats the number; role names
 * appear as card-head subjects and identity statements (death cards,
 * identity wall), plus payload annotations where the role itself is the
 * information (a learned identity, an immune target's role, a blocked
 * target's role).
 *
 * Consumed by NightReviewModal (in-room) and NightReviewShareCard (share
 * image); shells own only their frame. No service imports, no business
 * logic: every fact comes from NightReview.helpers derivations, all shared
 * copy/geometry from nightReviewLayout, flat colors only (no gradients —
 * the segmented screenshot capture composites bands).
 */
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import {
  Faction,
  getRoleDisplayName,
  ROLE_SPECS,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';

import {
  DEATH_REASON_LABELS,
  deriveDeathNotes,
  deriveNightReportStats,
  deriveWolfTargetSaveNote,
  deriveWolfVerdict,
  getNightReviewOutcome,
  type NightReportStats,
  type NightReviewActionEntry,
  nightReviewActorRoleId,
  type NightReviewData,
  type NightReviewDeathNote,
  type NightReviewIdentityEntry,
  type NightReviewSheriffRound,
  type NightReviewSheriffSection,
  type NightReviewWolfVerdict,
} from '../NightReview.helpers';
import {
  formatNightReportSheriffVotesTag,
  formatNightReviewOutcomeHeadline,
  NIGHT_REPORT_ACTIONS_TITLE,
  NIGHT_REPORT_DEATH_CAUSE_SUFFIX,
  NIGHT_REPORT_FOOTER_TEXT,
  NIGHT_REPORT_IDLE_TITLE,
  NIGHT_REPORT_KICKER,
  NIGHT_REPORT_MEDAL_SIZES,
  NIGHT_REPORT_PALETTE,
  NIGHT_REPORT_ROSTER_ALIVE,
  NIGHT_REPORT_ROSTER_OUT,
  NIGHT_REPORT_SHERIFF_ABSTAIN_LABEL,
  NIGHT_REPORT_SHERIFF_CANDIDATES_LABEL,
  NIGHT_REPORT_SHERIFF_ELECTED_TITLE,
  NIGHT_REPORT_SHERIFF_IN_PROGRESS,
  NIGHT_REPORT_SHERIFF_NONE_TITLE,
  NIGHT_REPORT_SHERIFF_REASON_LABELS,
  NIGHT_REPORT_SHERIFF_REGISTRATION_STATUS,
  NIGHT_REPORT_SHERIFF_ROUND_LABELS,
  NIGHT_REPORT_SHERIFF_RUNOFF_CANDIDATES_LABEL,
  NIGHT_REPORT_SHERIFF_RUNOFF_IN_PROGRESS,
  NIGHT_REPORT_SHERIFF_TITLE,
  NIGHT_REPORT_SHERIFF_VOTE_ROUND_SUFFIX,
  NIGHT_REPORT_SHERIFF_VOTING,
  NIGHT_REPORT_SHERIFF_WITHDRAWN_LABEL,
  NIGHT_REPORT_STAT_LABELS,
  NIGHT_REPORT_WOLF_TAG_ABSTAIN,
  NIGHT_REPORT_WOLF_TAG_KILLED,
  NIGHT_REPORT_WOLF_TAG_SURVIVED,
  NIGHT_REPORT_WOLF_TAG_TIED,
  NIGHT_REPORT_WOLF_VERDICT_ALL_ABSTAIN,
  NIGHT_REPORT_WOLF_VERDICT_SHARED,
  NIGHT_REPORT_WOLF_VERDICT_SPLIT_KILLED,
  NIGHT_REPORT_WOLF_VERDICT_SPLIT_TIED,
  NIGHT_REVIEW_IDENTITIES_TITLE,
  NIGHT_REVIEW_PEACEFUL_HEADLINE,
} from '../nightReviewLayout';

const P = NIGHT_REPORT_PALETTE;

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

type MedalTone = 'neutral' | 'wolf' | 'god' | 'good' | 'dead' | 'rosterOut';

const MEDAL_SLOTS: Record<
  MedalTone,
  { readonly bg: string; readonly border: string; readonly text: string }
> = {
  neutral: P.medalNeutral,
  wolf: P.medalWolf,
  god: P.medalGod,
  good: P.medalGood,
  dead: P.medalDead,
  rosterOut: P.rosterOutMedal,
};
type MedalSize = keyof typeof NIGHT_REPORT_MEDAL_SIZES;

const MEDAL_TEXT_SIZES: Record<MedalSize, number> = {
  large: typography.subtitle,
  medium: typography.secondary,
  small: typography.caption,
  roster: typography.body,
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
  /** Filled emphasis (the wolf team's resolved target). */
  readonly filled?: boolean;
  /** Dimmed (out of the game / withdrawn). */
  readonly dimmed?: boolean;
  /** Glyph instead of a seat number (the wolf team medal). */
  readonly glyph?: string;
}

/**
 * The one carrier of a seat number in the report. Every seat mention is a
 * medal; surrounding text never repeats the number.
 */
function SeatMedal({ seat, size, tone = 'neutral', filled, dimmed, glyph }: SeatMedalProps) {
  const slot = MEDAL_SLOTS[tone];
  const diameter = NIGHT_REPORT_MEDAL_SIZES[size];
  return (
    <View
      style={[
        styles.medal,
        {
          width: diameter,
          height: diameter,
          backgroundColor: filled ? P.hitMedalBg : slot.bg,
          borderColor: filled ? P.hitMedalBg : slot.border,
        },
        dimmed ? styles.medalDimmed : null,
      ]}
    >
      <Text
        style={[
          styles.medalText,
          {
            fontSize: MEDAL_TEXT_SIZES[size],
            color: filled ? P.hitMedalText : slot.text,
          },
        ]}
      >
        {glyph ?? seat + 1}
      </Text>
    </View>
  );
}

type TagTone = 'bad' | 'good' | 'info' | 'muted';

function ReportTag({ text, tone }: { readonly text: string; readonly tone: TagTone }) {
  const slot =
    tone === 'bad'
      ? P.tagBad
      : tone === 'good'
        ? P.tagGood
        : tone === 'info'
          ? P.tagInfo
          : P.tagMuted;
  return (
    <View style={[styles.tag, { backgroundColor: slot.bg }]}>
      <Text style={[styles.tagText, { color: slot.text }]}>{text}</Text>
    </View>
  );
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
// Conclusion header: kicker, headline, stats strip, death cards
// ─────────────────────────────────────────────────────────────────────────────

function DeathCard({
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
    <View style={styles.deathCard}>
      <SeatMedal
        seat={seat}
        size="large"
        tone={
          identity.roleId !== null && medalToneForRole(identity.roleId) === 'wolf' ? 'wolf' : 'dead'
        }
      />
      <Text style={styles.deathRole}>{identityRoleText(identity)}</Text>
      <View style={styles.deathWhy}>
        <Text style={styles.deathCause}>
          {reason !== null
            ? `${DEATH_REASON_LABELS[reason]}${NIGHT_REPORT_DEATH_CAUSE_SUFFIX}`
            : '出局'}
        </Text>
        {byline !== null && <Text style={styles.deathByline}>{byline}</Text>}
      </View>
    </View>
  );
}

function StatsStrip({ stats }: { readonly stats: NightReportStats }) {
  const chips: readonly { readonly label: string; readonly count: number; readonly dot: string }[] =
    [
      { label: NIGHT_REPORT_STAT_LABELS.wolfKill, count: stats.wolfKills, dot: P.danger },
      { label: NIGHT_REPORT_STAT_LABELS.poison, count: stats.poisonKills, dot: P.violet },
      { label: NIGHT_REPORT_STAT_LABELS.save, count: stats.saves, dot: P.medalGood.text },
      { label: NIGHT_REPORT_STAT_LABELS.check, count: stats.checks, dot: P.textSecondary },
    ];
  return (
    <View style={styles.statsRow}>
      {chips.map((chip) => (
        <View key={chip.label} style={styles.statChip}>
          <Text style={styles.statChipText}>
            <Text style={{ color: chip.dot }}>● </Text>
            {`${chip.label} `}
            <Text style={styles.statChipCount}>{chip.count}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

function ReportHeader({ data }: { readonly data: NightReviewData }) {
  const outcome = getNightReviewOutcome(data);
  const stats = deriveNightReportStats(data);
  const deathNotes = deriveDeathNotes(data);
  const identitiesBySeat = new Map(data.identities.map((entry) => [entry.seat, entry]));
  return (
    <View style={styles.header}>
      <Text style={styles.kicker}>{NIGHT_REPORT_KICKER}</Text>
      <Text style={styles.headline}>
        {outcome.type === 'peaceful'
          ? NIGHT_REVIEW_PEACEFUL_HEADLINE
          : formatNightReviewOutcomeHeadline(outcome.deaths.length)}
      </Text>
      <StatsStrip stats={stats} />
      {outcome.type === 'deaths' && (
        <View style={styles.deathList}>
          {outcome.deaths.map((death) => {
            const identity = identitiesBySeat.get(death.seat);
            if (identity === undefined) {
              throw new Error(
                `[FAIL-FAST] Night review death at seat ${death.seat} has no identity entry`,
              );
            }
            return (
              <DeathCard
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
// Action partitioning: cards vs the did-not-act strip
// ─────────────────────────────────────────────────────────────────────────────

/** Kinds that render in the muted did-not-act strip when they stand alone. */
const STRIP_KINDS: ReadonlySet<NightReviewActionEntry['kind']> = new Set([
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

/** The potion family an entry belongs to, if any (one card per potion owner). */
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
    };

/**
 * Partition the entries into timeline cards and strip entries. The potion
 * family merges into a single card per owner when the owner used a potion;
 * a family that did nothing at all dissolves into the strip.
 */
function partitionEntries(actions: readonly NightReviewActionEntry[]): {
  readonly blocks: readonly ReportBlock[];
  readonly strip: readonly NightReviewActionEntry[];
} {
  const familyEffective = new Map<PotionActor, boolean>();
  for (const entry of actions) {
    const actor = potionActorOf(entry);
    if (actor === null) continue;
    if (entry.kind === 'save' || entry.kind === 'poison') familyEffective.set(actor, true);
    else if (!familyEffective.has(actor)) familyEffective.set(actor, false);
  }

  const blocks: ReportBlock[] = [];
  const strip: NightReviewActionEntry[] = [];
  const potionBlocks = new Map<PotionActor, NightReviewActionEntry[]>();
  for (const entry of actions) {
    if (entry.kind === 'deaths' || entry.kind === 'peacefulNight') continue;
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
        strip.push(entry);
      }
      continue;
    }
    if (STRIP_KINDS.has(entry.kind)) {
      strip.push(entry);
      continue;
    }
    blocks.push({ type: 'card', entry });
  }
  return { blocks, strip };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action cards
// ─────────────────────────────────────────────────────────────────────────────

interface CardContext {
  readonly deadSeats: ReadonlySet<number>;
  /** The wolf target the witch left unsaved (witch card annotation). */
  readonly wolfTargetSaveNote: { readonly wolfTargetSeat: number } | null;
}

function CardHead({
  actorSeat,
  actorRoleId,
  tag,
}: {
  readonly actorSeat: number;
  readonly actorRoleId: RoleId;
  readonly tag?: ReactNode;
}) {
  return (
    <View style={styles.cardHead}>
      <SeatMedal seat={actorSeat} size="medium" tone={medalToneForRole(actorRoleId)} />
      <Text style={styles.cardRole}>{getRoleDisplayName(actorRoleId)}</Text>
      {tag !== undefined && <View style={styles.cardTag}>{tag}</View>}
    </View>
  );
}

function ActionRow({ children }: { readonly children: ReactNode }) {
  return <View style={styles.actionRow}>{children}</View>;
}

function VerbText({ text }: { readonly text: string }) {
  return <Text style={styles.verb}>{text}</Text>;
}

function AnnotationText({ text }: { readonly text: string }) {
  return <Text style={styles.annotation}>{text}</Text>;
}

function TargetMedal({ seat }: { readonly seat: number }) {
  return <SeatMedal seat={seat} size="small" />;
}

/** One actor's card: head (medal + role subject) plus its action rows. */
function ActorCard({ entry }: { readonly entry: NightReviewActionEntry }) {
  const actorRoleId = nightReviewActorRoleId(entry);
  if (actorRoleId === null || !('actorSeat' in entry)) {
    throw new Error(`[FAIL-FAST] Night review actor card cannot head entry kind ${entry.kind}`);
  }
  const actorSeat = entry.actorSeat;

  let tag: ReactNode;
  let rows: ReactNode;
  switch (entry.kind) {
    case 'nightmareBlock':
      rows = (
        <ActionRow>
          <VerbText text="封锁" />
          <TargetMedal seat={entry.targetSeat} />
          {entry.targetRoleId !== null && (
            <AnnotationText text={`（${getRoleDisplayName(entry.targetRoleId)}，技能无效）`} />
          )}
        </ActionRow>
      );
      break;
    case 'shelter':
      rows = (
        <ActionRow>
          <VerbText text="庇护" />
          <TargetMedal seat={entry.targetSeat} />
        </ActionRow>
      );
      break;
    case 'guard':
      rows = (
        <ActionRow>
          <VerbText text="守护" />
          <TargetMedal seat={entry.targetSeat} />
        </ActionRow>
      );
      break;
    case 'silence':
      rows = (
        <ActionRow>
          <VerbText text="禁言" />
          <TargetMedal seat={entry.targetSeat} />
        </ActionRow>
      );
      break;
    case 'voteban':
      rows = (
        <ActionRow>
          <VerbText text="禁票" />
          <TargetMedal seat={entry.targetSeat} />
        </ActionRow>
      );
      break;
    case 'curse':
      rows = (
        <ActionRow>
          <VerbText text="诅咒" />
          <TargetMedal seat={entry.targetSeat} />
        </ActionRow>
      );
      break;
    case 'dream':
      rows = (
        <ActionRow>
          <VerbText text="摄梦" />
          <TargetMedal seat={entry.targetSeat} />
        </ActionRow>
      );
      break;
    case 'swap':
      rows = (
        <ActionRow>
          <VerbText text="交换" />
          <TargetMedal seat={entry.seats[0]} />
          <AnnotationText text="和" />
          <TargetMedal seat={entry.seats[1]} />
        </ActionRow>
      );
      break;
    case 'cupidLink':
      rows = (
        <ActionRow>
          <VerbText text="连线" />
          <TargetMedal seat={entry.seats[0]} />
          <AnnotationText text="和" />
          <TargetMedal seat={entry.seats[1]} />
        </ActionRow>
      );
      break;
    case 'cardChoice':
      rows = (
        <ActionRow>
          <VerbText text="选择了" />
          <Text style={styles.chosenRole}>{getRoleDisplayName(entry.chosenRoleId)}</Text>
        </ActionRow>
      );
      break;
    case 'idolChoice':
      rows = (
        <ActionRow>
          <VerbText text="选择榜样" />
          <TargetMedal seat={entry.targetSeat} />
        </ActionRow>
      );
      break;
    case 'mimic':
      rows = (
        <ActionRow>
          <VerbText text="模仿" />
          <TargetMedal seat={entry.targetSeat} />
          {entry.isBound && <ReportTag text="绑定" tone="info" />}
        </ActionRow>
      );
      break;
    case 'charm':
      rows = (
        <ActionRow>
          <VerbText text="魅惑" />
          <TargetMedal seat={entry.targetSeat} />
        </ActionRow>
      );
      break;
    case 'convert':
      rows = (
        <ActionRow>
          <VerbText text="转化" />
          <TargetMedal seat={entry.targetSeat} />
        </ActionRow>
      );
      break;
    case 'hypnotize':
      rows = (
        <ActionRow>
          <VerbText text="催眠" />
          {entry.targetSeats.map((seat) => (
            <TargetMedal key={seat} seat={seat} />
          ))}
        </ActionRow>
      );
      break;
    case 'check':
      rows = (
        <ActionRow>
          <VerbText text="查验" />
          <TargetMedal seat={entry.targetSeat} />
          <ReportTag
            text={entry.result}
            tone={entry.result === '狼人' ? 'bad' : entry.result === '好人' ? 'good' : 'info'}
          />
        </ActionRow>
      );
      break;
    case 'learn':
      rows = (
        <ActionRow>
          <VerbText text="学习" />
          <TargetMedal seat={entry.targetSeat} />
          <AnnotationText text={`（${getRoleDisplayName(entry.learnedRoleId)}）`} />
        </ActionRow>
      );
      break;
    case 'shootStatus':
      tag = (
        <ReportTag
          text={entry.canShoot ? '可发动技能' : '不能发动技能'}
          tone={entry.canShoot ? 'good' : 'muted'}
        />
      );
      break;
    case 'infectConverted':
      rows = (
        <ActionRow>
          <VerbText text="感染" />
          <TargetMedal seat={entry.targetSeat} />
          <ReportTag text="成功" tone="good" />
        </ActionRow>
      );
      break;
    case 'infectFailed':
      rows = (
        <ActionRow>
          <VerbText text="感染" />
          <TargetMedal seat={entry.targetSeat} />
          <ReportTag text="失败" tone="bad" />
        </ActionRow>
      );
      break;
    default:
      throw new Error(`[FAIL-FAST] Night review actor card received unhandled kind ${entry.kind}`);
  }

  return (
    <View style={styles.card}>
      <CardHead actorSeat={actorSeat} actorRoleId={actorRoleId} tag={tag} />
      {rows}
    </View>
  );
}

/** The witch / poisoner card: one card per potion owner, idle facts as sub-lines. */
function PotionCard({
  actor,
  entries,
  context,
}: {
  readonly actor: PotionActor;
  readonly entries: readonly NightReviewActionEntry[];
  readonly context: CardContext;
}) {
  const first = entries[0];
  if (first === undefined || !('actorSeat' in first)) {
    throw new Error('[FAIL-FAST] Night review potion card has no headed entry');
  }
  const subs: string[] = [];
  const rows: ReactNode[] = [];
  for (const entry of entries) {
    switch (entry.kind) {
      case 'save':
        rows.push(
          <ActionRow key="save">
            <VerbText text="使用解药救了" />
            <TargetMedal seat={entry.targetSeat} />
          </ActionRow>,
        );
        break;
      case 'poison':
        rows.push(
          <ActionRow key="poison">
            <VerbText text="毒杀" />
            <TargetMedal seat={entry.targetSeat} />
            {context.deadSeats.has(entry.targetSeat) && <ReportTag text="出局" tone="bad" />}
          </ActionRow>,
        );
        break;
      case 'witchNoSave':
        subs.push('解药未使用');
        break;
      case 'witchNoPoison':
        subs.push('毒药未使用');
        break;
      default:
        break;
    }
  }
  if (actor === 'witch' && context.wolfTargetSaveNote !== null) {
    subs.push('狼刀目标未救');
  }
  return (
    <View style={styles.card}>
      <CardHead actorSeat={first.actorSeat} actorRoleId={actor} />
      {rows}
      {subs.length > 0 && <Text style={styles.subLine}>{subs.join(' · ')}</Text>}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wolf team card
// ─────────────────────────────────────────────────────────────────────────────

interface WolfVoteGroup {
  readonly targetSeat: number;
  readonly voterSeats: readonly number[];
}

/** Aggregate votes by target: most votes first, ties by target seat ascending. */
function groupWolfVotes(
  votes: readonly { readonly voterSeat: number; readonly targetSeat: number }[],
): WolfVoteGroup[] {
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

function verdictText(verdict: NightReviewWolfVerdict): string {
  switch (verdict.type) {
    case 'sharedTarget':
      return NIGHT_REPORT_WOLF_VERDICT_SHARED;
    case 'splitKilled':
      return NIGHT_REPORT_WOLF_VERDICT_SPLIT_KILLED;
    case 'splitTied':
      return NIGHT_REPORT_WOLF_VERDICT_SPLIT_TIED;
    case 'allAbstain':
      return NIGHT_REPORT_WOLF_VERDICT_ALL_ABSTAIN;
  }
}

function WolfTeamCard({
  entry,
  context,
}: {
  readonly entry: NightReviewActionEntry;
  readonly context: CardContext;
}) {
  let tag: ReactNode;
  let body: ReactNode;
  if (entry.kind === 'wolfAttack') {
    const verdict = deriveWolfVerdict(entry);
    const resolvedTarget =
      verdict.type === 'sharedTarget' || verdict.type === 'splitKilled'
        ? verdict.targetSeat
        : undefined;
    tag = (
      <ReportTag
        text={
          verdict.type === 'splitTied'
            ? NIGHT_REPORT_WOLF_TAG_TIED
            : verdict.type === 'allAbstain'
              ? NIGHT_REPORT_WOLF_TAG_ABSTAIN
              : resolvedTarget !== undefined && context.deadSeats.has(resolvedTarget)
                ? NIGHT_REPORT_WOLF_TAG_KILLED
                : NIGHT_REPORT_WOLF_TAG_SURVIVED
        }
        tone={verdict.type === 'sharedTarget' || verdict.type === 'splitKilled' ? 'bad' : 'muted'}
      />
    );
    body = (
      <>
        {groupWolfVotes(entry.votes).map((group) => (
          <View key={group.targetSeat} style={styles.voteRow}>
            <View style={styles.voteVoters}>
              {group.voterSeats.map((seat) => (
                <SeatMedal key={seat} seat={seat} size="small" />
              ))}
            </View>
            <Text style={styles.voteArrow}>→</Text>
            <SeatMedal
              seat={group.targetSeat}
              size="small"
              filled={group.targetSeat === resolvedTarget}
            />
          </View>
        ))}
        {entry.abstainSeats.length > 0 && (
          <View style={styles.voteRow}>
            <View style={styles.voteVoters}>
              {entry.abstainSeats.map((seat) => (
                <SeatMedal key={seat} seat={seat} size="small" />
              ))}
            </View>
            <Text style={styles.voteArrow}>→</Text>
            <Text style={styles.abstainText}>空刀</Text>
          </View>
        )}
        <Text style={styles.verdictLine}>{verdictText(verdict)}</Text>
      </>
    );
  } else if (entry.kind === 'wolfNoTarget') {
    tag = <ReportTag text={NIGHT_REPORT_WOLF_TAG_ABSTAIN} tone="muted" />;
    body = <Text style={styles.subLine}>未选择目标</Text>;
  } else if (entry.kind === 'wolfGiveUp') {
    tag = <ReportTag text="放弃袭击" tone="muted" />;
    body = (
      <Text style={styles.subLine}>
        {entry.reason === 'poisonerPresent'
          ? '毒师在场'
          : `被${getRoleDisplayName('nightmare')}封锁`}
      </Text>
    );
  } else {
    throw new Error(`[FAIL-FAST] Night review wolf card received unhandled kind ${entry.kind}`);
  }
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <SeatMedal seat={0} size="medium" tone="wolf" glyph="狼" />
        <Text style={styles.cardRole}>狼队</Text>
        <View style={styles.cardTag}>{tag}</View>
      </View>
      {body}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup & warning cards
// ─────────────────────────────────────────────────────────────────────────────

function SetupCard({ entry }: { readonly entry: NightReviewActionEntry }) {
  if (entry.kind !== 'bottomCards') {
    throw new Error(`[FAIL-FAST] Night review setup card received unhandled kind ${entry.kind}`);
  }
  return (
    <View style={styles.card}>
      <Text style={styles.cardRole}>底牌组成</Text>
      <View style={styles.actionRow}>
        {entry.roleIds.map((roleId, index) => (
          <Text key={`${roleId}-${index}`} style={styles.chosenRole}>
            {getRoleDisplayName(roleId)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function WarningCard({ entry }: { readonly entry: NightReviewActionEntry }) {
  switch (entry.kind) {
    case 'guardSaveConflict':
      return (
        <View style={styles.card}>
          <Text style={styles.cardRole}>⚠ 同守同救</Text>
          <ActionRow>
            <TargetMedal seat={entry.targetSeat} />
            <AnnotationText text="仍然死亡" />
          </ActionRow>
        </View>
      );
    case 'poisonImmune':
      return (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <TargetMedal seat={entry.targetSeat} />
            <Text style={styles.cardRole}>{getRoleDisplayName(entry.targetRoleId)}</Text>
            <View style={styles.cardTag}>
              <ReportTag text="免疫毒药" tone="info" />
            </View>
          </View>
        </View>
      );
    case 'reflectDamage':
      return (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardRole}>{`${getRoleDisplayName(entry.checkerRoleId)}查验`}</Text>
            <View style={styles.cardTag}>
              <ReportTag text="反伤" tone="bad" />
            </View>
          </View>
          <ActionRow>
            <TargetMedal seat={entry.targetSeat} />
            <AnnotationText text={`（${getRoleDisplayName(entry.targetRoleId)}）`} />
          </ActionRow>
        </View>
      );
    default:
      throw new Error(
        `[FAIL-FAST] Night review warning card received unhandled kind ${entry.kind}`,
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Did-not-act strip
// ─────────────────────────────────────────────────────────────────────────────

/** Idle / confirmation phrase per strip entry kind (subject is the medal text). */
function stripPhrase(entry: NightReviewActionEntry): string {
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
      throw new Error(`[FAIL-FAST] Night review strip received unhandled kind ${entry.kind}`);
  }
}

function IdleStrip({ entries }: { readonly entries: readonly NightReviewActionEntry[] }) {
  return (
    <View style={styles.idleStrip}>
      <Text style={styles.idleText}>
        {entries.map((entry, index) => {
          const roleId = nightReviewActorRoleId(entry);
          if (roleId === null || !('actorSeat' in entry)) {
            throw new Error(`[FAIL-FAST] Night review strip entry ${entry.kind} has no actor`);
          }
          return (
            <Text key={`${entry.kind}-${entry.actorSeat}`}>
              {index > 0 && <Text style={styles.idleText}> · </Text>}
              <Text style={styles.idleStrong}>
                {`${getRoleDisplayName(roleId)} ${formatSeat(entry.actorSeat)}`}
              </Text>
              {` ${stripPhrase(entry)}`}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheriff election card
// ─────────────────────────────────────────────────────────────────────────────

function SheriffRoundBlock({ round }: { readonly round: NightReviewSheriffRound }) {
  return (
    <View style={styles.roundBlock}>
      <Text style={styles.roundLabel}>
        {`${NIGHT_REPORT_SHERIFF_ROUND_LABELS[round.round]}${NIGHT_REPORT_SHERIFF_VOTE_ROUND_SUFFIX}`}
      </Text>
      {[...round.perCandidate]
        .sort((a, b) => b.votes - a.votes || a.seat - b.seat)
        .map((candidate) => (
          <View key={candidate.seat} style={styles.voteRow}>
            <SeatMedal seat={candidate.seat} size="small" filled />
            <Text style={styles.voteCount}>{`${candidate.votes} 票`}</Text>
            <Text style={styles.voteArrow}>←</Text>
            <View style={styles.voteVoters}>
              {candidate.voterSeats.map((seat) => (
                <SeatMedal key={seat} seat={seat} size="small" />
              ))}
            </View>
          </View>
        ))}
      {round.abstainingSeats.length > 0 && (
        <View style={styles.voteRow}>
          <Text style={styles.abstainText}>{NIGHT_REPORT_SHERIFF_ABSTAIN_LABEL}</Text>
          <View style={styles.voteVoters}>
            {round.abstainingSeats.map((seat) => (
              <SeatMedal key={seat} seat={seat} size="small" />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function CandidateMedals({
  seats,
  withdrawnSeats,
}: {
  readonly seats: readonly number[];
  readonly withdrawnSeats: readonly number[];
}) {
  const withdrawn = new Set(withdrawnSeats);
  return (
    <View style={styles.voteRow}>
      <View style={styles.voteVoters}>
        {seats.map((seat) => (
          <SeatMedal key={seat} seat={seat} size="small" dimmed={withdrawn.has(seat)} />
        ))}
      </View>
      {withdrawnSeats.length > 0 && (
        <ReportTag text={NIGHT_REPORT_SHERIFF_WITHDRAWN_LABEL} tone="muted" />
      )}
    </View>
  );
}

function SheriffCard({ section }: { readonly section: NightReviewSheriffSection }) {
  if (section.kind === 'registration') {
    // Registration secrecy: status only — no seats, no counts, for anyone.
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardRole}>{NIGHT_REPORT_SHERIFF_TITLE}</Text>
          <View style={styles.cardTag}>
            <ReportTag text={NIGHT_REPORT_SHERIFF_REGISTRATION_STATUS} tone="muted" />
          </View>
        </View>
      </View>
    );
  }

  if (section.kind === 'inProgress') {
    const status =
      section.activeRound !== null
        ? NIGHT_REPORT_SHERIFF_VOTING
        : section.closedRounds.length > 0
          ? NIGHT_REPORT_SHERIFF_RUNOFF_IN_PROGRESS
          : NIGHT_REPORT_SHERIFF_IN_PROGRESS;
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardRole}>{NIGHT_REPORT_SHERIFF_TITLE}</Text>
          <View style={styles.cardTag}>
            <ReportTag text={status} tone="muted" />
          </View>
        </View>
        {section.activeRound === null && section.candidateSeats.length > 0 && (
          <>
            <Text style={styles.roundLabel}>
              {section.closedRounds.length > 0
                ? NIGHT_REPORT_SHERIFF_RUNOFF_CANDIDATES_LABEL
                : NIGHT_REPORT_SHERIFF_CANDIDATES_LABEL}
            </Text>
            <CandidateMedals
              seats={[...section.candidateSeats, ...section.withdrawnSeats]}
              withdrawnSeats={section.withdrawnSeats}
            />
          </>
        )}
        {section.closedRounds.map((round) => (
          <SheriffRoundBlock key={round.round} round={round} />
        ))}
        {section.activeRound !== null && (
          <>
            <Text style={styles.roundLabel}>
              {`${NIGHT_REPORT_SHERIFF_ROUND_LABELS[section.activeRound.round]}${NIGHT_REPORT_SHERIFF_VOTE_ROUND_SUFFIX}中`}
            </Text>
            <CandidateMedals seats={section.activeRound.candidateSeats} withdrawnSeats={[]} />
          </>
        )}
      </View>
    );
  }

  // Completed: the full public record.
  const decidingRound = section.rounds[section.rounds.length - 1];
  const sheriffSeat = section.result.kind === 'elected' ? section.result.sheriffSeat : null;
  const winner =
    sheriffSeat === null
      ? undefined
      : decidingRound?.perCandidate.find((candidate) => candidate.seat === sheriffSeat);
  const winnerTotal =
    decidingRound !== undefined
      ? decidingRound.perCandidate.reduce((sum, candidate) => sum + candidate.votes, 0) +
        decidingRound.abstainingSeats.length
      : 0;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        {section.result.kind === 'elected' ? (
          <>
            <SeatMedal seat={section.result.sheriffSeat} size="medium" tone="good" />
            <Text style={styles.cardRole}>{NIGHT_REPORT_SHERIFF_ELECTED_TITLE}</Text>
            {winner !== undefined && (
              <View style={styles.cardTag}>
                <ReportTag
                  text={formatNightReportSheriffVotesTag(winner.votes, winnerTotal)}
                  tone="good"
                />
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.cardRole}>{NIGHT_REPORT_SHERIFF_NONE_TITLE}</Text>
            <View style={styles.cardTag}>
              <ReportTag
                text={NIGHT_REPORT_SHERIFF_REASON_LABELS[section.result.reason]}
                tone="muted"
              />
            </View>
          </>
        )}
      </View>
      {section.registeredSeats.length > 0 && (
        <>
          <Text style={styles.roundLabel}>{NIGHT_REPORT_SHERIFF_CANDIDATES_LABEL}</Text>
          <CandidateMedals
            seats={section.registeredSeats}
            withdrawnSeats={section.withdrawnSeats}
          />
        </>
      )}
      {section.rounds.map((round) => (
        <SheriffRoundBlock key={round.round} round={round} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity wall
// ─────────────────────────────────────────────────────────────────────────────

function RosterWall({ data }: { readonly data: NightReviewData }) {
  const outcome = getNightReviewOutcome(data);
  const reasonBySeat = new Map<number, keyof typeof DEATH_REASON_LABELS | null>(
    outcome.type === 'deaths' ? outcome.deaths.map((death) => [death.seat, death.reason]) : [],
  );
  return (
    <View style={styles.roster}>
      {data.identities.map((entry) => {
        const reason = reasonBySeat.get(entry.seat);
        return (
          <View key={entry.seat} style={styles.rosterCell}>
            <SeatMedal
              seat={entry.seat}
              size="roster"
              tone={entry.isAlive ? 'neutral' : 'rosterOut'}
            />
            <Text style={[styles.rosterName, entry.isAlive ? null : styles.rosterNameOut]}>
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

export function NightReviewReportBody({ data }: { readonly data: NightReviewData }) {
  const { blocks, strip } = partitionEntries(data.actions);
  const context: CardContext = useMemo(
    () => ({
      deadSeats: new Set(
        data.identities.filter((entry) => !entry.isAlive).map((entry) => entry.seat),
      ),
      wolfTargetSaveNote: deriveWolfTargetSaveNote(data),
    }),
    [data],
  );

  return (
    <View style={styles.root}>
      <ReportHeader data={data} />
      <SectionTitle text={NIGHT_REPORT_ACTIONS_TITLE} />
      <View style={styles.cardList}>
        {blocks.map((block, index) => {
          if (block.type === 'potion') {
            return (
              <PotionCard
                key={`potion-${block.actor}`}
                actor={block.actor}
                entries={block.entries}
                context={context}
              />
            );
          }
          const { entry } = block;
          if (
            entry.kind === 'wolfAttack' ||
            entry.kind === 'wolfNoTarget' ||
            entry.kind === 'wolfGiveUp'
          ) {
            return <WolfTeamCard key={`${entry.kind}-${index}`} entry={entry} context={context} />;
          }
          if (entry.kind === 'bottomCards') {
            return <SetupCard key={`bottomCards-${index}`} entry={entry} />;
          }
          if (
            entry.kind === 'guardSaveConflict' ||
            entry.kind === 'poisonImmune' ||
            entry.kind === 'reflectDamage'
          ) {
            return <WarningCard key={`${entry.kind}-${index}`} entry={entry} />;
          }
          return <ActorCard key={`${entry.kind}-${index}`} entry={entry} />;
        })}
      </View>
      {strip.length > 0 && (
        <>
          <SectionTitle text={NIGHT_REPORT_IDLE_TITLE} />
          <IdleStrip entries={strip} />
        </>
      )}
      {data.sheriff !== undefined && (
        <>
          <SectionTitle text={NIGHT_REPORT_SHERIFF_TITLE} />
          <SheriffCard section={data.sheriff} />
        </>
      )}
      <SectionTitle text={NIGHT_REVIEW_IDENTITIES_TITLE} />
      <RosterWall data={data} />
      <Text style={styles.footer}>{NIGHT_REPORT_FOOTER_TEXT}</Text>
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
    padding: spacing.large,
    gap: spacing.medium,
  },
  header: {
    gap: spacing.small,
  },
  kicker: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: P.textSecondary,
  },
  headline: {
    fontSize: typography.hero,
    lineHeight: typography.lineHeights.hero,
    fontWeight: typography.weights.bold,
    color: P.text,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  statChip: {
    backgroundColor: P.card,
    borderWidth: fixed.borderWidth,
    borderColor: P.cardBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
  },
  statChipText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
    color: P.textSecondary,
  },
  statChipCount: {
    color: P.text,
    fontWeight: typography.weights.bold,
  },
  deathList: {
    gap: spacing.small,
  },
  deathCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    backgroundColor: P.card,
    borderWidth: fixed.borderWidth,
    borderColor: P.cardBorder,
    borderLeftWidth: fixed.borderWidthHighlight,
    borderLeftColor: P.danger,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
  },
  deathRole: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
    color: P.text,
  },
  deathWhy: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
  },
  deathCause: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: P.danger,
  },
  deathByline: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    color: P.textMuted,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  sectionTitle: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: P.textSecondary,
  },
  sectionDivider: {
    flex: 1,
    height: fixed.divider,
    backgroundColor: P.divider,
  },
  cardList: {
    gap: spacing.small,
  },
  card: {
    backgroundColor: P.card,
    borderWidth: fixed.borderWidth,
    borderColor: P.cardBorder,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    gap: spacing.small,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  cardRole: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
    color: P.text,
  },
  cardTag: {
    marginLeft: 'auto',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  verb: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
    color: P.text,
  },
  annotation: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: P.textSecondary,
  },
  chosenRole: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: P.text,
  },
  subLine: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: P.textSecondary,
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
  medalDimmed: {
    opacity: fixed.disabledOpacity,
  },
  tag: {
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
  },
  tagText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
  },
  voteVoters: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  voteArrow: {
    fontSize: typography.caption,
    color: P.textMuted,
  },
  voteCount: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: P.text,
  },
  abstainText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
    color: P.textSecondary,
  },
  verdictLine: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: P.medalWolf.text,
    borderTopWidth: fixed.divider,
    borderTopColor: P.divider,
    paddingTop: spacing.small,
    marginTop: spacing.tight,
  },
  roundBlock: {
    gap: spacing.tight,
  },
  roundLabel: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
    color: P.textSecondary,
  },
  idleStrip: {
    backgroundColor: P.idleBg,
    borderWidth: fixed.borderWidth,
    borderColor: P.idleBorder,
    borderStyle: 'dashed',
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
  },
  idleText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.secondary,
    color: P.idleText,
  },
  idleStrong: {
    color: P.idleStrong,
    fontWeight: typography.weights.semibold,
  },
  roster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rosterCell: {
    width: '25%',
    alignItems: 'center',
    gap: spacing.tight,
    paddingVertical: spacing.small,
  },
  rosterName: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
    color: P.text,
  },
  rosterNameOut: {
    color: P.textMuted,
  },
  rosterStatus: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
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
