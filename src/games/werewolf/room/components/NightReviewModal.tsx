/**
 * NightReviewModal - Night action review modal (for judge/spectator)
 *
 * Renders structured NightReviewData entries: one event row per night action
 * (category badge + seat dots + result pill) and a faction-colored identity grid.
 * No service imports, no business logic; all facts come from NightReview.helpers.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import {
  Faction,
  getRoleDisplayName,
  ROLE_SPECS,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import type React from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { CloseButton } from '@/components/CloseButton';
import { STATUS_ICONS } from '@/config/iconTokens';
import { TESTIDS } from '@/testids';
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
  type NightReviewActionEntry,
  type NightReviewData,
  type NightReviewIdentityEntry,
} from '../NightReview.helpers';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface NightReviewModalProps {
  visible: boolean;
  data: NightReviewData;
  onClose: () => void;
}

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

function SeatDot({ seat }: { readonly seat: number }) {
  return (
    <View style={styles.seatDot}>
      <Text style={styles.seatDotText}>{seat + 1}</Text>
    </View>
  );
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
  readonly muted?: boolean;
  readonly children: ReactNode;
}

/** One action event row: category badge + content column. */
function EventRow({ icon, color, muted, children }: EventRowProps) {
  return (
    <View style={styles.eventRow}>
      <View style={[styles.badge, { backgroundColor: color }, muted ? styles.badgeMuted : null]}>
        <Ionicons name={icon} size={componentSizes.icon.sm} color={colors.textInverse} />
      </View>
      <View style={styles.eventMain}>{children}</View>
    </View>
  );
}

interface EventHeadProps {
  readonly title: string;
  readonly muted?: boolean;
  readonly seats?: readonly number[];
  readonly pill?: { readonly text: string; readonly tone: PillTone };
  readonly children?: ReactNode;
}

/** Title line of an event row: bold label, seat dots, result pill, inline extras. */
function EventHead({ title, muted, seats, pill, children }: EventHeadProps) {
  return (
    <View style={styles.eventHead}>
      <Text style={[styles.eventTitle, muted ? styles.eventTitleMuted : null]}>{title}</Text>
      {seats?.map((seat) => (
        <SeatDot key={seat} seat={seat} />
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
// Action entry rendering
// ─────────────────────────────────────────────────────────────────────────────

function checkResultTone(result: string): PillTone {
  if (result === '狼人') return 'bad';
  if (result === '好人') return 'good';
  return 'neutral';
}

function NightReviewActionRow({
  entry,
  deadSeats,
}: {
  readonly entry: NightReviewActionEntry;
  readonly deadSeats: ReadonlySet<number>;
}) {
  switch (entry.kind) {
    case 'bottomCards':
      return (
        <EventRow icon="layers-outline" color={colors.third}>
          <EventHead title="底牌组成" />
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
          <EventHead title={`${getRoleDisplayName(entry.actorRoleId)}选择了`}>
            <RoleChip roleId={entry.chosenRoleId} />
          </EventHead>
        </EventRow>
      );
    case 'cupidLink':
      return (
        <EventRow icon="heart" color={colors.third}>
          <EventHead title="丘比特连线" seats={entry.seats} />
        </EventRow>
      );
    case 'wolfAttack': {
      const targets = [...new Set(entry.votes.map((v) => v.targetSeat))];
      const sharedTarget = targets.length === 1 ? targets[0] : undefined;
      return (
        <EventRow icon="moon" color={colors.wolf}>
          <EventHead
            title="狼人袭击"
            pill={
              sharedTarget !== undefined && deadSeats.has(sharedTarget)
                ? { text: '出局', tone: 'bad' }
                : undefined
            }
          />
          <View style={styles.chipWrap}>
            {entry.votes.map((vote, i) => (
              <View key={`${vote.voterSeat}-${i}`} style={styles.voteChip}>
                <SeatDot seat={vote.voterSeat} />
                <Text style={styles.voteArrow}>→</Text>
                <SeatDot seat={vote.targetSeat} />
              </View>
            ))}
          </View>
          {sharedTarget !== undefined ? <EventSub text="狼队共同目标" /> : null}
        </EventRow>
      );
    }
    case 'wolfNoTarget':
      return (
        <EventRow icon="moon" color={colors.wolf}>
          <EventHead title="狼人空刀" />
          <EventSub text="未选择目标" />
        </EventRow>
      );
    case 'wolfGiveUp':
      return (
        <EventRow icon="moon" color={colors.wolf}>
          <EventHead title="狼人放弃袭击" />
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
          <EventHead title={`${getRoleDisplayName('nightmare')}封锁`} seats={[entry.targetSeat]} />
          {entry.targetRoleId ? (
            <EventSub text={`${getRoleDisplayName(entry.targetRoleId)}，技能无效`} />
          ) : null}
        </EventRow>
      );
    case 'nightmareIdle':
      return (
        <EventRow icon="eye-off-outline" color={colors.wolf} muted>
          <EventHead title={`${getRoleDisplayName('nightmare')}未封锁`} muted />
        </EventRow>
      );
    case 'shelter':
      return (
        <EventRow icon="umbrella-outline" color={colors.wolf}>
          <EventHead
            title={`${getRoleDisplayName('eclipseWolfQueen')}庇护`}
            seats={[entry.targetSeat]}
          />
        </EventRow>
      );
    case 'shelterIdle':
      return (
        <EventRow icon="umbrella-outline" color={colors.wolf} muted>
          <EventHead title={`${getRoleDisplayName('eclipseWolfQueen')}未庇护`} muted />
        </EventRow>
      );
    case 'hiddenWolfConfirmed':
      return (
        <EventRow icon="people-outline" color={colors.wolf}>
          <EventHead title={`${getRoleDisplayName('hiddenWolf')}已确认狼同伴`} />
        </EventRow>
      );
    case 'guard':
      return (
        <EventRow icon="shield" color={colors.info}>
          <EventHead title="守卫守护" seats={[entry.targetSeat]} />
        </EventRow>
      );
    case 'guardIdle':
      return (
        <EventRow icon="shield" color={colors.info} muted>
          <EventHead title="守卫未守护" muted />
        </EventRow>
      );
    case 'silence':
      return (
        <EventRow icon="mic-off-outline" color={colors.third}>
          <EventHead title="禁言长老禁言" seats={[entry.targetSeat]} />
        </EventRow>
      );
    case 'silenceIdle':
      return (
        <EventRow icon="mic-off-outline" color={colors.third} muted>
          <EventHead title="禁言长老未禁言" muted />
        </EventRow>
      );
    case 'voteban':
      return (
        <EventRow icon="ban-outline" color={colors.third}>
          <EventHead title="禁票长老禁票" seats={[entry.targetSeat]} />
        </EventRow>
      );
    case 'votebanIdle':
      return (
        <EventRow icon="ban-outline" color={colors.third} muted>
          <EventHead title="禁票长老未禁票" muted />
        </EventRow>
      );
    case 'save':
      return (
        <EventRow icon="medkit-outline" color={colors.success}>
          <EventHead title="女巫使用解药救了" seats={[entry.targetSeat]} />
        </EventRow>
      );
    case 'poison':
      return (
        <EventRow icon="flask-outline" color={colors.error}>
          <EventHead
            title={entry.actorRoleId === 'poisoner' ? '毒师毒杀' : '女巫使用毒药毒杀'}
            seats={[entry.targetSeat]}
            pill={deadSeats.has(entry.targetSeat) ? { text: '出局', tone: 'bad' } : undefined}
          />
        </EventRow>
      );
    case 'witchIdleAll':
      return (
        <EventRow icon="medkit-outline" color={colors.success} muted>
          <EventHead title="女巫" muted />
          <EventSub text="未使用解药 · 未使用毒药" />
        </EventRow>
      );
    case 'witchNoSave':
      return (
        <EventRow icon="medkit-outline" color={colors.success} muted>
          <EventHead title="女巫未使用解药" muted />
        </EventRow>
      );
    case 'witchNoPoison':
      return (
        <EventRow icon="flask-outline" color={colors.error} muted>
          <EventHead title="女巫未使用毒药" muted />
        </EventRow>
      );
    case 'poisonerNoPoison':
      return (
        <EventRow icon="flask-outline" color={colors.error} muted>
          <EventHead title="毒师未使用毒药" muted />
        </EventRow>
      );
    case 'curse':
      return (
        <EventRow icon="sparkles-outline" color={colors.third}>
          <EventHead title="乌鸦诅咒" seats={[entry.targetSeat]} />
        </EventRow>
      );
    case 'curseIdle':
      return (
        <EventRow icon="sparkles-outline" color={colors.third} muted>
          <EventHead title="乌鸦未诅咒" muted />
        </EventRow>
      );
    case 'dream':
      return (
        <EventRow icon="bed-outline" color={colors.god}>
          <EventHead title="摄梦人摄梦" seats={[entry.targetSeat]} />
        </EventRow>
      );
    case 'dreamIdle':
      return (
        <EventRow icon="bed-outline" color={colors.god} muted>
          <EventHead title="摄梦人未摄梦" muted />
        </EventRow>
      );
    case 'swap':
      return (
        <EventRow icon="swap-horizontal" color={colors.god}>
          <EventHead title="魔术师交换" seats={entry.seats} />
        </EventRow>
      );
    case 'swapIdle':
      return (
        <EventRow icon="swap-horizontal" color={colors.god} muted>
          <EventHead title="魔术师未交换" muted />
        </EventRow>
      );
    case 'idolChoice':
      return (
        <EventRow icon="star-outline" color={colors.third}>
          <EventHead
            title={`${getRoleDisplayName(entry.actorRoleId)}选择榜样`}
            seats={[entry.targetSeat]}
          />
        </EventRow>
      );
    case 'mimic':
      return (
        <EventRow icon="copy-outline" color={factionColor('shadow')}>
          <EventHead
            title="影子模仿"
            seats={[entry.targetSeat]}
            pill={entry.isBound ? { text: '绑定', tone: 'neutral' } : undefined}
          />
        </EventRow>
      );
    case 'avengerConfirmed':
      return (
        <EventRow icon="flag-outline" color={factionColor('avenger')}>
          <EventHead title="复仇者已确认阵营" />
        </EventRow>
      );
    case 'charm':
      return (
        <EventRow icon="heart-outline" color={colors.wolf}>
          <EventHead title="狼美人魅惑" seats={[entry.targetSeat]} />
        </EventRow>
      );
    case 'charmIdle':
      return (
        <EventRow icon="heart-outline" color={colors.wolf} muted>
          <EventHead title="狼美人未魅惑" muted />
        </EventRow>
      );
    case 'convert':
      return (
        <EventRow icon="repeat-outline" color={colors.wolf}>
          <EventHead
            title={`${getRoleDisplayName('awakenedGargoyle')}转化`}
            seats={[entry.targetSeat]}
          />
        </EventRow>
      );
    case 'hypnotize':
      return (
        <EventRow icon="musical-notes-outline" color={colors.third}>
          <EventHead title="吹笛者催眠" seats={entry.targetSeats} />
        </EventRow>
      );
    case 'hypnotizeIdle':
      return (
        <EventRow icon="musical-notes-outline" color={colors.third} muted>
          <EventHead title="吹笛者未催眠" muted />
        </EventRow>
      );
    case 'check':
      return (
        <EventRow icon="eye" color={factionColor(entry.actorRoleId)}>
          <EventHead
            title={`${getRoleDisplayName(entry.actorRoleId)}查验`}
            seats={[entry.targetSeat]}
            pill={{ text: entry.result, tone: checkResultTone(entry.result) }}
          />
        </EventRow>
      );
    case 'checkIdle':
      return (
        <EventRow icon="eye" color={factionColor(entry.actorRoleId)} muted>
          <EventHead title={`${getRoleDisplayName(entry.actorRoleId)}未查验`} muted />
        </EventRow>
      );
    case 'learn':
      return (
        <EventRow icon="book-outline" color={colors.wolf}>
          <EventHead title={`${getRoleDisplayName('wolfRobot')}学习`} seats={[entry.targetSeat]}>
            <RoleChip roleId={entry.learnedRoleId} />
          </EventHead>
        </EventRow>
      );
    case 'learnIdle':
      return (
        <EventRow icon="book-outline" color={colors.wolf} muted>
          <EventHead title={`${getRoleDisplayName('wolfRobot')}未学习`} muted />
        </EventRow>
      );
    case 'shootStatus':
      return (
        <EventRow icon="locate-outline" color={factionColor(entry.actorRoleId)}>
          <EventHead
            title={getRoleDisplayName(entry.actorRoleId)}
            pill={
              entry.canShoot
                ? { text: '可以发动技能', tone: 'success' }
                : { text: '不能发动技能', tone: 'neutral' }
            }
          />
        </EventRow>
      );
    case 'infectConverted':
      return (
        <EventRow icon="bug-outline" color={colors.wolf}>
          <EventHead
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
            title={`${getRoleDisplayName('seedWolf')}感染`}
            seats={[entry.targetSeat]}
            pill={{ text: '失败', tone: 'bad' }}
          />
        </EventRow>
      );
    case 'infectIdle':
      return (
        <EventRow icon="bug-outline" color={colors.wolf} muted>
          <EventHead title={`${getRoleDisplayName('seedWolf')}未使用感染`} muted />
        </EventRow>
      );
    case 'guardSaveConflict':
      return (
        <EventRow icon={STATUS_ICONS.WARNING} color={colors.warning}>
          <EventHead title="同守同救" seats={[entry.targetSeat]} />
          <EventSub text="仍然死亡" />
        </EventRow>
      );
    case 'poisonImmune':
      return (
        <EventRow icon={STATUS_ICONS.WARNING} color={colors.warning}>
          <EventHead title="免疫毒药" seats={[entry.targetSeat]}>
            <RoleChip roleId={entry.targetRoleId} />
          </EventHead>
        </EventRow>
      );
    case 'reflectDamage':
      return (
        <EventRow icon={STATUS_ICONS.WARNING} color={colors.warning}>
          <EventHead
            title={`${getRoleDisplayName(entry.checkerRoleId)}查验`}
            seats={[entry.targetSeat]}
            pill={{ text: '反伤', tone: 'warn' }}
          />
          <EventSub text={`目标：${getRoleDisplayName(entry.targetRoleId)}`} />
        </EventRow>
      );
    case 'peacefulNight':
      return (
        <EventRow icon={STATUS_ICONS.PEACEFUL_NIGHT} color={colors.primary}>
          <EventHead title="昨夜平安夜" />
        </EventRow>
      );
    case 'deaths':
      return (
        <EventRow icon={STATUS_ICONS.DEATH} color={colors.error}>
          <EventHead title="死亡" />
          <View style={styles.chipWrap}>
            {entry.deaths.map((death) => (
              <View key={death.seat} style={styles.deathChip}>
                <SeatDot seat={death.seat} />
                {death.reason ? (
                  <Text style={styles.deathReason}>{DEATH_REASON_LABELS[death.reason]}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </EventRow>
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
  const roleText = entry.isEmptySeat
    ? '空座'
    : entry.roleId
      ? getRoleDisplayName(entry.roleId)
      : '未分配';
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
        {roleText}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────

export const NightReviewModal: React.FC<NightReviewModalProps> = ({ visible, data, onClose }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const contentStyle = useMemo(
    () => ({ width: screenWidth * 0.88, maxHeight: screenHeight * 0.75 }),
    [screenWidth, screenHeight],
  );

  const deadSeats = useMemo(
    () => new Set(data.identities.filter((entry) => !entry.isAlive).map((entry) => entry.seat)),
    [data.identities],
  );

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      contentStyle={contentStyle}
      testID={TESTIDS.nightReviewModal}
      dismissOnOverlayPress
    >
      <CloseButton onPress={onClose} />

      <Text style={styles.title}>本局复盘</Text>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Fair play reminder */}
        <View style={styles.disclaimerRow}>
          <View style={styles.disclaimerChip}>
            <Ionicons
              name={STATUS_ICONS.WARNING}
              size={typography.secondary}
              color={colors.warning}
            />
            <Text style={styles.disclaimerText}>仅供裁判及观战者参考</Text>
          </View>
        </View>

        {/* Action summary section */}
        <Text style={styles.sectionLabel}>第一夜 · 行动</Text>
        <View>
          {data.actions.map((entry, i) => (
            <View key={`action-${i}`} style={i > 0 ? styles.eventDivider : null}>
              <NightReviewActionRow entry={entry} deadSeats={deadSeats} />
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Identity grid section */}
        <Text style={styles.sectionLabel}>全员身份</Text>
        <View style={styles.idGrid}>
          {data.identities.map((entry) => (
            <IdentityCard key={entry.seat} entry={entry} />
          ))}
        </View>
      </ScrollView>
    </BaseCenterModal>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.medium,
  },
  scrollView: {
    flex: 1,
  },
  disclaimerRow: {
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  disclaimerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    backgroundColor: withAlpha(colors.warning, 0.12),
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
  },
  disclaimerText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.warning,
    fontWeight: typography.weights.semibold,
  },
  sectionLabel: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.small,
  },
  eventRow: {
    flexDirection: 'row',
    gap: spacing.small,
    paddingVertical: spacing.small,
  },
  eventDivider: {
    borderTopWidth: fixed.divider,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
  },
  badge: {
    width: componentSizes.avatar.sm,
    height: componentSizes.avatar.sm,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMuted: {
    opacity: 0.55,
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
  eventTitleMuted: {
    color: colors.textSecondary,
  },
  eventSub: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textSecondary,
    marginTop: spacing.micro,
  },
  seatDot: {
    width: componentSizes.avatar.xs,
    height: componentSizes.avatar.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatDotText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: colors.text,
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
  voteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.tight,
    paddingVertical: spacing.micro,
  },
  voteArrow: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  deathChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.tight,
    paddingVertical: spacing.micro,
  },
  deathReason: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.text,
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
