/** 本人骰盅弹窗：摇、掀、固定与下次骰数。点数只来自服务端已提交的骰盅。 */
import './ToolboxDiceCup.css';

import {
  TOOLBOX_DICE_MAX_COUNT,
  TOOLBOX_DICE_MIN_COUNT,
  type ToolboxDiceCup as ToolboxDiceCupState,
} from '@game-judge/game-engine/games/toolbox/public';
import { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { GameSettingsHint, GameSettingsSection } from '@/components/GameSettings';
import { Stepper } from '@/components/Stepper';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';
import { TESTIDS } from '@/testids';
import { audioLog } from '@/utils/logger';

import { parseToolboxCountInput } from '../config/toolboxIdentityDraft';
import { playDiceRattle } from './toolboxDiceSound';

const SHAKE_DURATION_MS = 1400;
const DICE_PIPS: readonly (readonly number[])[] = [
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];

type CupPresentation = 'empty' | 'shaking' | 'closed' | 'open';

const CUP_STATUS: Readonly<Record<CupPresentation, string>> = {
  empty: '还没有摇骰',
  shaking: '正在摇骰…',
  closed: '骰盅已摇好，点击骰盅查看',
  open: '只有你能看到骰子',
};

export interface ToolboxDiceDialogProps {
  readonly cup: ToolboxDiceCupState;
  /** 有命令在途或连接不可提交时为 true；只禁用操作，不改变展示。 */
  readonly isLocked: boolean;
  readonly onRoll: () => Promise<boolean>;
  readonly onReveal: () => void;
  readonly onSetCount: (count: number) => Promise<boolean>;
  readonly onToggleHold: (dieId: number) => void;
  readonly onClose: () => void;
}

/** 摇骰时的晃动与音效；动画只在摇骰命令提交成功后播放。 */
function useDiceRoll(onRoll: () => Promise<boolean>) {
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
  const roll = async () => {
    setIsRolling(true);
    setIsSoundUnavailable(false);
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
    return isCommitted;
  };
  return {
    isShaking: isRolling || isShaking,
    isSoundEnabled,
    setIsSoundEnabled,
    isSoundUnavailable,
    roll,
  };
}

/** 本人的骰盅弹窗；盖上骰盅只是本机展示，掀开由房间保存。 */
export function ToolboxDiceDialog({
  cup,
  isLocked,
  onRoll,
  onReveal,
  onSetCount,
  onToggleHold,
  onClose,
}: ToolboxDiceDialogProps) {
  const dice = useDiceRoll(onRoll);
  const [isCovered, setIsCovered] = useState(false);
  const [countDraft, setCountDraft] = useState<string | null>(null);
  const presentation: CupPresentation = dice.isShaking
    ? 'shaking'
    : cup.stage === 'unrolled'
      ? 'empty'
      : cup.stage === 'rolled' || isCovered
        ? 'closed'
        : 'open';
  const heldCount = cup.dice.filter((die) => die.held).length;
  const minimumCount = Math.max(TOOLBOX_DICE_MIN_COUNT, heldCount);
  const isBusy = isLocked || presentation === 'shaking';
  const roll = async () => {
    if (await dice.roll()) setIsCovered(false);
  };
  const toggleCup = () => {
    if (cup.stage === 'rolled') onReveal();
    else setIsCovered(!isCovered);
  };
  const changeCountText = (text: string) => {
    if (isBusy) return;
    setCountDraft(text);
    const count = parseToolboxCountInput(text);
    if (
      !Number.isInteger(count) ||
      count < minimumCount ||
      count > TOOLBOX_DICE_MAX_COUNT ||
      count === cup.targetCount
    )
      return;
    void onSetCount(count).finally(() => setCountDraft(null));
  };
  return (
    <RoomDialog
      title="我的骰盅"
      dismissOnEscape
      onClose={onClose}
      footer={
        <Button disabled={isBusy} onClick={() => void roll()}>
          摇骰
        </Button>
      }
    >
      <div className="toolbox-dice">
        <div className="toolbox-dice-heading">
          <label className="toolbox-dice-sound">
            <input
              type="checkbox"
              checked={dice.isSoundEnabled}
              onChange={(event) => dice.setIsSoundEnabled(event.currentTarget.checked)}
            />
            音效
          </label>
        </div>
        <div className="toolbox-dice-table" data-cup-state={presentation}>
          <div className="toolbox-dice-table-caption" aria-hidden="true">
            DICE CUP
          </div>
          <button
            type="button"
            className="toolbox-dice-cup-button"
            disabled={isBusy || presentation === 'empty'}
            onClick={toggleCup}
            aria-label={presentation === 'open' ? '盖上骰盅' : '掀开骰盅'}
          >
            <span className="toolbox-dice-cup-illustration" aria-hidden="true">
              <span className="toolbox-dice-cup-top" />
              <span className="toolbox-dice-cup-body" />
              <span className="toolbox-dice-cup-band" />
              <span className="toolbox-dice-cup-rim" />
            </span>
          </button>
          {presentation === 'open' && (
            <ol className="toolbox-dice-faces" aria-label="我的骰子">
              {cup.dice.map((die, index) => (
                <li key={die.id}>
                  <button
                    type="button"
                    className="toolbox-dice-die"
                    aria-label={`第${index + 1}颗骰子 ${die.value}点`}
                    aria-pressed={die.held}
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
          )}
        </div>
        <p className="toolbox-dice-status" role="status">
          {CUP_STATUS[presentation]}
        </p>
        {dice.isSoundUnavailable && <p role="status">音效不可用，仍可继续摇骰。</p>}
        {presentation === 'open' && (
          <p className="toolbox-dice-hint">点击骰子固定点数，再摇时保留</p>
        )}
        <GameSettingsSection>
          <Stepper
            label="骰子数量"
            entry={{
              kind: 'text',
              value: countDraft ?? String(cup.targetCount),
              onChangeText: changeCountText,
            }}
            onDecrement={() => void onSetCount(cup.targetCount - 1)}
            onIncrement={() => void onSetCount(cup.targetCount + 1)}
            isDecrementDisabled={isBusy || cup.targetCount <= minimumCount}
            isIncrementDisabled={isBusy || cup.targetCount >= TOOLBOX_DICE_MAX_COUNT}
            decrementLabel="减少骰子数量"
            incrementLabel="增加骰子数量"
            testId={TESTIDS.toolboxDiceCount}
            decrementTestId={TESTIDS.toolboxDiceCountDecrement}
            incrementTestId={TESTIDS.toolboxDiceCountIncrement}
          />
          <GameSettingsHint>
            下次摇骰生效{heldCount > 0 ? ` · 已固定 ${heldCount} 颗` : ''}
          </GameSettingsHint>
          {heldCount > 0 && cup.targetCount === heldCount && (
            <GameSettingsHint>取消固定后可继续减少数量</GameSettingsHint>
          )}
        </GameSettingsSection>
      </div>
    </RoomDialog>
  );
}
