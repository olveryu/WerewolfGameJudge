/**
 * NightReviewReportBody - The one presentation body for the night review report.
 *
 * 2026 "verdict ticket" presentation (identical on every surface): a white
 * page — conclusion header (accent bar, masthead, headline with the death
 * count as the display numeral, one stamp per death, stats ledger) → day
 * tabs (one static tab; the review carries first-night facts only) → one
 * block card per night/day → sheriff election group (when an election
 * exists) → perforation → identity roster (two columns) → footer.
 *
 * The action area is pictorial, in night order (the engine's summary
 * order; no faction grouping): each action is one picture row, "portrait
 * + big arrow + verb + portrait", the identity written on the portrait's
 * role tag, the seat number below the portrait. What a portrait depicts
 * is exactly what its entry carries: a check that learned only a faction
 * shows a neutral numbered disc, never the target's true role art; an
 * identity check or a learn shows the result role's art. Slots holding
 * two or more portraits (multi-target groups, the vote diagram) carry no
 * tags — tags would collide. Resource owners (witch / poisoner) get one
 * card whose lines are the potions; the wolf team's votes draw as a small
 * diagram under the attack row with the verdict sentence below it; idle
 * actors and determinations render as a portrait plus a status sentence.
 *
 * Number discipline: a seat number appears exactly once per figure —
 * below its portrait, or inside its medal in the roster, the vote
 * diagram, and the death stamps. Text never repeats a number ("N号"
 * never appears). No service imports, no business logic: every fact
 * comes from the engine derivations, all shared copy/geometry from
 * nightReviewLayout, flat colors only (no gradients — the segmented
 * screenshot capture composites bands).
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
  deriveNightReportStats,
  deriveWolfTargetSaveNote,
  deriveWolfVerdict,
  getNightReviewOutcome,
  type NightReportStats,
  type NightReviewActionEntry,
  nightReviewActorRoleId,
  type NightReviewDeathNote,
  type NightReviewIdentityEntry,
  type NightReviewWolfVerdict,
  type WerewolfNightReview,
} from '@game-judge/game-engine/games/werewolf/public';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { getRoleAvatar } from '@/games/werewolf/assets/roleAvatars';
import { borderRadius, colors, fixed, spacing, typography } from '@/theme';

import { DEATH_REASON_LABELS, formatCheckResultLabel } from '../NightReview.helpers';
import {
  NIGHT_REPORT_DAY_BLOCK_TITLE,
  NIGHT_REPORT_DAY_EMPTY_TEXT,
  NIGHT_REPORT_DAY_TAB_LABEL,
  NIGHT_REPORT_DEATH_CAUSE_SUFFIX,
  NIGHT_REPORT_FOOTER_TEXT,
  NIGHT_REPORT_HEADLINE_PREFIX,
  NIGHT_REPORT_HEADLINE_SUFFIX,
  NIGHT_REPORT_KICKER,
  NIGHT_REPORT_MEDAL_SIZES,
  NIGHT_REPORT_NIGHT_BLOCK_TITLE,
  NIGHT_REPORT_PALETTE,
  NIGHT_REPORT_ROSTER_ALIVE,
  NIGHT_REPORT_ROSTER_OUT,
  NIGHT_REPORT_SHERIFF_TITLE,
  NIGHT_REPORT_STAT_LABELS,
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

/** Tone slots for figure tags and arrow verbs, from the palette tag slots. */
const TAG_SLOTS: Record<TagTone, { readonly bg: string; readonly text: string }> = {
  bad: P.tagBad,
  good: P.tagGood,
  info: P.tagInfo,
  muted: P.tagMuted,
};

/** Faction tone of a role's figure tag (wolf red / god violet / folk green). */
function figureTagToneForRole(roleId: RoleId): TagTone {
  switch (ROLE_SPECS[roleId]?.faction) {
    case Faction.Wolf:
      return 'bad';
    case Faction.God:
      return 'info';
    case Faction.Villager:
      return 'good';
    default:
      return 'muted';
  }
}

/** The role tag pill riding above a portrait. */
function FigureTag({ text, tone }: { readonly text: string; readonly tone: TagTone }) {
  const slot = TAG_SLOTS[tone];
  return (
    <View style={[styles.figureTag, { backgroundColor: slot.bg }]}>
      <Text style={[styles.figureTagText, { color: slot.text }]}>{text}</Text>
    </View>
  );
}

type PortraitFigureProps =
  | {
      /** Tag text above the portrait. */
      readonly tagText: string;
      readonly tagTone: TagTone;
      /** Role whose avatar is drawn. */
      readonly roleId: RoleId;
      /** Seat number below the portrait; absent for team / role-only figures. */
      readonly seat?: number;
      /** Dimmed portrait (seat out of the game). */
      readonly dimmed?: boolean;
      /** No tag pill (multi-portrait slots: tags would collide). */
      readonly hideTag?: boolean;
    }
  | {
      readonly tagText: string;
      readonly tagTone: TagTone;
      readonly roleId?: undefined;
      /** Seat number inside the neutral disc (a faction check's target). */
      readonly seat: number;
      readonly dimmed?: boolean;
      /** No tag pill (multi-portrait slots: tags would collide). */
      readonly hideTag?: boolean;
    };

/**
 * One portrait figure: tag pill above, circular portrait, seat number
 * below. The tag is absolutely positioned and centered, so it overflows
 * symmetrically instead of widening the figure; the portrait carries a
 * fixed top margin for the tag's room. A figure with no roleId draws the
 * neutral numbered disc instead of role art (a faction check's target:
 * the entry carries a faction word, not an identity).
 */
function PortraitFigure({ tagText, tagTone, roleId, seat, dimmed, hideTag }: PortraitFigureProps) {
  const tone = roleId === undefined ? 'neutral' : medalToneForRole(roleId);
  const slot = MEDAL_SLOTS[tone];
  return (
    <View style={[styles.figure, hideTag === true ? styles.figureBare : null]}>
      {hideTag !== true && <FigureTag text={tagText} tone={tagTone} />}
      {roleId === undefined ? (
        <SeatMedal seat={seat} size="medium" tone="neutral" />
      ) : (
        <Image
          source={getRoleAvatar(roleId)}
          style={[
            styles.portrait,
            { borderColor: slot.border },
            dimmed ? styles.portraitDimmed : null,
          ]}
          resizeMode="cover"
        />
      )}
      {seat !== undefined && roleId !== undefined && (
        <Text style={styles.figureSeat}>{seat + 1}</Text>
      )}
    </View>
  );
}

/** The "no object" figure: a muted disc carrying ✗ (an unused potion, no target). */
function CrossFigure() {
  return (
    <View style={styles.figure}>
      <View style={styles.crossDisc}>
        <Text style={styles.crossGlyph}>✗</Text>
      </View>
    </View>
  );
}

/** The middle of a picture row: a big arrow over the verb, both centered. */
function ArrowColumn({ verb, tone }: { readonly verb: string; readonly tone?: TagTone }) {
  const color = tone === undefined ? P.text : TAG_SLOTS[tone].text;
  return (
    <View style={styles.arrowColumn}>
      <Text style={[styles.arrowGlyph, { color }]}>→</Text>
      <Text style={[styles.arrowVerb, { color }]}>{verb}</Text>
    </View>
  );
}

/**
 * One picture row: actor figure · arrow column · target slot. The target
 * slot holds one figure or a wrapping group of figures (multi-target
 * actions render portraits + seat numbers with no tags, so tags cannot
 * collide). A note line under the row is the caller's, centered.
 */
function PictureRow({
  actor,
  verb,
  verbTone,
  children,
}: {
  readonly actor: ReactNode;
  readonly verb: string;
  readonly verbTone?: TagTone;
  readonly children: ReactNode;
}) {
  return (
    <View style={styles.pictureRow}>
      {actor}
      <ArrowColumn verb={verb} tone={verbTone} />
      {children}
    </View>
  );
}

/** Centered muted note line under a picture row (an outcome, a payload note). */
function RowNote({ text, tone }: { readonly text: string; readonly tone?: TagTone }) {
  return (
    <Text style={[styles.rowNote, tone !== undefined ? { color: TAG_SLOTS[tone].text } : null]}>
      {text}
    </Text>
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
  readonly data: WerewolfNightReview;
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

function isWolfTeamKind(kind: NightReviewActionEntry['kind']): boolean {
  return kind === 'wolfAttack' || kind === 'wolfNoTarget' || kind === 'wolfGiveUp';
}

/**
 * Turn the entries into blocks in night order (the engine's summary
 * order). The potion family merges into a single block per owner when
 * the owner used a potion; a family that did nothing at all dissolves
 * into idle rows. No faction grouping: the order on the page is the
 * order the night happened.
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

  return blocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action rows
// ─────────────────────────────────────────────────────────────────────────────

interface CardContext {
  readonly deadSeats: ReadonlySet<number>;
  /** The wolf target the witch left unsaved (witch row annotation). */
  readonly wolfTargetSaveNote: { readonly wolfTargetSeat: number } | null;
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

/** A seat's figure: its true role's portrait and tag, dimmed when out. */
function SeatFigure({
  seat,
  context,
  showTag,
}: {
  readonly seat: number;
  readonly context: CardContext;
  readonly showTag: boolean;
}) {
  const identity = identityForSeat(seat, context);
  const dimmed = context.deadSeats.has(seat);
  if (identity.roleId === null) {
    return (
      <PortraitFigure
        tagText={identityRoleText(identity)}
        tagTone="muted"
        seat={seat}
        hideTag={!showTag}
      />
    );
  }
  return (
    <PortraitFigure
      tagText={getRoleDisplayName(identity.roleId)}
      tagTone={figureTagToneForRole(identity.roleId)}
      roleId={identity.roleId}
      seat={seat}
      dimmed={dimmed}
      hideTag={!showTag}
    />
  );
}

/** An actor's figure: role tag, role portrait, seat number. */
function ActorFigure({
  roleId,
  seat,
  context,
}: {
  readonly roleId: RoleId;
  readonly seat: number;
  readonly context: CardContext;
}) {
  return (
    <PortraitFigure
      tagText={getRoleDisplayName(roleId)}
      tagTone={figureTagToneForRole(roleId)}
      roleId={roleId}
      seat={seat}
      dimmed={context.deadSeats.has(seat)}
    />
  );
}

/**
 * One directed action as a picture row: actor figure · arrow + verb ·
 * target figure(s). The switch is exhaustive over the directed kinds;
 * warning, setup, idle, and determination kinds render elsewhere. A
 * result-bearing kind (check / learn) shows the result on the target
 * figure's tag — never the target's true identity.
 */
function DirectedActionRow({
  entry,
  context,
}: {
  readonly entry: NightReviewActionEntry;
  readonly context: CardContext;
}) {
  const actorRoleId = nightReviewActorRoleId(entry);
  if (actorRoleId === null || !('actorSeat' in entry)) {
    throw new Error(`[FAIL-FAST] Night review actor row cannot head entry kind ${entry.kind}`);
  }
  const actor = <ActorFigure roleId={actorRoleId} seat={entry.actorSeat} context={context} />;

  switch (entry.kind) {
    case 'nightmareBlock': {
      const note =
        entry.targetRoleId !== null
          ? `（${getRoleDisplayName(entry.targetRoleId)}，技能无效）`
          : null;
      return (
        <View>
          <PictureRow actor={actor} verb="封锁">
            <SeatFigure seat={entry.targetSeat} context={context} showTag />
          </PictureRow>
          {note !== null && <RowNote text={note} />}
        </View>
      );
    }
    case 'shelter':
      return (
        <PictureRow actor={actor} verb="庇护">
          <SeatFigure seat={entry.targetSeat} context={context} showTag />
        </PictureRow>
      );
    case 'guard':
      return (
        <PictureRow actor={actor} verb="守护">
          <SeatFigure seat={entry.targetSeat} context={context} showTag />
        </PictureRow>
      );
    case 'silence':
      return (
        <PictureRow actor={actor} verb="禁言">
          <SeatFigure seat={entry.targetSeat} context={context} showTag />
        </PictureRow>
      );
    case 'voteban':
      return (
        <PictureRow actor={actor} verb="禁票">
          <SeatFigure seat={entry.targetSeat} context={context} showTag />
        </PictureRow>
      );
    case 'curse':
      return (
        <PictureRow actor={actor} verb="诅咒">
          <SeatFigure seat={entry.targetSeat} context={context} showTag />
        </PictureRow>
      );
    case 'dream':
      return (
        <PictureRow actor={actor} verb="摄梦">
          <SeatFigure seat={entry.targetSeat} context={context} showTag />
        </PictureRow>
      );
    case 'swap':
    case 'cupidLink': {
      const verb = entry.kind === 'swap' ? '交换' : '连线';
      return (
        <PictureRow actor={actor} verb={verb}>
          <View style={styles.figureGroup}>
            <SeatFigure seat={entry.seats[0]} context={context} showTag={false} />
            <Text style={styles.connector}>和</Text>
            <SeatFigure seat={entry.seats[1]} context={context} showTag={false} />
          </View>
        </PictureRow>
      );
    }
    case 'cardChoice':
      return (
        <PictureRow actor={actor} verb="选择了">
          <PortraitFigure
            tagText={getRoleDisplayName(entry.chosenRoleId)}
            tagTone={figureTagToneForRole(entry.chosenRoleId)}
            roleId={entry.chosenRoleId}
          />
        </PictureRow>
      );
    case 'idolChoice':
      return (
        <PictureRow actor={actor} verb="选择榜样">
          <SeatFigure seat={entry.targetSeat} context={context} showTag />
        </PictureRow>
      );
    case 'mimic':
      return (
        <View>
          <PictureRow actor={actor} verb="模仿">
            <SeatFigure seat={entry.targetSeat} context={context} showTag />
          </PictureRow>
          {entry.isBound && <RowNote text="绑定" tone="info" />}
        </View>
      );
    case 'charm':
      return (
        <PictureRow actor={actor} verb="魅惑">
          <SeatFigure seat={entry.targetSeat} context={context} showTag />
        </PictureRow>
      );
    case 'convert':
      return (
        <PictureRow actor={actor} verb="转化">
          <SeatFigure seat={entry.targetSeat} context={context} showTag />
        </PictureRow>
      );
    case 'wolfGirlConfess':
      return (
        <PictureRow actor={actor} verb="表白">
          <SeatFigure seat={entry.targetSeat} context={context} showTag />
        </PictureRow>
      );
    case 'hypnotize':
      return (
        <PictureRow actor={actor} verb="催眠">
          <View style={styles.figureGroup}>
            {entry.targetSeats.map((seat) => (
              <SeatFigure key={seat} seat={seat} context={context} showTag={false} />
            ))}
          </View>
        </PictureRow>
      );
    case 'check': {
      if (entry.resultFormat === 'factionCheck') {
        const resultLabel = formatCheckResultLabel(entry.result, entry.resultFormat);
        const tone = resultLabel === '狼人' ? 'bad' : resultLabel === '好人' ? 'good' : 'info';
        return (
          <PictureRow actor={actor} verb="查验" verbTone={tone}>
            <PortraitFigure tagText={resultLabel} tagTone={tone} seat={entry.targetSeat} />
          </PictureRow>
        );
      }
      const resultLabel = formatCheckResultLabel(entry.result, entry.resultFormat);
      if (!isValidRoleId(entry.result)) {
        throw new Error(`[FAIL-FAST] Reveal result ${entry.result} is not a role id`);
      }
      return (
        <PictureRow actor={actor} verb="查验" verbTone="info">
          <PortraitFigure
            tagText={resultLabel}
            tagTone="info"
            roleId={entry.result}
            seat={entry.targetSeat}
            dimmed={context.deadSeats.has(entry.targetSeat)}
          />
        </PictureRow>
      );
    }
    case 'learn':
      return (
        <PictureRow actor={actor} verb="学习" verbTone="info">
          <PortraitFigure
            tagText={getRoleDisplayName(entry.learnedRoleId)}
            tagTone="info"
            roleId={entry.learnedRoleId}
            seat={entry.targetSeat}
            dimmed={context.deadSeats.has(entry.targetSeat)}
          />
        </PictureRow>
      );
    case 'shootStatus':
      return (
        <DeterminationRow
          figure={<ActorFigure roleId={actorRoleId} seat={entry.actorSeat} context={context} />}
          sentence={entry.canShoot ? '可以发动' : '不能发动'}
          tone={entry.canShoot ? 'good' : 'muted'}
        />
      );
    case 'infectConverted':
      return (
        <View>
          <PictureRow actor={actor} verb="感染" verbTone="good">
            <SeatFigure seat={entry.targetSeat} context={context} showTag />
          </PictureRow>
          <RowNote text="成功" tone="good" />
        </View>
      );
    case 'infectFailed':
      return (
        <View>
          <PictureRow actor={actor} verb="感染" verbTone="bad">
            <SeatFigure seat={entry.targetSeat} context={context} showTag />
          </PictureRow>
          <RowNote text="失败" tone="bad" />
        </View>
      );
    default:
      throw new Error(`[FAIL-FAST] Night review actor row received unhandled kind ${entry.kind}`);
  }
}

/** The witch / poisoner row: one row per potion owner, idle facts as a sub-line. */
/** One potion owner's card: the owner figure on the left, one line per potion. */
function ResourceCard({
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
  const lines: ReactNode[] = [];
  for (const entry of entries) {
    switch (entry.kind) {
      case 'save':
        lines.push(
          <View key="save" style={styles.resourceLine}>
            <ArrowColumn verb="使用解药救了" tone="good" />
            <SeatFigure seat={entry.targetSeat} context={context} showTag />
          </View>,
        );
        break;
      case 'poison':
        lines.push(
          <View key="poison" style={styles.resourceLine}>
            <ArrowColumn verb="毒杀" tone="bad" />
            <SeatFigure seat={entry.targetSeat} context={context} showTag />
          </View>,
        );
        break;
      case 'witchNoSave':
        lines.push(
          <View key="witchNoSave" style={styles.resourceLine}>
            <ArrowColumn verb="解药" tone="muted" />
            <CrossFigure />
          </View>,
        );
        lines.push(<RowNote key="witchNoSave-note" text="未使用" />);
        break;
      case 'witchNoPoison':
        lines.push(
          <View key="witchNoPoison" style={styles.resourceLine}>
            <ArrowColumn verb="毒药" tone="muted" />
            <CrossFigure />
          </View>,
        );
        lines.push(<RowNote key="witchNoPoison-note" text="未使用" />);
        break;
      case 'poisonerNoPoison':
        lines.push(
          <View key="poisonerNoPoison" style={styles.resourceLine}>
            <ArrowColumn verb="毒药" tone="muted" />
            <CrossFigure />
          </View>,
        );
        lines.push(<RowNote key="poisonerNoPoison-note" text="未使用" />);
        break;
      case 'witchIdleAll':
        // Defensive only: the builder emits witchIdleAll solely when the
        // family used nothing, so groupEntries dissolves it into an idle
        // row and it never reaches this card. If it ever does, both
        // potions draw as unused rather than dropping the fact.
        lines.push(
          <View key="witchIdleAll-antidote" style={styles.resourceLine}>
            <ArrowColumn verb="解药" tone="muted" />
            <CrossFigure />
          </View>,
          <View key="witchIdleAll-poison" style={styles.resourceLine}>
            <ArrowColumn verb="毒药" tone="muted" />
            <CrossFigure />
          </View>,
        );
        lines.push(<RowNote key="witchIdleAll-note" text="未使用" />);
        break;
      default:
        break;
    }
  }
  const notes: ReactNode[] = [];
  if (actor === 'witch' && context.wolfTargetSaveNote !== null) {
    notes.push(<RowNote key="save-note" text="狼刀目标未救" />);
  }
  const poisonOut = entries.some(
    (entry) => entry.kind === 'poison' && context.deadSeats.has(entry.targetSeat),
  );
  if (poisonOut) notes.push(<RowNote key="poison-out" text="目标出局" tone="bad" />);
  return (
    <View>
      <View style={styles.resourceCard}>
        <ActorFigure roleId={actor} seat={first.actorSeat} context={context} />
        <View style={styles.resourceLines}>{lines}</View>
      </View>
      {notes}
    </View>
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

/** The wolf team's picture row, vote diagram, and verdict sentence. */
function WolfTeamRow({
  entry,
  context,
}: {
  readonly entry: NightReviewActionEntry;
  readonly context: CardContext;
}) {
  const teamFigure = <PortraitFigure tagText="狼队" tagTone="bad" roleId="wolf" />;
  if (entry.kind === 'wolfAttack') {
    const verdict = deriveWolfVerdict(entry);
    const resolvedTarget =
      verdict.type === 'sharedTarget' ||
      verdict.type === 'splitKilled' ||
      verdict.type === 'tiePicked'
        ? verdict.targetSeat
        : undefined;
    return (
      <View>
        <PictureRow actor={teamFigure} verb="爪击" verbTone="bad">
          {resolvedTarget === undefined ? (
            <CrossFigure />
          ) : (
            <SeatFigure seat={resolvedTarget} context={context} showTag />
          )}
        </PictureRow>
        <View style={styles.voteDiagram}>
          {groupWolfVotes(entry.votes).map((group) => (
            <View key={group.targetSeat} style={styles.voteGroup}>
              <View style={styles.voteVoters}>
                {group.voterSeats.map((seat) => (
                  <SeatMedal key={seat} seat={seat} size="small" />
                ))}
              </View>
              <Text style={styles.voteDownArrow}>↓</Text>
              <SeatMedal
                seat={group.targetSeat}
                size="small"
                fill={group.targetSeat === resolvedTarget ? 'hit' : undefined}
              />
            </View>
          ))}
          {entry.abstainSeats.length > 0 && (
            <View style={styles.voteGroup}>
              <View style={styles.voteVoters}>
                {entry.abstainSeats.map((seat) => (
                  <SeatMedal key={seat} seat={seat} size="small" />
                ))}
              </View>
              <Text style={styles.voteDownArrow}>↓</Text>
              <Text style={styles.abstainText}>空刀</Text>
            </View>
          )}
        </View>
        <Text style={styles.verdictText}>{verdictText(verdict)}</Text>
      </View>
    );
  }
  if (entry.kind === 'wolfNoTarget') {
    return (
      <View>
        <PictureRow actor={teamFigure} verb="爪击" verbTone="muted">
          <CrossFigure />
        </PictureRow>
        <RowNote text="未选择目标" />
      </View>
    );
  }
  if (entry.kind === 'wolfGiveUp') {
    return (
      <View>
        <PictureRow actor={teamFigure} verb="爪击" verbTone="muted">
          <CrossFigure />
        </PictureRow>
        <RowNote
          text={
            entry.reason === 'poisonerPresent'
              ? '毒师在场'
              : `被${getRoleDisplayName('nightmare')}封锁`
          }
        />
      </View>
    );
  }
  throw new Error(`[FAIL-FAST] Night review wolf row received unhandled kind ${entry.kind}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup & warning rows (the neutral group)
// ─────────────────────────────────────────────────────────────────────────────

/** The bottom-cards setup line: label plus one role figure per card. */
function SetupRow({ entry }: { readonly entry: NightReviewActionEntry }) {
  if (entry.kind !== 'bottomCards') {
    throw new Error(`[FAIL-FAST] Night review setup row received unhandled kind ${entry.kind}`);
  }
  return (
    <View style={styles.setupRow}>
      <Text style={styles.setupLabel}>底牌组成</Text>
      <View style={styles.figureGroup}>
        {entry.roleIds.map((roleId, index) => (
          <PortraitFigure
            key={`${roleId}-${index}`}
            tagText={getRoleDisplayName(roleId)}
            tagTone={figureTagToneForRole(roleId)}
            roleId={roleId}
          />
        ))}
      </View>
    </View>
  );
}

/** A portrait plus a status sentence: no action, a state to report. */
function DeterminationRow({
  figure,
  sentence,
  tone,
  dimmed,
}: {
  readonly figure: ReactNode;
  readonly sentence: string;
  readonly tone?: TagTone;
  readonly dimmed?: boolean;
}) {
  return (
    <View style={[styles.determinationRow, dimmed === true ? styles.rowDimmed : null]}>
      {figure}
      <Text
        style={[
          styles.determinationSentence,
          tone !== undefined ? { color: TAG_SLOTS[tone].text } : null,
        ]}
      >
        {sentence}
      </Text>
    </View>
  );
}

/** Relation / warning notes: both parties named, no actor invented. */
function WarningRow({
  entry,
  context,
}: {
  readonly entry: NightReviewActionEntry;
  readonly context: CardContext;
}) {
  switch (entry.kind) {
    case 'guardSaveConflict':
      return (
        <DeterminationRow
          figure={<SeatFigure seat={entry.targetSeat} context={context} showTag />}
          sentence="⚠ 同守同救，仍然死亡"
          tone="bad"
        />
      );
    case 'poisonImmune':
      return (
        <DeterminationRow
          figure={
            <PortraitFigure
              tagText={getRoleDisplayName(entry.targetRoleId)}
              tagTone={figureTagToneForRole(entry.targetRoleId)}
              roleId={entry.targetRoleId}
              seat={entry.targetSeat}
              dimmed={context.deadSeats.has(entry.targetSeat)}
            />
          }
          sentence="免疫毒药"
          tone="info"
        />
      );
    case 'reflectDamage':
      return (
        <View>
          <PictureRow
            actor={
              <PortraitFigure
                tagText={getRoleDisplayName(entry.checkerRoleId)}
                tagTone={figureTagToneForRole(entry.checkerRoleId)}
                roleId={entry.checkerRoleId}
              />
            }
            verb="查验"
            verbTone="bad"
          >
            <SeatFigure seat={entry.targetSeat} context={context} showTag />
          </PictureRow>
          <RowNote text="反伤" tone="bad" />
        </View>
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

/** An idle actor: portrait plus its did-not-act phrase, dimmed. No tag, no ✗. */
function IdleRow({
  entry,
  context,
}: {
  readonly entry: NightReviewActionEntry;
  readonly context: CardContext;
}) {
  const roleId = nightReviewActorRoleId(entry);
  if (roleId === null || !('actorSeat' in entry)) {
    throw new Error(`[FAIL-FAST] Night review idle entry ${entry.kind} has no actor`);
  }
  return (
    <DeterminationRow
      figure={<ActorFigure roleId={roleId} seat={entry.actorSeat} context={context} />}
      sentence={idlePhrase(entry)}
      dimmed
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Night block
// ─────────────────────────────────────────────────────────────────────────────

function renderBlock(block: ReportBlock, context: CardContext): ReactNode {
  if (block.type === 'potion') {
    return <ResourceCard actor={block.actor} entries={block.entries} context={context} />;
  }
  if (block.type === 'idle') return <IdleRow entry={block.entry} context={context} />;
  const { entry } = block;
  if (isWolfTeamKind(entry.kind)) return <WolfTeamRow entry={entry} context={context} />;
  if (entry.kind === 'bottomCards') return <SetupRow entry={entry} />;
  if (
    entry.kind === 'guardSaveConflict' ||
    entry.kind === 'poisonImmune' ||
    entry.kind === 'reflectDamage'
  ) {
    return <WarningRow entry={entry} context={context} />;
  }
  return <DirectedActionRow entry={entry} context={context} />;
}

function blockKey(block: ReportBlock, index: number): string {
  if (block.type === 'potion') return `potion-${block.actor}`;
  return `${block.type}-${block.entry.kind}-${index}`;
}

/** One night's picture rows in night order, behind a centered block header. */
function NightBlock({
  blocks,
  context,
}: {
  readonly blocks: readonly ReportBlock[];
  readonly context: CardContext;
}) {
  return (
    <View style={styles.blockCard}>
      <Text style={styles.blockTitle}>{NIGHT_REPORT_NIGHT_BLOCK_TITLE}</Text>
      <View style={styles.blockDivider} />
      {blocks.map((block, index) => (
        <View key={blockKey(block, index)} style={index > 0 ? styles.blockSeparator : null}>
          {renderBlock(block, context)}
        </View>
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
      deadSeats: new Set(
        data.identities.filter((entry) => !entry.isAlive).map((entry) => entry.seat),
      ),
      wolfTargetSaveNote: deriveWolfTargetSaveNote(data),
      identitiesBySeat: new Map(data.identities.map((entry) => [entry.seat, entry])),
    }),
    [data],
  );

  return (
    <View style={styles.root}>
      <ReportHeader data={data} shareTitle={shareTitle} />
      <View style={styles.page}>
        <View style={styles.dayTabStrip}>
          <View style={styles.dayTab}>
            <Text style={styles.dayTabText}>{NIGHT_REPORT_DAY_TAB_LABEL}</Text>
          </View>
        </View>
        <NightBlock blocks={blocks} context={context} />
        <View style={styles.blockCard}>
          <Text style={styles.blockTitle}>{NIGHT_REPORT_DAY_BLOCK_TITLE}</Text>
          <View style={styles.blockDivider} />
          <Text style={styles.dayEmptyText}>{NIGHT_REPORT_DAY_EMPTY_TEXT}</Text>
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
  // ── Day tabs + block cards ──
  dayTabStrip: {
    flexDirection: 'row',
  },
  dayTab: {
    backgroundColor: P.text,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.tight,
  },
  dayTabText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  blockCard: {
    borderWidth: fixed.borderWidth,
    borderColor: P.cardBorder,
    borderRadius: borderRadius.small,
    padding: spacing.medium,
    gap: spacing.small,
  },
  blockTitle: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
    color: P.text,
    textAlign: 'center',
  },
  blockDivider: {
    height: fixed.divider,
    backgroundColor: P.cardBorder,
  },
  dayEmptyText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: P.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.small,
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
  blockSeparator: {
    borderTopWidth: fixed.divider,
    borderTopColor: P.divider,
  },
  rowDimmed: {
    opacity: fixed.disabledOpacity,
  },
  // ── Portrait figures + picture rows ──
  figure: {
    alignItems: 'center',
    paddingTop: spacing.medium,
  },
  figureBare: {
    paddingTop: 0,
  },
  figureTag: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
  },
  figureTagText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  portrait: {
    width: NIGHT_REPORT_MEDAL_SIZES.medium,
    height: NIGHT_REPORT_MEDAL_SIZES.medium,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
  },
  portraitDimmed: {
    opacity: fixed.disabledOpacity,
  },
  figureSeat: {
    marginTop: spacing.micro,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: P.text,
    textAlign: 'center',
  },
  crossDisc: {
    width: NIGHT_REPORT_MEDAL_SIZES.medium,
    height: NIGHT_REPORT_MEDAL_SIZES.medium,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: P.medalNeutral.border,
    backgroundColor: P.medalNeutral.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossGlyph: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: P.textMuted,
    textAlign: 'center',
  },
  pictureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  arrowColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.tight,
  },
  arrowGlyph: {
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  arrowVerb: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  figureGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  connector: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: P.textSecondary,
  },
  rowNote: {
    marginTop: spacing.tight,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: P.textMuted,
    textAlign: 'center',
  },
  // ── Resource cards + determination rows ──
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  resourceLines: {
    flex: 1,
    gap: spacing.small,
  },
  resourceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  determinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  determinationSentence: {
    flex: 1,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: P.textSecondary,
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  setupLabel: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: P.text,
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
  // ── Wolf vote diagram ──
  voteDiagram: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.medium,
    marginTop: spacing.small,
  },
  voteGroup: {
    alignItems: 'center',
    gap: spacing.micro,
  },
  voteVoters: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.tight,
  },
  voteDownArrow: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: P.textMuted,
    textAlign: 'center',
  },
  abstainText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
    color: P.textSecondary,
  },
  verdictText: {
    marginTop: spacing.tight,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: P.medalWolf.text,
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
