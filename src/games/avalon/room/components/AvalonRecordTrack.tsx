/**
 * 阿瓦隆记录共享件：五任务轨道。
 *
 * 从 AvalonHistoryOverlay 整段搬出，记录浮层与本局复盘共用同一份实现。
 * 轨道状态由本件统一推导，不许调用方各写一份：
 * - 已结算轮：成功 / 失败；否决终局轮按失败；
 * - 终局时仍在记录里的未结算轮：未完成（被打断），不是进行中；
 * - 终局后未开始的轮：未开始（提前结束），不是普通的未开始。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type {
  AvalonRoundRecordView,
  AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  textStyles,
  typography,
  withAlpha,
} from '@/theme';

import { formatAvalonQuestLabel } from '../policy/avalonInteractionPolicy';

const QUEST_TRACK_ROUNDS = [1, 2, 3, 4, 5] as const;

type QuestTrackState = 'success' | 'fail' | 'current' | 'interrupted' | 'upcoming';

function trackStateLabel(state: QuestTrackState, ended: boolean): string {
  switch (state) {
    case 'success':
      return '成功';
    case 'fail':
      return '失败';
    case 'current':
      return '进行中';
    case 'interrupted':
      return '未完成';
    case 'upcoming':
      return ended ? '未开始（提前结束）' : '未开始';
  }
}

export function AvalonRecordTrack({
  rounds,
  questResults,
  currentRound,
  activeRound,
  ended,
  testIDPrefix,
}: {
  readonly rounds: readonly AvalonRoundRecordView[];
  readonly questResults: AvalonViewModel['questResults'];
  readonly currentRound: number | undefined;
  readonly activeRound: number | undefined;
  readonly ended: boolean;
  readonly testIDPrefix?: string;
}) {
  const prefix = testIDPrefix ?? 'avalon-history-track';
  const recordByRound = new Map(rounds.map((record) => [record.round, record]));
  return (
    <View style={styles.track} testID={prefix}>
      {QUEST_TRACK_ROUNDS.map((round, index) => {
        const record = recordByRound.get(round);
        const result = record?.quest?.result ?? questResults[round - 1];
        const state: QuestTrackState =
          result === 'success'
            ? 'success'
            : result === 'fail' || record?.vetoEnded === true
              ? 'fail'
              : ended && record !== undefined
                ? 'interrupted'
                : round === currentRound
                  ? 'current'
                  : 'upcoming';
        return (
          <Fragment key={round}>
            <View style={styles.trackNode}>
              <View
                style={[
                  styles.trackDot,
                  state === 'success' ? styles.trackDotSuccess : null,
                  state === 'fail' ? styles.trackDotFail : null,
                  state === 'current' ? styles.trackDotCurrent : null,
                  state === 'interrupted' ? styles.trackDotInterrupted : null,
                ]}
                testID={`${prefix}-round-${round}`}
                accessibilityLabel={`${formatAvalonQuestLabel(round)}，${trackStateLabel(state, ended)}`}
              >
                {state === 'success' || state === 'fail' ? (
                  <Ionicons
                    name={state === 'success' ? 'checkmark' : 'close'}
                    size={componentSizes.icon.sm}
                    color={colors.textInverse}
                  />
                ) : (
                  <Text
                    style={[
                      styles.trackDotText,
                      state === 'current' ? styles.trackDotCurrentText : null,
                    ]}
                  >
                    {round}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.trackLabel,
                  round === activeRound ? styles.trackLabelActive : null,
                  state === 'current' ? styles.trackLabelCurrent : null,
                ]}
              >
                {formatAvalonQuestLabel(round)}
              </Text>
            </View>
            {index < QUEST_TRACK_ROUNDS.length - 1 ? (
              <View
                style={[
                  styles.trackLink,
                  state === 'success' || state === 'fail' ? styles.trackLinkDone : null,
                ]}
              />
            ) : null}
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.tight,
  },
  trackNode: {
    width: componentSizes.avatar.md,
    alignItems: 'center',
    gap: spacing.tight,
  },
  trackDot: {
    width: componentSizes.avatar.sm,
    height: componentSizes.avatar.sm,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackDotSuccess: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  trackDotFail: {
    borderColor: colors.error,
    backgroundColor: colors.error,
  },
  trackDotCurrent: {
    borderColor: colors.primary,
  },
  trackDotInterrupted: {
    borderColor: colors.textSecondary,
    borderStyle: 'dashed',
  },
  trackDotText: {
    ...textStyles.secondarySemibold,
    color: colors.textMuted,
  },
  trackDotCurrentText: {
    color: colors.primary,
  },
  trackLabel: {
    ...textStyles.captionSmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  trackLabelActive: {
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  trackLabelCurrent: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  trackLink: {
    flex: 1,
    height: fixed.borderWidthThick,
    borderRadius: borderRadius.full,
    backgroundColor: colors.borderLight,
    marginTop: spacing.medium,
  },
  trackLinkDone: {
    backgroundColor: withAlpha(colors.primary, 0.55),
  },
});
