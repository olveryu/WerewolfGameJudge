/**
 * NightReviewReportBody - The one presentation body for the night review report.
 *
 * 2026 "verdict ticket" presentation (identical on every surface): a white
 * page in five sections — conclusion header (accent bar, masthead,
 * headline with the death count as the display numeral, one stamp per
 * death, stats ledger) → key actions grouped by the actor's faction (one
 * row per actor, idle actors as dimmed rows in their group; the wolf team
 * shares one row plus a verdict band) → sheriff election group (when an
 * election exists) → perforation → identity roster (two columns) → footer.
 *
 * Number discipline: a seat number appears exactly once per mention, on
 * its SeatMedal. Text next to a medal never repeats the number; role names
 * appear as row subjects and identity statements (death stamps, roster),
 * plus payload annotations where the role itself is the information (a
 * learned identity, an immune target's role, a blocked target's role).
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
  type NightReviewWolfVerdict,
} from '../NightReview.helpers';
import {
  NIGHT_REPORT_ACTIONS_TITLE,
  NIGHT_REPORT_DEATH_CAUSE_SUFFIX,
  NIGHT_REPORT_FOOTER_TEXT,
  NIGHT_REPORT_HEADLINE_PREFIX,
  NIGHT_REPORT_HEADLINE_SUFFIX,
  NIGHT_REPORT_IDLE_TAG,
  NIGHT_REPORT_KICKER,
  NIGHT_REPORT_MEDAL_SIZES,
  NIGHT_REPORT_PALETTE,
  NIGHT_REPORT_ROSTER_ALIVE,
  NIGHT_REPORT_ROSTER_OUT,
  NIGHT_REPORT_SHERIFF_TITLE,
  NIGHT_REPORT_STAT_LABELS,
  NIGHT_REPORT_WOLF_TAG_ABSTAIN,
  NIGHT_REPORT_WOLF_TAG_KILLED,
  NIGHT_REPORT_WOLF_TAG_SURVIVED,
  NIGHT_REPORT_WOLF_TAG_TIE_PENDING,
  NIGHT_REPORT_WOLF_TAG_TIED,
  NIGHT_REPORT_WOLF_VERDICT_ALL_ABSTAIN,
  NIGHT_REPORT_WOLF_VERDICT_SHARED,
  NIGHT_REPORT_WOLF_VERDICT_SPLIT_KILLED,
  NIGHT_REPORT_WOLF_VERDICT_SPLIT_TIED,
  NIGHT_REPORT_WOLF_VERDICT_TIE_PENDING,
  NIGHT_REPORT_WOLF_VERDICT_TIE_PICKED,
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
  medium: typography.secondary,
  small: typography.caption,
  roster: typography.caption,
};

/** Filled medal variants: the wolf team's resolved target / a death stamp. */
type MedalFill = 'hit' | 'stamp';

const MEDAL_FILLS: Record<MedalFill, { readonly bg: string; readonly text: string }> = {
  hit: { bg: P.hitMedalBg, text: P.hitMedalText },
  stamp: P.stampMedal,
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
  /** Filled emphasis variant. */
  readonly fill?: MedalFill;
  /** Dimmed (out of the game / withdrawn). */
  readonly dimmed?: boolean;
  /** Glyph instead of a seat number (the wolf team medal). */
  readonly glyph?: string;
}

/**
 * The one carrier of a seat number in the report. Every seat mention is a
 * medal; surrounding text never repeats the number.
 */
function SeatMedal({ seat, size, tone = 'neutral', fill, dimmed, glyph }: SeatMedalProps) {
  const slot = MEDAL_SLOTS[tone];
  const filled = fill === undefined ? undefined : MEDAL_FILLS[fill];
  const diameter = NIGHT_REPORT_MEDAL_SIZES[size];
  return (
    <View
      style={[
        styles.medal,
        {
          width: diameter,
          height: diameter,
          backgroundColor: filled?.bg ?? slot.bg,
          borderColor: filled?.bg ?? slot.border,
        },
        dimmed ? styles.medalDimmed : null,
      ]}
    >
      <Text
        style={[
          styles.medalText,
          {
            fontSize: MEDAL_TEXT_SIZES[size],
            color: filled?.text ?? slot.text,
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

interface GroupRowProps {
  /** Subject medal (actor seat); absent for setup / warning subjects. */
  readonly medal?: ReactNode;
  readonly subject: string;
  readonly tag?: ReactNode;
  /** Dimmed row (actor did not act). */
  readonly dimmed?: boolean;
  readonly children?: ReactNode;
}

/** One row of a faction group: subject column · action column · right tag. */
function GroupRow({ medal, subject, tag, dimmed, children }: GroupRowProps) {
  return (
    <View style={[styles.row, dimmed ? styles.rowDimmed : null]}>
      <View style={styles.rowWho}>
        {medal}
        <Text style={styles.rowSubject}>{subject}</Text>
      </View>
      {children !== undefined && <View style={styles.rowWhat}>{children}</View>}
      {tag !== undefined && <View style={styles.rowTag}>{tag}</View>}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Conclusion header: accent bar, masthead, headline, death stamps, ledger
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
      <SeatMedal seat={seat} size="large" fill="stamp" />
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

/**
 * Four-column stats ledger. Each cell is one Text (numeral + line break +
 * label) so a zero count never surfaces as a bare 「0」 text node.
 */
function StatsLedger({ stats }: { readonly stats: NightReportStats }) {
  const cells: readonly { readonly label: string; readonly count: number }[] = [
    { label: NIGHT_REPORT_STAT_LABELS.wolfKill, count: stats.wolfKills },
    { label: NIGHT_REPORT_STAT_LABELS.poison, count: stats.poisonKills },
    { label: NIGHT_REPORT_STAT_LABELS.save, count: stats.saves },
    { label: NIGHT_REPORT_STAT_LABELS.check, count: stats.checks },
  ];
  return (
    <View style={styles.ledger}>
      {cells.map((cell, index) => (
        <View
          key={cell.label}
          style={[styles.ledgerCell, index > 0 ? styles.ledgerCellDivided : null]}
        >
          <Text style={styles.ledgerLabel}>
            <Text style={[styles.ledgerValue, cell.count === 0 ? styles.ledgerValueZero : null]}>
              {cell.count}
            </Text>
            {`\n${cell.label}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ReportHeader({
  data,
  shareTitle,
}: {
  readonly data: NightReviewData;
  readonly shareTitle: string | undefined;
}) {
  const outcome = getNightReviewOutcome(data);
  const stats = deriveNightReportStats(data);
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
      <StatsLedger stats={stats} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action grouping: faction groups of rows
// ─────────────────────────────────────────────────────────────────────────────

/** Kinds that render as a dimmed did-not-act row when they stand alone. */
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
    }
  | { readonly type: 'idle'; readonly entry: NightReviewActionEntry };

type ReportGroupKey = keyof typeof P.rail;

/** Group order on the page: the kill first, then gods, villagers, third, notes. */
const GROUP_ORDER: readonly ReportGroupKey[] = ['wolf', 'god', 'villager', 'third', 'neutral'];

interface ReportGroup {
  readonly key: ReportGroupKey;
  readonly blocks: readonly ReportBlock[];
}

function groupKeyForRole(roleId: RoleId | null): ReportGroupKey {
  if (roleId === null) return 'neutral';
  switch (ROLE_SPECS[roleId]?.faction) {
    case Faction.Wolf:
      return 'wolf';
    case Faction.God:
      return 'god';
    case Faction.Villager:
      return 'villager';
    case Faction.Special:
      return 'third';
    default:
      return 'neutral';
  }
}

function isWolfTeamKind(kind: NightReviewActionEntry['kind']): boolean {
  return kind === 'wolfAttack' || kind === 'wolfNoTarget' || kind === 'wolfGiveUp';
}

function blockGroupKey(block: ReportBlock): ReportGroupKey {
  if (block.type === 'potion') return groupKeyForRole(block.actor);
  if (isWolfTeamKind(block.entry.kind)) return 'wolf';
  return groupKeyForRole(nightReviewActorRoleId(block.entry));
}

/**
 * Turn the entries into faction groups of blocks, keeping each group's
 * blocks in night order. The potion family merges into a single block per
 * owner when the owner used a potion; a family that did nothing at all
 * dissolves into idle rows.
 */
function groupEntries(actions: readonly NightReviewActionEntry[]): readonly ReportGroup[] {
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
        blocks.push({ type: 'idle', entry });
      }
      continue;
    }
    blocks.push(IDLE_KINDS.has(entry.kind) ? { type: 'idle', entry } : { type: 'card', entry });
  }

  const byKey = new Map<ReportGroupKey, ReportBlock[]>();
  for (const block of blocks) {
    const key = blockGroupKey(block);
    const list = byKey.get(key);
    if (list) list.push(block);
    else byKey.set(key, [block]);
  }
  return GROUP_ORDER.flatMap((key) => {
    const list = byKey.get(key);
    return list === undefined ? [] : [{ key, blocks: list }];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Action rows
// ─────────────────────────────────────────────────────────────────────────────

interface CardContext {
  readonly deadSeats: ReadonlySet<number>;
  /** The wolf target the witch left unsaved (witch row annotation). */
  readonly wolfTargetSaveNote: { readonly wolfTargetSeat: number } | null;
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

function ActorMedal({ seat, roleId }: { readonly seat: number; readonly roleId: RoleId }) {
  return <SeatMedal seat={seat} size="medium" tone={medalToneForRole(roleId)} />;
}

/** One actor's row: subject (medal + role) plus its action content. */
function ActorRow({ entry }: { readonly entry: NightReviewActionEntry }) {
  const actorRoleId = nightReviewActorRoleId(entry);
  if (actorRoleId === null || !('actorSeat' in entry)) {
    throw new Error(`[FAIL-FAST] Night review actor row cannot head entry kind ${entry.kind}`);
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
      throw new Error(`[FAIL-FAST] Night review actor row received unhandled kind ${entry.kind}`);
  }

  return (
    <GroupRow
      medal={<ActorMedal seat={actorSeat} roleId={actorRoleId} />}
      subject={getRoleDisplayName(actorRoleId)}
      tag={tag}
    >
      {rows}
    </GroupRow>
  );
}

/** The witch / poisoner row: one row per potion owner, idle facts as a sub-line. */
function PotionRow({
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
    throw new Error('[FAIL-FAST] Night review potion row has no headed entry');
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
    <GroupRow
      medal={<ActorMedal seat={first.actorSeat} roleId={actor} />}
      subject={getRoleDisplayName(actor)}
    >
      {rows}
      {subs.length > 0 && <Text style={styles.subLine}>{subs.join(' · ')}</Text>}
    </GroupRow>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wolf team row
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
    case 'tiePicked':
      return NIGHT_REPORT_WOLF_VERDICT_TIE_PICKED;
    case 'splitTied':
      return NIGHT_REPORT_WOLF_VERDICT_SPLIT_TIED;
    case 'tiePending':
      return NIGHT_REPORT_WOLF_VERDICT_TIE_PENDING;
    case 'allAbstain':
      return NIGHT_REPORT_WOLF_VERDICT_ALL_ABSTAIN;
  }
}

/** The wolf team row plus, for a recorded attack, the verdict band under it. */
function WolfTeamRow({
  entry,
  context,
}: {
  readonly entry: NightReviewActionEntry;
  readonly context: CardContext;
}) {
  let tag: ReactNode;
  let body: ReactNode;
  let verdictLine: string | null = null;
  if (entry.kind === 'wolfAttack') {
    const verdict = deriveWolfVerdict(entry);
    verdictLine = verdictText(verdict);
    const resolvedTarget =
      verdict.type === 'sharedTarget' ||
      verdict.type === 'splitKilled' ||
      verdict.type === 'tiePicked'
        ? verdict.targetSeat
        : undefined;
    tag = (
      <ReportTag
        text={
          verdict.type === 'splitTied'
            ? NIGHT_REPORT_WOLF_TAG_TIED
            : verdict.type === 'tiePending'
              ? NIGHT_REPORT_WOLF_TAG_TIE_PENDING
              : verdict.type === 'allAbstain'
                ? NIGHT_REPORT_WOLF_TAG_ABSTAIN
                : resolvedTarget !== undefined && context.deadSeats.has(resolvedTarget)
                  ? NIGHT_REPORT_WOLF_TAG_KILLED
                  : NIGHT_REPORT_WOLF_TAG_SURVIVED
        }
        tone={
          verdict.type === 'sharedTarget' ||
          verdict.type === 'splitKilled' ||
          verdict.type === 'tiePicked'
            ? 'bad'
            : 'muted'
        }
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
              fill={group.targetSeat === resolvedTarget ? 'hit' : undefined}
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
    throw new Error(`[FAIL-FAST] Night review wolf row received unhandled kind ${entry.kind}`);
  }
  return (
    <>
      <GroupRow
        medal={<SeatMedal seat={0} size="medium" tone="wolf" glyph="狼" />}
        subject="狼队"
        tag={tag}
      >
        {body}
      </GroupRow>
      {verdictLine !== null && (
        <View style={styles.verdictBand}>
          <Text style={styles.verdictText}>{verdictLine}</Text>
        </View>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup & warning rows (the neutral group)
// ─────────────────────────────────────────────────────────────────────────────

function SetupRow({ entry }: { readonly entry: NightReviewActionEntry }) {
  if (entry.kind !== 'bottomCards') {
    throw new Error(`[FAIL-FAST] Night review setup row received unhandled kind ${entry.kind}`);
  }
  return (
    <GroupRow subject="底牌组成">
      <ActionRow>
        {entry.roleIds.map((roleId, index) => (
          <Text key={`${roleId}-${index}`} style={styles.chosenRole}>
            {getRoleDisplayName(roleId)}
          </Text>
        ))}
      </ActionRow>
    </GroupRow>
  );
}

function WarningRow({ entry }: { readonly entry: NightReviewActionEntry }) {
  switch (entry.kind) {
    case 'guardSaveConflict':
      return (
        <GroupRow subject="⚠ 同守同救">
          <ActionRow>
            <TargetMedal seat={entry.targetSeat} />
            <AnnotationText text="仍然死亡" />
          </ActionRow>
        </GroupRow>
      );
    case 'poisonImmune':
      return (
        <GroupRow
          medal={<ActorMedal seat={entry.targetSeat} roleId={entry.targetRoleId} />}
          subject={getRoleDisplayName(entry.targetRoleId)}
          tag={<ReportTag text="免疫毒药" tone="info" />}
        />
      );
    case 'reflectDamage':
      return (
        <GroupRow
          subject={`${getRoleDisplayName(entry.checkerRoleId)}查验`}
          tag={<ReportTag text="反伤" tone="bad" />}
        >
          <ActionRow>
            <TargetMedal seat={entry.targetSeat} />
            <AnnotationText text={`（${getRoleDisplayName(entry.targetRoleId)}）`} />
          </ActionRow>
        </GroupRow>
      );
    default:
      throw new Error(`[FAIL-FAST] Night review warning row received unhandled kind ${entry.kind}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Did-not-act rows
// ─────────────────────────────────────────────────────────────────────────────

/** Idle / confirmation phrase per idle entry kind (subject is the row medal). */
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

function IdleRow({ entry }: { readonly entry: NightReviewActionEntry }) {
  const roleId = nightReviewActorRoleId(entry);
  if (roleId === null || !('actorSeat' in entry)) {
    throw new Error(`[FAIL-FAST] Night review idle entry ${entry.kind} has no actor`);
  }
  return (
    <GroupRow
      medal={<ActorMedal seat={entry.actorSeat} roleId={roleId} />}
      subject={getRoleDisplayName(roleId)}
      tag={<ReportTag text={NIGHT_REPORT_IDLE_TAG} tone="muted" />}
      dimmed
    >
      <Text style={styles.subLine}>{idlePhrase(entry)}</Text>
    </GroupRow>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Faction group
// ─────────────────────────────────────────────────────────────────────────────

function renderBlock(block: ReportBlock, context: CardContext): ReactNode {
  if (block.type === 'potion') {
    return <PotionRow actor={block.actor} entries={block.entries} context={context} />;
  }
  if (block.type === 'idle') return <IdleRow entry={block.entry} />;
  const { entry } = block;
  if (isWolfTeamKind(entry.kind)) return <WolfTeamRow entry={entry} context={context} />;
  if (entry.kind === 'bottomCards') return <SetupRow entry={entry} />;
  if (
    entry.kind === 'guardSaveConflict' ||
    entry.kind === 'poisonImmune' ||
    entry.kind === 'reflectDamage'
  ) {
    return <WarningRow entry={entry} />;
  }
  return <ActorRow entry={entry} />;
}

function blockKey(block: ReportBlock, index: number): string {
  if (block.type === 'potion') return `potion-${block.actor}`;
  return `${block.type}-${block.entry.kind}-${index}`;
}

/** One faction's rows behind a colored rail; a hairline separates blocks. */
function ActionGroup({
  group,
  context,
}: {
  readonly group: ReportGroup;
  readonly context: CardContext;
}) {
  return (
    <View style={styles.group}>
      <View style={[styles.groupRail, { backgroundColor: P.rail[group.key] }]} />
      <View style={styles.groupInner}>
        {group.blocks.map((block, index) => (
          <View key={blockKey(block, index)} style={index > 0 ? styles.blockSeparator : null}>
            {renderBlock(block, context)}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity roster
// ─────────────────────────────────────────────────────────────────────────────

function RosterList({ data }: { readonly data: NightReviewData }) {
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
  readonly data: NightReviewData;
  /** Masthead title on the share image (room label); absent in the modal. */
  readonly shareTitle?: string;
}

export function NightReviewReportBody({ data, shareTitle }: NightReviewReportBodyProps) {
  const groups = groupEntries(data.actions);
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
      <ReportHeader data={data} shareTitle={shareTitle} />
      <View style={styles.page}>
        <SectionTitle text={NIGHT_REPORT_ACTIONS_TITLE} />
        <View style={styles.groupList}>
          {groups.map((group) => (
            <ActionGroup key={group.key} group={group} context={context} />
          ))}
        </View>
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
  ledger: {
    flexDirection: 'row',
    marginHorizontal: spacing.large,
    borderTopWidth: fixed.divider,
    borderBottomWidth: fixed.divider,
    borderColor: P.rule,
  },
  ledgerCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.small,
  },
  ledgerCellDivided: {
    borderLeftWidth: fixed.divider,
    borderLeftColor: P.divider,
  },
  ledgerLabel: {
    textAlign: 'center',
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: P.textSecondary,
  },
  ledgerValue: {
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
    color: P.text,
  },
  ledgerValueZero: {
    color: P.textFaint,
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
  // ── Faction groups ──
  groupList: {
    gap: spacing.small,
  },
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
  blockSeparator: {
    borderTopWidth: fixed.divider,
    borderTopColor: P.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingHorizontal: spacing.small + spacing.tight,
    paddingVertical: spacing.small + spacing.micro,
  },
  rowDimmed: {
    opacity: fixed.disabledOpacity,
  },
  rowWho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight + spacing.micro,
    flexShrink: 0,
  },
  rowSubject: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: P.text,
  },
  rowWhat: {
    flex: 1,
    minWidth: 0,
    gap: spacing.tight,
  },
  rowTag: {
    marginLeft: 'auto',
    flexShrink: 0,
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
  abstainText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
    color: P.textSecondary,
  },
  verdictBand: {
    backgroundColor: P.verdictBg,
    paddingHorizontal: spacing.small + spacing.tight,
    paddingVertical: spacing.small,
  },
  verdictText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: P.medalWolf.text,
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
