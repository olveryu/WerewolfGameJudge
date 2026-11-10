/**
 * 阿瓦隆对局记录共享件：五任务轨道。
 *
 * 轨道状态由本件统一推导，不许调用方各写一份：
 * - 已结算轮：成功 / 失败；否决终局轮按失败；
 * - 终局时仍在记录里的未结算轮：未完成（被打断），不是进行中；
 * - 终局后未开始的轮：未开始（提前结束），不是普通的未开始。
 */
import './AvalonRecord.css';

import type {
  AvalonRoundRecordView,
  AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { Fragment } from 'react';

import IconCheckmark from '~icons/ion/checkmark';
import IconClose from '~icons/ion/close';

import { AVALON_INTERRUPTED_LABEL, AVALON_QUEST_RESULT_LABELS } from '../avalonRecordCopy';
import { formatAvalonQuestLabel } from '../policy/avalonInteractionPolicy';

const QUEST_TRACK_ROUNDS = [1, 2, 3, 4, 5] as const;

type QuestTrackState = 'success' | 'fail' | 'current' | 'interrupted' | 'upcoming';

function trackStateLabel(state: QuestTrackState, ended: boolean): string {
  switch (state) {
    case 'success':
    case 'fail':
      return AVALON_QUEST_RESULT_LABELS[state];
    case 'current':
      return '进行中';
    case 'interrupted':
      return AVALON_INTERRUPTED_LABEL;
    case 'upcoming':
      return ended ? '未开始（提前结束）' : '未开始';
  }
}

/** 五任务轨道：节点状态统一推导，当前查看的轮次标签加粗。 */
export function AvalonRecordTrack({
  rounds,
  questResults,
  currentRound,
  activeRound,
  ended,
}: {
  readonly rounds: readonly AvalonRoundRecordView[];
  readonly questResults: AvalonViewModel['questResults'];
  readonly currentRound: number | undefined;
  readonly activeRound: number | undefined;
  readonly ended: boolean;
}) {
  const prefix = 'avalon-history-track';
  const recordByRound = new Map(rounds.map((record) => [record.round, record]));
  return (
    <div className="avalon-track" data-testid={prefix}>
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
        const isSettled = state === 'success' || state === 'fail';
        return (
          <Fragment key={round}>
            <div className="avalon-track-node">
              <span
                className="avalon-track-dot"
                data-state={state}
                role="img"
                aria-label={`${formatAvalonQuestLabel(round)}，${trackStateLabel(state, ended)}`}
                data-testid={`${prefix}-round-${round}`}
              >
                {state === 'success' && <IconCheckmark aria-hidden />}
                {state === 'fail' && <IconClose aria-hidden />}
                {!isSettled && <span aria-hidden>{round}</span>}
              </span>
              <span
                className="avalon-track-label"
                data-active={round === activeRound}
                data-state={state}
                aria-hidden
              >
                {formatAvalonQuestLabel(round)}
              </span>
            </div>
            {index < QUEST_TRACK_ROUNDS.length - 1 && (
              <span className="avalon-track-link" data-done={isSettled} aria-hidden />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
