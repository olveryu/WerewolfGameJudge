/**
 * NightReviewReportBody - The one presentation body for the night review report.
 *
 * Layout (top to bottom, identical on every surface): outcome hero (dark band
 * with the night result and one card per death) → disclaimer line → action
 * timeline (effective actions only, on a vertical rail) → noise zone (idle /
 * confirmation-only entries as muted chips) → faction-colored identity grid.
 * Consumed by NightReviewModal (in-room) and NightReviewShareCard (share image);
 * shells own only their frame. No service imports, no business logic; all facts
 * come from NightReview.helpers, all shared copy/geometry from nightReviewLayout.
 *
 * Color/intensity rules (v5, keep surfaces from drifting apart again):
 * - Solid color blocks exist in exactly two places: the hero band (colors.text)
 *   and the SeatDot `filled` emphasis used for wolf-attack targets.
 * - Red (error / wolf) expresses outcomes only: out pills and death surfaces.
 *   Every other badge is a tinted wash (withAlpha 0.12) with a same-color icon.
 * - Every size/color value comes from @/theme tokens or withAlpha derivations.
 * - Every seat reference in the timeline renders as a SeatIdentityChip
 *   (seat dot + 「N号 · 角色名」), so a reader never has to cross-check the
 *   identity grid to know who a seat is.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import {
  Faction,
  getRoleDisplayName,
  ROLE_SPECS,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import type { ComponentProps, ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SeatDot } from '@/components/SeatDot';
import { STATUS_ICONS } from '@/config/iconTokens';
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  typography,
  withAlpha,
} from '@/theme';

import {
  DEATH_REASON_LABELS,
  getNightReviewOutcome,
  type NightReviewActionEntry,
  type NightReviewData,
  type NightReviewIdentityEntry,
  type NightReviewOutcome,
  type NightReviewWolfVote,
} from '../NightReview.helpers';
import {
  formatNightReviewOutcomeHeadline,
  NIGHT_REVIEW_ACTIONS_TITLE,
  NIGHT_REVIEW_DISCLAIMER_TEXT,
  NIGHT_REVIEW_IDENTITIES_TITLE,
  NIGHT_REVIEW_NOISE_TITLE,
  NIGHT_REVIEW_PEACEFUL_HEADLINE,
  NIGHT_REVIEW_PEACEFUL_SUB,
  NIGHT_REVIEW_WOLF_SPLIT_SUB,
} from '../nightReviewLayout';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Faction semantic color for a role on the review surface (wolf red / god
 * purple / villager gray / special amber). Villager maps to the neutral
 * textSecondary gray here: the approved review design renders villager
 * identities gray on this surface, not the app-wide villager green.
 * This one mapping feeds every faction-tinted element in the modal
 * (identity cards, role chips, event badges) so the surface stays consistent.
 */
function factionColor(roleId: RoleId | null): string {
  if (roleId === null) return colors.textSecondary;
  switch (ROLE_SPECS[roleId]?.faction) {
    case Faction.Wolf:
      return colors.wolf;
    case Faction.God:
      return colors.god;
    case Faction.Villager:
      return colors.textSecondary;
    case Faction.Special:
      return colors.third;
    default:
      return colors.textSecondary;
  }
}

/** Role display text for an identity entry (empty seat / unassigned fallbacks). */
function identityRoleText(entry: NightReviewIdentityEntry): string {
  return entry.isEmptySeat ? '空座' : entry.roleId ? getRoleDisplayName(entry.roleId) : '未分配';
}

type PillTone = 'good' | 'bad' | 'success' | 'warn' | 'neutral';

const PILL_TONES: Record<PillTone, { backgroundColor: string; color: string }> = {
  good: { backgroundColor: withAlpha(colors.primary, 0.12), color: colors.primary },
  bad: { backgroundColor: withAlpha(colors.error, 0.12), color: colors.error },
  success: { backgroundColor: withAlpha(colors.success, 0.14), color: colors.success },
  warn: { backgroundColor: withAlpha(colors.warning, 0.16), color: colors.warning },
  neutral: { backgroundColor: colors.background, color: colors.textSecondary },
};

function Pill({ text, tone }: { readonly text: string; readonly tone: PillTone }) {
  const toneStyle = PILL_TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.backgroundColor }]}>
      <Text style={[styles.pillText, { color: toneStyle.color }]}>{text}</Text>
    </View>
  );
}

/** Small faction-tinted chip carrying a role display name. */
function RoleChip({ roleId }: { readonly roleId: RoleId }) {
  const color = factionColor(roleId);
  return (
    <View style={[styles.roleChip, { backgroundColor: withAlpha(color, 0.12) }]}>
      <Text style={[styles.roleChipText, { color }]}>{getRoleDisplayName(roleId)}</Text>
    </View>
  );
}

interface EventRowProps {
  readonly icon: IoniconsName;
  readonly color: string;
  readonly children: ReactNode;
}

/** One timeline row: tinted category badge + content column. */
function EventRow({ icon, color, children }: EventRowProps) {
  return (
    <View style={styles.eventRow}>
      <View style={[styles.badge, { backgroundColor: withAlpha(color, 0.12) }]}>
        <Ionicons name={icon} size={componentSizes.icon.sm} color={color} />
      </View>
      <View style={styles.eventMain}>{children}</View>
    </View>
  );
}

interface SeatIdentityChipProps {
  readonly seat: number;
  readonly identityBySeat: ReadonlyMap<number, NightReviewIdentityEntry>;
  /** Passed through to SeatDot (wolf-attack targets render as the filled focal dot). */
  readonly emphasis?: 'filled';
}

/**
 * One seat reference in the timeline: seat dot + 「N号 · 角色名」.
 * The role text reuses the identity grid's fallbacks (空座 / 未分配) via
 * identityRoleText. A seat with no identity entry is a broken fact stream
 * and fails fast, exactly like the hero's death cards.
 */
function SeatIdentityChip({ seat, identityBySeat, emphasis }: SeatIdentityChipProps) {
  const identity = identityBySeat.get(seat);
  if (identity === undefined) {
    throw new Error(`[FAIL-FAST] Night review seat ${seat} has no identity entry`);
  }
  return (
    <View style={styles.seatChip}>
      <SeatDot seat={seat} emphasis={emphasis ?? 'none'} />
      <Text style={styles.seatChipText}>
        {formatSeat(seat)} · {identityRoleText(identity)}
      </Text>
    </View>
  );
}

/**
 * The single seat holding a role, or undefined when the role is absent or
 * held by more than one seat (bottom-card boards can duplicate a role).
 * Callers annotate an actor seat only on a unique match — never guess.
 */
function uniqueSeatForRole(
  identityBySeat: ReadonlyMap<number, NightReviewIdentityEntry>,
  roleId: RoleId,
): number | undefined {
  let found: number | undefined;
  for (const entry of identityBySeat.values()) {
    if (entry.roleId !== roleId) continue;
    if (found !== undefined) return undefined;
    found = entry.seat;
  }
  return found;
}

interface EventHeadProps {
  readonly title: string;
  readonly identityBySeat: ReadonlyMap<number, NightReviewIdentityEntry>;
  readonly seats?: readonly number[];
  readonly pill?: { readonly text: string; readonly tone: PillTone };
  readonly children?: ReactNode;
}

/** Title line of an event row: bold label, seat identity chips, result pill, inline extras. */
function EventHead({ title, identityBySeat, seats, pill, children }: EventHeadProps) {
  return (
    <View style={styles.eventHead}>
      <Text style={styles.eventTitle}>{title}</Text>
      {seats?.map((seat) => (
        <SeatIdentityChip key={seat} seat={seat} identityBySeat={identityBySeat} />
      ))}
      {children}
      {pill ? <Pill text={pill.text} tone={pill.tone} /> : null}
    </View>
  );
}

function EventSub({ text }: { readonly text: string }) {
  return <Text style={styles.eventSub}>{text}</Text>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry partitioning (presentation derivation — facts and order untouched)
//
// The fact stream is split three ways for presentation: the outcome entry is
// lifted into the hero, idle / confirmation-only entries drop into the noise
// zone, and the rest stay on the timeline in fact order. Consecutive potion
// entries of one actor (witch / poisoner) merge into a single timeline row:
// effective actions headline the row, unused potions become sub-lines. A
// potion run with no effective action is all-idle and lands in the noise zone.
// ─────────────────────────────────────────────────────────────────────────────

type TimelineSegment =
  | { readonly type: 'single'; readonly entry: NightReviewActionEntry }
  | { readonly type: 'potionFamily'; readonly entries: readonly NightReviewActionEntry[] };

interface NightReviewPartition {
  readonly timeline: readonly TimelineSegment[];
  readonly noise: readonly NightReviewActionEntry[];
}

/** Kinds that carry no night action: confirmations and "did nothing" entries. */
const NOISE_KINDS: ReadonlySet<NightReviewActionEntry['kind']> = new Set([
  'nightmareIdle',
  'shelterIdle',
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
  'infectIdle',
  'hiddenWolfConfirmed',
  'avengerConfirmed',
]);

/** Potion family an entry belongs to, or null outside the potion entries. */
function potionFamilyOf(entry: NightReviewActionEntry): 'witch' | 'poisoner' | null {
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

function isEffectivePotion(entry: NightReviewActionEntry): boolean {
  return entry.kind === 'save' || entry.kind === 'poison';
}

function isOutcomeEntry(entry: NightReviewActionEntry): boolean {
  return entry.kind === 'deaths' || entry.kind === 'peacefulNight';
}

function partitionEntries(actions: readonly NightReviewActionEntry[]): NightReviewPartition {
  const timeline: TimelineSegment[] = [];
  const noise: NightReviewActionEntry[] = [];
  let potionRun: { family: 'witch' | 'poisoner'; entries: NightReviewActionEntry[] } | null = null;

  const flushPotionRun = (): void => {
    if (potionRun === null) return;
    if (potionRun.entries.some(isEffectivePotion)) {
      timeline.push({ type: 'potionFamily', entries: potionRun.entries });
    } else {
      noise.push(...potionRun.entries);
    }
    potionRun = null;
  };

  for (const entry of actions) {
    if (isOutcomeEntry(entry)) {
      flushPotionRun();
      continue;
    }
    const family = potionFamilyOf(entry);
    if (family !== null) {
      if (potionRun !== null && potionRun.family !== family) flushPotionRun();
      if (potionRun === null) potionRun = { family, entries: [] };
      potionRun.entries.push(entry);
      continue;
    }
    flushPotionRun();
    if (NOISE_KINDS.has(entry.kind)) {
      noise.push(entry);
    } else {
      timeline.push({ type: 'single', entry });
    }
  }
  flushPotionRun();
  return { timeline, noise };
}

/** Chip label for a noise-zone entry: the entry's existing row title copy. */
function noiseLabel(entry: NightReviewActionEntry): string {
  switch (entry.kind) {
    case 'nightmareIdle':
      return `${getRoleDisplayName('nightmare')}未封锁`;
    case 'shelterIdle':
      return `${getRoleDisplayName('eclipseWolfQueen')}未庇护`;
    case 'guardIdle':
      return '守卫未守护';
    case 'silenceIdle':
      return '禁言长老未禁言';
    case 'votebanIdle':
      return '禁票长老未禁票';
    case 'curseIdle':
      return '乌鸦未诅咒';
    case 'dreamIdle':
      return '摄梦人未摄梦';
    case 'swapIdle':
      return '魔术师未交换';
    case 'charmIdle':
      return '狼美人未魅惑';
    case 'hypnotizeIdle':
      return '吹笛者未催眠';
    case 'checkIdle':
      return `${getRoleDisplayName(entry.actorRoleId)}未查验`;
    case 'learnIdle':
      return `${getRoleDisplayName('wolfRobot')}未学习`;
    case 'infectIdle':
      return `${getRoleDisplayName('seedWolf')}未使用感染`;
    case 'hiddenWolfConfirmed':
      return `${getRoleDisplayName('hiddenWolf')}已确认狼同伴`;
    case 'avengerConfirmed':
      return '复仇者已确认阵营';
    case 'witchIdleAll':
      return '女巫未使用药水';
    case 'witchNoSave':
      return '女巫未使用解药';
    case 'witchNoPoison':
      return '女巫未使用毒药';
    case 'poisonerNoPoison':
      return '毒师未使用毒药';
    default:
      throw new Error(
        `[FAIL-FAST] Night review entry is not a noise-zone entry: ${JSON.stringify(entry)}`,
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outcome hero
// ─────────────────────────────────────────────────────────────────────────────

function DeathCard({
  death,
  identity,
}: {
  readonly death: { readonly seat: number; readonly reason: string | null };
  readonly identity: NightReviewIdentityEntry | undefined;
}) {
  if (identity === undefined) {
    throw new Error(`[FAIL-FAST] Night review death seat ${death.seat} has no identity entry`);
  }
  return (
    <View style={styles.deathCard}>
      <SeatDot seat={death.seat} />
      <View>
        <Text style={styles.deathCardMain}>
          {formatSeat(death.seat)} · {identityRoleText(identity)}
        </Text>
        {death.reason ? <Text style={styles.deathCardReason}>{death.reason}</Text> : null}
      </View>
    </View>
  );
}

function OutcomeHero({
  data,
  outcome,
}: {
  readonly data: NightReviewData;
  readonly outcome: NightReviewOutcome;
}) {
  const identityBySeat = useMemo(
    () => new Map(data.identities.map((entry) => [entry.seat, entry])),
    [data.identities],
  );
  const headline =
    outcome.type === 'peaceful'
      ? NIGHT_REVIEW_PEACEFUL_HEADLINE
      : formatNightReviewOutcomeHeadline(outcome.deaths.length);

  return (
    <View style={styles.hero}>
      <Text style={styles.heroHeadline}>{headline}</Text>
      {outcome.type === 'peaceful' ? (
        <Text style={styles.heroSub}>{NIGHT_REVIEW_PEACEFUL_SUB}</Text>
      ) : (
        <View style={styles.heroDeaths}>
          {outcome.deaths.map((death) => (
            <DeathCard
              key={death.seat}
              death={{
                seat: death.seat,
                reason: death.reason ? DEATH_REASON_LABELS[death.reason] : null,
              }}
              identity={identityBySeat.get(death.seat)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action entry rendering (timeline rows only — partitioning guarantees the
// entry kinds that reach these renderers; anything else fails fast)
// ─────────────────────────────────────────────────────────────────────────────

function checkResultTone(result: string): PillTone {
  if (result === '狼人') return 'bad';
  if (result === '好人') return 'good';
  return 'neutral';
}

interface WolfVoteGroup {
  readonly targetSeat: number;
  readonly voterSeats: readonly number[];
}

/**
 * Aggregate wolf votes by target: voters grouped behind one target dot.
 * Groups sort by vote count descending, ties by target seat ascending, so the
 * rendering is deterministic regardless of vote entry order.
 */
function groupWolfVotes(votes: readonly NightReviewWolfVote[]): WolfVoteGroup[] {
  const voterSeatsByTarget = new Map<number, number[]>();
  for (const vote of votes) {
    const voterSeats = voterSeatsByTarget.get(vote.targetSeat);
    if (voterSeats) {
      voterSeats.push(vote.voterSeat);
    } else {
      voterSeatsByTarget.set(vote.targetSeat, [vote.voterSeat]);
    }
  }
  return [...voterSeatsByTarget.entries()]
    .map(([targetSeat, voterSeats]) => ({ targetSeat, voterSeats }))
    .sort((a, b) => b.voterSeats.length - a.voterSeats.length || a.targetSeat - b.targetSeat);
}

function WolfAttackRow({
  entry,
  deadSeats,
  identityBySeat,
}: {
  readonly entry: NightReviewActionEntry;
  readonly deadSeats: ReadonlySet<number>;
  readonly identityBySeat: ReadonlyMap<number, NightReviewIdentityEntry>;
}) {
  if (entry.kind !== 'wolfAttack') {
    throw new Error('[FAIL-FAST] WolfAttackRow requires a wolfAttack entry');
  }
  const groups = groupWolfVotes(entry.votes);
  return (
    <EventRow icon="moon" color={colors.wolf}>
      <EventHead title="狼人袭击" identityBySeat={identityBySeat} />
      {groups.map((group) => (
        <View key={group.targetSeat} style={styles.voteGroup}>
          <View style={styles.voteVoters}>
            {group.voterSeats.map((seat) => (
              <SeatIdentityChip key={seat} seat={seat} identityBySeat={identityBySeat} />
            ))}
          </View>
          <Text style={styles.voteArrow}>→</Text>
          <SeatIdentityChip
            seat={group.targetSeat}
            identityBySeat={identityBySeat}
            emphasis="filled"
          />
          {deadSeats.has(group.targetSeat) ? <Pill text="出局" tone="bad" /> : null}
        </View>
      ))}
      {entry.abstainSeats.length > 0 ? (
        <View style={styles.voteGroup}>
          <View style={styles.voteVoters}>
            {entry.abstainSeats.map((seat) => (
              <SeatIdentityChip key={seat} seat={seat} identityBySeat={identityBySeat} />
            ))}
          </View>
          <Pill text="空刀" tone="neutral" />
        </View>
      ) : null}
      {/* Split / shared-target wording judges real targets only: abstentions
          neither split the pack nor make a lone target a shared one. When
          every wolf abstained there are no groups and no sub-line at all. */}
      {groups.length === 1 ? <EventSub text="狼队共同目标" /> : null}
      {groups.length > 1 ? <EventSub text={NIGHT_REVIEW_WOLF_SPLIT_SUB} /> : null}
    </EventRow>
  );
}

/** One line inside a merged potion-family row. */
function PotionEntryLine({
  entry,
  deadSeats,
  identityBySeat,
}: {
  readonly entry: NightReviewActionEntry;
  readonly deadSeats: ReadonlySet<number>;
  readonly identityBySeat: ReadonlyMap<number, NightReviewIdentityEntry>;
}) {
  switch (entry.kind) {
    case 'save':
      return (
        <EventHead
          title="女巫使用解药救了"
          identityBySeat={identityBySeat}
          seats={[entry.targetSeat]}
        />
      );
    case 'poison':
      return (
        <EventHead
          title={entry.actorRoleId === 'poisoner' ? '毒师毒杀' : '女巫使用毒药毒杀'}
          identityBySeat={identityBySeat}
          seats={[entry.targetSeat]}
          pill={deadSeats.has(entry.targetSeat) ? { text: '出局', tone: 'bad' } : undefined}
        />
      );
    case 'witchNoSave':
      return <EventSub text="解药未使用" />;
    case 'witchNoPoison':
    case 'poisonerNoPoison':
      return <EventSub text="毒药未使用" />;
    default:
      throw new Error(
        `[FAIL-FAST] Night review entry cannot join a potion family row: ${JSON.stringify(entry)}`,
      );
  }
}

/** A run of consecutive potion entries of one actor, merged into one row. */
function PotionFamilyRow({
  entries,
  deadSeats,
  identityBySeat,
}: {
  readonly entries: readonly NightReviewActionEntry[];
  readonly deadSeats: ReadonlySet<number>;
  readonly identityBySeat: ReadonlyMap<number, NightReviewIdentityEntry>;
}) {
  const mainEntry = entries.find(isEffectivePotion);
  if (mainEntry === undefined) {
    throw new Error('[FAIL-FAST] Potion family row without an effective potion entry');
  }
  const isSaveLed = mainEntry.kind === 'save';
  return (
    <EventRow
      icon={isSaveLed ? 'medkit-outline' : 'flask-outline'}
      color={isSaveLed ? colors.success : colors.error}
    >
      {entries.map((entry, i) => (
        <PotionEntryLine
          key={`potion-${i}`}
          entry={entry}
          deadSeats={deadSeats}
          identityBySeat={identityBySeat}
        />
      ))}
    </EventRow>
  );
}

function NightReviewActionRow({
  entry,
  deadSeats,
  identityBySeat,
}: {
  readonly entry: NightReviewActionEntry;
  readonly deadSeats: ReadonlySet<number>;
  readonly identityBySeat: ReadonlyMap<number, NightReviewIdentityEntry>;
}) {
  switch (entry.kind) {
    case 'bottomCards':
      return (
        <EventRow icon="layers-outline" color={colors.third}>
          <EventHead identityBySeat={identityBySeat} title="底牌组成" />
          <View style={styles.chipWrap}>
            {entry.roleIds.map((roleId, i) => (
              <RoleChip key={`${roleId}-${i}`} roleId={roleId} />
            ))}
          </View>
        </EventRow>
      );
    case 'cardChoice':
      return (
        <EventRow icon="albums-outline" color={factionColor(entry.actorRoleId)}>
          <EventHead
            identityBySeat={identityBySeat}
            title={`${getRoleDisplayName(entry.actorRoleId)}选择了`}
          >
            <RoleChip roleId={entry.chosenRoleId} />
          </EventHead>
        </EventRow>
      );
    case 'cupidLink':
      return (
        <EventRow icon="heart" color={colors.third}>
          <EventHead identityBySeat={identityBySeat} title="丘比特连线" seats={entry.seats} />
        </EventRow>
      );
    case 'wolfAttack':
      return <WolfAttackRow entry={entry} deadSeats={deadSeats} identityBySeat={identityBySeat} />;
    case 'wolfNoTarget':
      return (
        <EventRow icon="moon" color={colors.wolf}>
          <EventHead identityBySeat={identityBySeat} title="狼人空刀" />
          <EventSub text="未选择目标" />
        </EventRow>
      );
    case 'wolfGiveUp':
      return (
        <EventRow icon="moon" color={colors.wolf}>
          <EventHead identityBySeat={identityBySeat} title="狼人放弃袭击" />
          <EventSub
            text={
              entry.reason === 'poisonerPresent'
                ? '毒师在场'
                : `被${getRoleDisplayName('nightmare')}封锁`
            }
          />
        </EventRow>
      );
    case 'nightmareBlock':
      return (
        <EventRow icon="eye-off-outline" color={colors.wolf}>
          <EventHead
            identityBySeat={identityBySeat}
            title={`${getRoleDisplayName('nightmare')}封锁`}
            seats={[entry.targetSeat]}
          />
          {entry.targetRoleId ? (
            <EventSub text={`${getRoleDisplayName(entry.targetRoleId)}，技能无效`} />
          ) : null}
        </EventRow>
      );
    case 'shelter':
      return (
        <EventRow icon="umbrella-outline" color={colors.wolf}>
          <EventHead
            identityBySeat={identityBySeat}
            title={`${getRoleDisplayName('eclipseWolfQueen')}庇护`}
            seats={[entry.targetSeat]}
          />
        </EventRow>
      );
    case 'guard':
      return (
        <EventRow icon="shield" color={colors.info}>
          <EventHead identityBySeat={identityBySeat} title="守卫守护" seats={[entry.targetSeat]} />
        </EventRow>
      );
    case 'silence':
      return (
        <EventRow icon="mic-off-outline" color={colors.third}>
          <EventHead
            identityBySeat={identityBySeat}
            title="禁言长老禁言"
            seats={[entry.targetSeat]}
          />
        </EventRow>
      );
    case 'voteban':
      return (
        <EventRow icon="ban-outline" color={colors.third}>
          <EventHead
            identityBySeat={identityBySeat}
            title="禁票长老禁票"
            seats={[entry.targetSeat]}
          />
        </EventRow>
      );
    case 'curse':
      return (
        <EventRow icon="sparkles-outline" color={colors.third}>
          <EventHead identityBySeat={identityBySeat} title="乌鸦诅咒" seats={[entry.targetSeat]} />
        </EventRow>
      );
    case 'dream':
      return (
        <EventRow icon="bed-outline" color={colors.god}>
          <EventHead
            identityBySeat={identityBySeat}
            title="摄梦人摄梦"
            seats={[entry.targetSeat]}
          />
        </EventRow>
      );
    case 'swap':
      return (
        <EventRow icon="swap-horizontal" color={colors.god}>
          <EventHead identityBySeat={identityBySeat} title="魔术师交换" seats={entry.seats} />
        </EventRow>
      );
    case 'idolChoice':
      return (
        <EventRow icon="star-outline" color={colors.third}>
          <EventHead
            identityBySeat={identityBySeat}
            title={`${getRoleDisplayName(entry.actorRoleId)}选择榜样`}
            seats={[entry.targetSeat]}
          />
        </EventRow>
      );
    case 'mimic':
      return (
        <EventRow icon="copy-outline" color={factionColor('shadow')}>
          <EventHead
            identityBySeat={identityBySeat}
            title="影子模仿"
            seats={[entry.targetSeat]}
            pill={entry.isBound ? { text: '绑定', tone: 'neutral' } : undefined}
          />
        </EventRow>
      );
    case 'charm':
      return (
        <EventRow icon="heart-outline" color={colors.wolf}>
          <EventHead
            identityBySeat={identityBySeat}
            title="狼美人魅惑"
            seats={[entry.targetSeat]}
          />
        </EventRow>
      );
    case 'convert':
      return (
        <EventRow icon="repeat-outline" color={colors.wolf}>
          <EventHead
            identityBySeat={identityBySeat}
            title={`${getRoleDisplayName('awakenedGargoyle')}转化`}
            seats={[entry.targetSeat]}
          />
        </EventRow>
      );
    case 'hypnotize':
      return (
        <EventRow icon="musical-notes-outline" color={colors.third}>
          <EventHead identityBySeat={identityBySeat} title="吹笛者催眠" seats={entry.targetSeats} />
        </EventRow>
      );
    case 'check':
      return (
        <EventRow icon="eye" color={factionColor(entry.actorRoleId)}>
          <EventHead
            identityBySeat={identityBySeat}
            title={`${getRoleDisplayName(entry.actorRoleId)}查验`}
            seats={[entry.targetSeat]}
            pill={{ text: entry.result, tone: checkResultTone(entry.result) }}
          />
        </EventRow>
      );
    case 'learn':
      return (
        <EventRow icon="book-outline" color={colors.wolf}>
          <EventHead
            identityBySeat={identityBySeat}
            title={`${getRoleDisplayName('wolfRobot')}学习`}
            seats={[entry.targetSeat]}
          >
            <RoleChip roleId={entry.learnedRoleId} />
          </EventHead>
        </EventRow>
      );
    case 'shootStatus': {
      // The entry names the actor only by role; the seat is the missing fact
      // on this row. Annotate it （猎人（N号）) only when the role resolves to
      // exactly one seat in the identity table — absent or duplicated roles
      // (bottom-card boards) get no annotation rather than a guessed seat.
      const actorSeat = uniqueSeatForRole(identityBySeat, entry.actorRoleId);
      return (
        <EventRow icon="locate-outline" color={factionColor(entry.actorRoleId)}>
          <EventHead
            identityBySeat={identityBySeat}
            title={getRoleDisplayName(entry.actorRoleId)}
            pill={
              entry.canShoot
                ? { text: '可以发动技能', tone: 'success' }
                : { text: '不能发动技能', tone: 'neutral' }
            }
          >
            {actorSeat !== undefined ? (
              <Text style={styles.actorSeatText}>（{formatSeat(actorSeat)}）</Text>
            ) : null}
          </EventHead>
        </EventRow>
      );
    }
    case 'infectConverted':
      return (
        <EventRow icon="bug-outline" color={colors.wolf}>
          <EventHead
            identityBySeat={identityBySeat}
            title={`${getRoleDisplayName('seedWolf')}感染`}
            seats={[entry.targetSeat]}
            pill={{ text: '成功', tone: 'success' }}
          />
        </EventRow>
      );
    case 'infectFailed':
      return (
        <EventRow icon="bug-outline" color={colors.wolf}>
          <EventHead
            identityBySeat={identityBySeat}
            title={`${getRoleDisplayName('seedWolf')}感染`}
            seats={[entry.targetSeat]}
            pill={{ text: '失败', tone: 'bad' }}
          />
        </EventRow>
      );
    case 'guardSaveConflict':
      return (
        <EventRow icon={STATUS_ICONS.WARNING} color={colors.warning}>
          <EventHead identityBySeat={identityBySeat} title="同守同救" seats={[entry.targetSeat]} />
          <EventSub text="仍然死亡" />
        </EventRow>
      );
    case 'poisonImmune':
      return (
        <EventRow icon={STATUS_ICONS.WARNING} color={colors.warning}>
          <EventHead identityBySeat={identityBySeat} title="免疫毒药" seats={[entry.targetSeat]}>
            <RoleChip roleId={entry.targetRoleId} />
          </EventHead>
        </EventRow>
      );
    case 'reflectDamage':
      return (
        <EventRow icon={STATUS_ICONS.WARNING} color={colors.warning}>
          <EventHead
            identityBySeat={identityBySeat}
            title={`${getRoleDisplayName(entry.checkerRoleId)}查验`}
            seats={[entry.targetSeat]}
            pill={{ text: '反伤', tone: 'warn' }}
          />
          <EventSub text={`目标：${getRoleDisplayName(entry.targetRoleId)}`} />
        </EventRow>
      );
    // Outcome entries render in the hero, idle / confirmation entries in the
    // noise zone, and potion entries in the merged family row — partitioning
    // guarantees none of them reach this renderer.
    case 'peacefulNight':
    case 'deaths':
    case 'save':
    case 'poison':
    case 'witchIdleAll':
    case 'witchNoSave':
    case 'witchNoPoison':
    case 'poisonerNoPoison':
    case 'nightmareIdle':
    case 'shelterIdle':
    case 'hiddenWolfConfirmed':
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
    case 'avengerConfirmed':
      throw new Error(
        `[FAIL-FAST] Night review entry must be partitioned before timeline rendering: ${JSON.stringify(entry)}`,
      );
    default: {
      const exhaustive: never = entry;
      throw new Error(
        `[FAIL-FAST] Unknown night review action entry: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity grid
// ─────────────────────────────────────────────────────────────────────────────

function IdentityCard({ entry }: { readonly entry: NightReviewIdentityEntry }) {
  const color = factionColor(entry.roleId);
  return (
    <View
      style={[
        styles.idCard,
        { backgroundColor: withAlpha(color, 0.1) },
        entry.isAlive ? null : styles.idCardDead,
      ]}
    >
      <View style={styles.idTop}>
        <Text style={styles.idSeat}>{formatSeat(entry.seat)}</Text>
        {entry.isAlive ? null : <Text style={styles.idDeadTag}>已出局</Text>}
      </View>
      <Text style={[styles.idRole, { color: entry.roleId ? color : colors.textSecondary }]}>
        {identityRoleText(entry)}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report body
// ─────────────────────────────────────────────────────────────────────────────

export function NightReviewReportBody({ data }: { readonly data: NightReviewData }) {
  const deadSeats = useMemo(
    () => new Set(data.identities.filter((entry) => !entry.isAlive).map((entry) => entry.seat)),
    [data.identities],
  );
  const outcome = useMemo(() => getNightReviewOutcome(data), [data]);
  const partition = useMemo(() => partitionEntries(data.actions), [data.actions]);
  const identityBySeat = useMemo(
    () => new Map(data.identities.map((entry) => [entry.seat, entry])),
    [data.identities],
  );

  return (
    <>
      {/* Outcome hero: the night result first, exactly once */}
      <OutcomeHero data={data} outcome={outcome} />

      {/* Fair play reminder */}
      <View style={styles.disclaimerRow}>
        <Ionicons name={STATUS_ICONS.WARNING} size={typography.secondary} color={colors.warning} />
        <Text style={styles.disclaimerText}>{NIGHT_REVIEW_DISCLAIMER_TEXT}</Text>
      </View>

      {/* Action timeline: effective actions on a vertical rail */}
      <Text style={styles.sectionLabel}>{NIGHT_REVIEW_ACTIONS_TITLE}</Text>
      <View style={styles.timeline}>
        <View style={styles.timelineRail} />
        {partition.timeline.map((segment, i) =>
          segment.type === 'single' ? (
            <NightReviewActionRow
              key={`action-${i}`}
              entry={segment.entry}
              deadSeats={deadSeats}
              identityBySeat={identityBySeat}
            />
          ) : (
            <PotionFamilyRow
              key={`action-${i}`}
              entries={segment.entries}
              deadSeats={deadSeats}
              identityBySeat={identityBySeat}
            />
          ),
        )}
      </View>

      {/* Noise zone: idle / confirmation-only entries as muted chips */}
      {partition.noise.length > 0 ? (
        <View style={styles.noiseSection}>
          <Text style={styles.sectionLabel}>{NIGHT_REVIEW_NOISE_TITLE}</Text>
          <View style={styles.noiseWrap}>
            {partition.noise.map((entry, i) => (
              <View key={`noise-${i}`} style={styles.noiseChip}>
                <Text style={styles.noiseChipText}>{noiseLabel(entry)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.divider} />

      {/* Identity grid section */}
      <Text style={styles.sectionLabel}>{NIGHT_REVIEW_IDENTITIES_TITLE}</Text>
      <View style={styles.idGrid}>
        {data.identities.map((entry) => (
          <IdentityCard key={entry.seat} entry={entry} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.text,
    borderRadius: borderRadius.large,
    padding: spacing.medium,
    marginBottom: spacing.medium,
  },
  heroHeadline: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  heroSub: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: withAlpha(colors.textInverse, 0.85),
    marginTop: spacing.micro,
  },
  heroDeaths: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
    marginTop: spacing.small,
  },
  deathCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    backgroundColor: withAlpha(colors.textInverse, 0.12),
    borderWidth: fixed.borderWidth,
    borderColor: withAlpha(colors.textInverse, 0.22),
    borderRadius: borderRadius.medium,
    padding: spacing.small,
  },
  deathCardMain: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  deathCardReason: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: withAlpha(colors.textInverse, 0.85),
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    marginBottom: spacing.medium,
  },
  disclaimerText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textSecondary,
  },
  sectionLabel: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.small,
  },
  timeline: {
    position: 'relative',
  },
  timelineRail: {
    position: 'absolute',
    left: componentSizes.avatar.sm / 2,
    top: spacing.small + componentSizes.avatar.sm / 2,
    bottom: spacing.small + componentSizes.avatar.sm / 2,
    width: fixed.divider,
    backgroundColor: colors.borderLight,
  },
  eventRow: {
    flexDirection: 'row',
    gap: spacing.small,
    paddingVertical: spacing.small,
  },
  badge: {
    width: componentSizes.avatar.sm,
    height: componentSizes.avatar.sm,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventMain: {
    flex: 1,
  },
  eventHead: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  eventTitle: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  seatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
  },
  seatChipText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  actorSeatText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  eventSub: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textSecondary,
    marginTop: spacing.micro,
  },
  pill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
  },
  pillText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
    marginTop: spacing.tight,
  },
  roleChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
  },
  roleChipText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  voteGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.tight,
    marginTop: spacing.tight,
  },
  voteVoters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.micro,
  },
  voteArrow: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  noiseSection: {
    marginTop: spacing.medium,
  },
  noiseWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  noiseChip: {
    backgroundColor: colors.background,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
  },
  noiseChipText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textSecondary,
  },
  divider: {
    height: fixed.divider,
    backgroundColor: colors.border,
    marginVertical: spacing.medium,
  },
  idGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  idCard: {
    flexBasis: '30%',
    flexGrow: 1,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    padding: spacing.small,
  },
  idCardDead: {
    opacity: 0.55,
  },
  idTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  idSeat: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  idDeadTag: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    fontWeight: typography.weights.bold,
    color: colors.error,
  },
  idRole: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    marginTop: spacing.tight,
  },
});
