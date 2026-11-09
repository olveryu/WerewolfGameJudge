/**
 * 阿瓦隆对局记录：任务轨道与分轮 tab 在前，结论横幅居中，提案与表决
 * 时间线在后，湖仙节在每轮末。只用座位号，不显示玩家名。
 *
 * 公投记个人票，暗投只记数量；任务出牌人不揭晓；未结算提案只露进度
 * 与本人的一票；湖仙只写“查验了谁”，结果不进记录。浮层手动开关，
 * 不自动消失，终局保留。轨道 / 轮次 / 提案 / 湖仙四件是共享件，
 * 本文件只留浮层壳（头、tab、滚动、关闭）与数据投影。
 * 挂载即打开：每次打开都是新实例，默认 tab 回到当前轮。
 */
import './AvalonRecord.css';

import {
  type AvalonViewModel,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';
import { useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';

import { formatAvalonQuestSizes, formatAvalonVoteMode } from '../avalonRecordCopy';
import { formatAvalonQuestLabel } from '../policy/avalonInteractionPolicy';
import { AvalonRecordRound } from './AvalonRecordRound';
import { AvalonRecordTrack } from './AvalonRecordTrack';

/** 对局记录浮层：tab 只含已开始轮次，默认当前轮；只渲染权威记录投影。 */
export function AvalonHistoryOverlay({
  viewModel,
  onClose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly onClose: () => void;
}) {
  const rounds = viewModel.roundHistory;
  const ended = viewModel.phase === 'ended';
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const active =
    rounds.find((record) => record.round === selectedRound) ?? rounds[rounds.length - 1];
  const latestRecord = rounds[rounds.length - 1];
  // 终局后没有“当前轮”：未结算轮是被打断的，不是进行中的。
  const currentRound =
    ended || latestRecord === undefined || latestRecord.quest !== null || latestRecord.vetoEnded
      ? undefined
      : latestRecord.round;
  const successCount = viewModel.questResults.filter((result) => result === 'success').length;
  const failCount = viewModel.questResults.filter((result) => result === 'fail').length;
  const questSizes = isAvalonPlayerCount(viewModel.playerCount)
    ? formatAvalonQuestSizes(viewModel.playerCount)
    : null;
  // 湖仙进行中只属于最后已结算轮的下一节：lady 阶段发生在该轮结算后。
  const latestSettledRound = rounds.filter((record) => record.quest !== null).at(-1)?.round;
  return (
    <BottomSheet title="对局记录" onClose={onClose} testId="avalon-history-overlay">
      <div className="avalon-history-sheet">
        <div className="avalon-history-header">
          <h2 className="avalon-history-title">对局记录</h2>
          <p
            className="avalon-history-score"
            aria-label={`成功 ${successCount} · 失败 ${failCount}`}
          >
            成功 <span className="avalon-history-score-success">{successCount}</span> · 失败{' '}
            <span className="avalon-history-score-fail">{failCount}</span>
          </p>
        </div>
        <p className="avalon-history-config">
          投票{formatAvalonVoteMode(viewModel.voteMode)} · 否决上限 {viewModel.vetoLimit}
          {questSizes !== null ? ` · 任务人数 ${questSizes}` : ''}
        </p>
        <AvalonRecordTrack
          rounds={rounds}
          questResults={viewModel.questResults}
          currentRound={currentRound}
          activeRound={active?.round}
          ended={ended}
        />
        {rounds.length > 0 && (
          <div className="avalon-history-tabs" role="tablist" aria-label="轮次">
            {rounds.map((record) => {
              const isActive = active !== undefined && record.round === active.round;
              return (
                <button
                  key={record.round}
                  type="button"
                  role="tab"
                  className="avalon-history-tab"
                  aria-selected={isActive}
                  data-testid={`avalon-history-tab-${record.round}`}
                  onClick={() => setSelectedRound(record.round)}
                >
                  {formatAvalonQuestLabel(record.round)}
                </button>
              );
            })}
          </div>
        )}
        <div className="avalon-history-scroll" role={rounds.length > 0 ? 'tabpanel' : undefined}>
          {active === undefined ? (
            <p className="avalon-history-empty">暂无对局记录。</p>
          ) : (
            <AvalonRecordRound
              key={active.round}
              record={active}
              completedLadyCheck={
                viewModel.ladyHistory.find((record) => record.afterRound === active.round) ?? null
              }
              inProgressLadyHolderSeat={
                viewModel.lady !== null && latestSettledRound === active.round
                  ? viewModel.lady.holderSeat
                  : null
              }
              ended={ended}
            />
          )}
        </div>
        <Button variant="secondary" size="lg" onClick={onClose} data-testid="avalon-history-close">
          关闭
        </Button>
      </div>
    </BottomSheet>
  );
}
