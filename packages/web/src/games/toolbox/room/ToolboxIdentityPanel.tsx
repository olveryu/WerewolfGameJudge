/** 本人身份牌：从共享牌堆抽一张，手牌只在本人打开时展示。 */
import './ToolboxIdentityPanel.css';

import type { ToolboxIdentityRoundView } from '@game-judge/game-engine/games/toolbox/public';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { RoomDialog } from '@/features/room/components/RoomDialog';

export interface ToolboxIdentityPanelProps {
  readonly round: ToolboxIdentityRoundView;
  /** 本人按抽取顺序的手牌，元素是 `round.config.identities` 的下标。 */
  readonly hand: readonly number[];
  readonly isLocked: boolean;
  readonly onDraw: () => Promise<boolean>;
}

/** 本人的身份牌工作区。 */
export function ToolboxIdentityPanel({ round, hand, isLocked, onDraw }: ToolboxIdentityPanelProps) {
  const [isHandOpen, setIsHandOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const quota = round.config.cardsPerPlayer;
  const isFull = hand.length >= quota;
  const draw = async () => {
    setIsDrawing(true);
    const isCommitted = await onDraw().finally(() => setIsDrawing(false));
    if (isCommitted) setIsHandOpen(true);
  };
  return (
    <section className="toolbox-identity" aria-labelledby="toolbox-identity-title">
      <h2 id="toolbox-identity-title">身份牌</h2>
      <button
        type="button"
        className="toolbox-identity-deck"
        disabled={isLocked || isDrawing || isFull}
        aria-busy={isDrawing}
        onClick={() => void draw()}
      >
        <span className="toolbox-identity-deck-pattern" aria-hidden="true" />
        <strong>{isFull ? '已抽满' : isDrawing ? '正在抽牌' : '抽一张'}</strong>
      </button>
      <dl className="toolbox-identity-counts">
        <div>
          <dt>我的进度</dt>
          <dd>
            已抽 {hand.length} / 每人 {quota} 张
          </dd>
        </div>
        <div>
          <dt>共享牌堆</dt>
          <dd>牌堆剩余 {round.remainingTotal} 张</dd>
        </div>
      </dl>
      {hand.length === 0 ? (
        <p className="toolbox-identity-empty">还没有抽到身份</p>
      ) : (
        <Button variant="secondary" size="lg" onClick={() => setIsHandOpen(true)}>
          我的身份牌（{hand.length}）
        </Button>
      )}
      {isHandOpen && (
        <RoomDialog
          title="我的身份牌"
          subtitle="只有你能看到"
          dismissOnEscape
          onClose={() => setIsHandOpen(false)}
          footer={
            <Button variant="secondary" onClick={() => setIsHandOpen(false)}>
              收起
            </Button>
          }
        >
          <ol className="toolbox-identity-hand">
            {hand.map((identityIndex, order) => {
              const identity = round.config.identities[identityIndex];
              if (identity === undefined) {
                throw new Error(
                  `[FAIL-FAST] Toolbox hand index ${identityIndex} is outside round ${round.roundId}`,
                );
              }
              return (
                <li key={order} data-newest={order === hand.length - 1}>
                  <span className="toolbox-identity-hand-order">第 {order + 1} 张</span>
                  <strong>{identity.name}</strong>
                  {identity.description !== '' && <p>{identity.description}</p>}
                </li>
              );
            })}
          </ol>
        </RoomDialog>
      )}
    </section>
  );
}
