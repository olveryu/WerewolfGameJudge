/** 本人骰盅：摇、掀、固定与下次骰数。点数只来自服务端已提交的骰盅。 */
import './ToolboxDiceCup.css';

import {
  TOOLBOX_DICE_MAX_COUNT,
  TOOLBOX_DICE_MIN_COUNT,
  type ToolboxDiceCup as ToolboxDiceCupState,
} from '@game-judge/game-engine/games/toolbox/public';
import { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';
import { audioLog } from '@/utils/logger';

import { ToolboxStepper } from '../components/ToolboxStepper';
import { playDiceRattle } from './toolboxDiceSound';

const SHAKE_DURATION_MS = 1200;
const DICE_PIPS: readonly (readonly number[])[] = [
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];

type CupPresentation = 'unrolled' | 'shaking' | 'rolled' | 'revealed';

export interface ToolboxDiceCupProps {
  readonly cup: ToolboxDiceCupState;
  /** 有命令在途或连接不可提交时为 true；只禁用操作，不改变展示。 */
  readonly isLocked: boolean;
  readonly onRoll: () => Promise<boolean>;
  readonly onReveal: () => void;
  readonly onSetCount: (count: number) => void;
  readonly onToggleHold: (dieId: number) => void;
}

function describeStatus(presentation: CupPresentation): string {
  switch (presentation) {
    case 'unrolled':
      return '准备好了吗';
    case 'shaking':
      return '正在摇骰';
    case 'rolled':
      return '摇好了，自己掀开看看';
    case 'revealed':
      return '只有你能看到点数';
  }
}

/** 本人的骰盅工作区。 */
export function ToolboxDiceCup({
  cup,
  isLocked,
  onRoll,
  onReveal,
  onSetCount,
  onToggleHold,
}: ToolboxDiceCupProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isRolling, setIsRolling] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isSoundUnavailable, setIsSoundUnavailable] = useState(false);
  useEffect(() => {
    if (!isShaking) return;
    const timer = window.setTimeout(() => setIsShaking(false), SHAKE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [isShaking]);
  const presentation: CupPresentation =
    isRolling || isShaking ? 'shaking' : cup.stage === 'unrolled' ? 'unrolled' : cup.stage;
  const heldCount = cup.dice.filter((die) => die.held).length;
  const isBusy = isLocked || presentation === 'shaking';
  const roll = async () => {
    setIsRolling(true);
    if (isSoundEnabled) {
      void playDiceRattle().then(
        (isPlayed) => setIsSoundUnavailable(!isPlayed),
        (error: unknown) => {
          audioLog.warn('Toolbox dice: rattle playback failed', error);
          setIsSoundUnavailable(true);
        },
      );
    }
    const isCommitted = await onRoll().finally(() => setIsRolling(false));
    if (isCommitted && !prefersReducedMotion) setIsShaking(true);
  };
  return (
    <section className="toolbox-dice" aria-labelledby="toolbox-dice-title">
      <div className="toolbox-dice-heading">
        <h2 id="toolbox-dice-title">我的骰盅</h2>
        <label className="toolbox-dice-sound">
          <input
            type="checkbox"
            checked={isSoundEnabled}
            onChange={(event) => setIsSoundEnabled(event.currentTarget.checked)}
          />
          音效
        </label>
      </div>
      <div className="toolbox-dice-table" data-cup-state={presentation}>
        {presentation === 'revealed' ? (
          <ol className="toolbox-dice-faces" aria-label="我的骰子">
            {cup.dice.map((die, index) => (
              <li key={die.id}>
                <button
                  type="button"
                  className="toolbox-dice-die"
                  aria-pressed={die.held}
                  aria-label={`第${index + 1}颗，点数${die.value}${die.held ? '，已固定' : ''}`}
                  disabled={isBusy}
                  onClick={() => onToggleHold(die.id)}
                >
                  <span className="toolbox-dice-pips" aria-hidden="true">
                    {Array.from({ length: 9 }, (_, pip) => (
                      <span
                        key={pip}
                        className="toolbox-dice-pip"
                        data-visible={DICE_PIPS[die.value - 1]?.includes(pip)}
                      />
                    ))}
                  </span>
                  {die.held && (
                    <span className="toolbox-dice-held" aria-hidden="true">
                      固定
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <span className="toolbox-dice-cup" aria-hidden="true">
            <span className="toolbox-dice-cup-top" />
            <span className="toolbox-dice-cup-body" />
            <span className="toolbox-dice-cup-band" />
            <span className="toolbox-dice-cup-rim" />
          </span>
        )}
      </div>
      <p className="toolbox-dice-status" role="status">
        {describeStatus(presentation)}
      </p>
      {presentation === 'revealed' && (
        <p className="toolbox-dice-hint">点骰子可以固定点数，再摇时保留</p>
      )}
      {isSoundUnavailable && <p className="toolbox-dice-hint">音效不可用，仍可继续摇骰</p>}
      <div className="toolbox-dice-primary">
        {presentation === 'rolled' ? (
          <Button size="lg" disabled={isBusy} onClick={onReveal}>
            掀开骰盅
          </Button>
        ) : (
          <Button
            size="lg"
            disabled={isBusy}
            loading={presentation === 'shaking'}
            onClick={() => void roll()}
          >
            {presentation === 'revealed' ? '再摇一次' : '摇骰'}
          </Button>
        )}
      </div>
      <div className="toolbox-dice-count">
        <div>
          <strong>下次摇 {cup.targetCount} 颗</strong>
          <span>已固定 {heldCount} 颗</span>
        </div>
        <ToolboxStepper
          label="下次摇骰数量"
          value={cup.targetCount}
          unit="颗"
          min={TOOLBOX_DICE_MIN_COUNT}
          max={TOOLBOX_DICE_MAX_COUNT}
          isDisabled={isBusy}
          onChange={onSetCount}
        />
      </div>
    </section>
  );
}
