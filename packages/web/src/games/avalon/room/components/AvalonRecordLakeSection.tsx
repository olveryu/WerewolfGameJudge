/**
 * 阿瓦隆对局记录共享件：单轮湖仙节。
 *
 * - 已完成：只写“持有人查验了谁 → 新持有人即被查验者”，查验结果不进
 *   记录，并保留“查验结果只给当时持有人看，不进记录”的说明——记录里
 *   看不到结果是正常的（2026-10-24 用户裁决）；带结果的完整版只在本局
 *   复盘文档里（复盘身份全公开，结果不属秘密）；
 * - 进行中：只写持有人查验进行中，不写被选目标——token 尚未移交，
 *   目标公开的时点是 acknowledge，不是 check；
 * - 终局未发生：仅终局时渲染，局中不渲染未来轮次的未发生行；原因由
 *   记录口径 formatAvalonLadySkipped 按轮次状态推导，与复盘同源。
 */
import './AvalonRecord.css';

import {
  AVALON_LADY_ROUNDS,
  type AvalonLadyCheckRecordView,
  type AvalonRoundRecordView,
} from '@game-judge/game-engine/games/avalon/public';

import { SeatDot } from '@/components/SeatDot';

import {
  formatAvalonLadyCheck,
  formatAvalonLadyHandover,
  formatAvalonLadySkipped,
} from '../avalonRecordCopy';

/** 单轮湖仙节：已完成 / 进行中 / 终局未发生三态，其余情况不渲染。 */
export function AvalonRecordLakeSection({
  afterRound,
  record,
  completed,
  inProgressHolderSeat,
  ended,
  testIdPrefix,
}: {
  readonly afterRound: number;
  readonly record: AvalonRoundRecordView;
  readonly completed: AvalonLadyCheckRecordView | null;
  readonly inProgressHolderSeat: number | null;
  readonly ended: boolean;
  readonly testIdPrefix?: string;
}) {
  const ladyRounds: readonly number[] = AVALON_LADY_ROUNDS;
  if (!ladyRounds.includes(afterRound)) return null;
  const prefix = testIdPrefix ?? `avalon-history-lake-${afterRound}`;
  if (completed !== null) {
    return (
      <section className="avalon-lake" data-testid={prefix}>
        <h4 className="avalon-lake-title">湖仙查验</h4>
        <p className="avalon-lake-line">
          <SeatDot seat={completed.holderSeat} size="sm" />
          <span>{formatAvalonLadyCheck(completed)}</span>
          <SeatDot seat={completed.targetSeat} size="sm" />
          <span>{formatAvalonLadyHandover(completed)}</span>
        </p>
        <p className="avalon-lake-note">查验结果只给当时持有人看，不进记录。</p>
      </section>
    );
  }
  if (inProgressHolderSeat !== null) {
    return (
      <section className="avalon-lake" data-testid={prefix}>
        <h4 className="avalon-lake-title">湖仙查验</h4>
        <p className="avalon-lake-line">{inProgressHolderSeat + 1} 号查验进行中</p>
      </section>
    );
  }
  if (!ended) return null;
  return (
    <section className="avalon-lake" data-testid={prefix}>
      <h4 className="avalon-lake-title">湖仙查验</h4>
      <p className="avalon-lake-line">{formatAvalonLadySkipped(record)}</p>
    </section>
  );
}
