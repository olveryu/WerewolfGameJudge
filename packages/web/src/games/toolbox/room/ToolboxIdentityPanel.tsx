/** 本人抽身份弹窗：从共享牌堆逐张抽取，手牌只在本人的弹窗里展示。 */
import './ToolboxIdentityPanel.css';

import type { ToolboxIdentityRoundView } from '@game-judge/game-engine/games/toolbox/public';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { RoomDialog } from '@/features/room/components/RoomDialog';

export interface ToolboxDrawDialogProps {
  readonly round: ToolboxIdentityRoundView;
  /** 本人按抽取顺序的手牌，元素是 `round.config.identities` 的下标。 */
  readonly hand: readonly number[];
  readonly isLocked: boolean;
  readonly onDraw: () => Promise<boolean>;
  readonly onClose: () => void;
}

/** 本人的抽身份弹窗。 */
export function ToolboxDrawDialog({
  round,
  hand,
  isLocked,
  onDraw,
  onClose,
}: ToolboxDrawDialogProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const limit = round.config.cardsPerPlayer;
  const isFull = hand.length >= limit;
  const draw = async () => {
    setIsDrawing(true);
    await onDraw().finally(() => setIsDrawing(false));
  };
  return (
    <RoomDialog
      title="抽身份"
      subtitle="只有你能看到自己抽到的身份"
      dismissOnEscape
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          完成
        </Button>
      }
    >
      <div className="toolbox-draw">
        <p>
          已抽 {hand.length} / {limit} 张 · 牌堆剩余 {round.remainingTotal} 张
        </p>
        <button
          type="button"
          className="toolbox-draw-deck"
          onClick={() => void draw()}
          disabled={isLocked || isDrawing || isFull || round.remainingTotal === 0}
          aria-busy={isDrawing}
          aria-label="抽一张身份牌"
        >
          <span aria-hidden="true">✦</span>
          <strong>抽一张</strong>
        </button>
        {isFull && <p>已抽完你的身份牌</p>}
        {hand.length > 0 && (
          <>
            <h3>我的身份</h3>
            <ol className="toolbox-draw-cards">
              {hand.map((identityIndex, order) => {
                const identity = round.config.identities[identityIndex];
                if (identity === undefined)
                  throw new Error(
                    `[FAIL-FAST] Toolbox hand index ${identityIndex} is outside the round's identity config`,
                  );
                return (
                  <li key={order}>
                    <strong>{identity.name}</strong>
                    {identity.description !== '' && <p>{identity.description}</p>}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </RoomDialog>
  );
}
