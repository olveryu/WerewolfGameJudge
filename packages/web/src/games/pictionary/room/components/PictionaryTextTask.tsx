/** Pictionary text task: write the opening prompt or guess the previous drawing. */

import {
  createPictionaryCommand,
  getPictionaryRelayStepCount,
  getPictionaryTextGraphemeCount,
  isValidPictionaryText,
  PICTIONARY_TEXT_MAX_LENGTH,
  type PictionaryState,
  type PictionaryTask,
} from '@game-judge/game-engine/games/pictionary/public';
import { randomPick } from '@game-judge/game-engine/platform/random';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { RoomTaskFrame } from '@/features/room/components/RoomTaskFrame';
import { TESTIDS } from '@/testids';
import IconAlertCircleOutline from '~icons/ion/alert-circle-outline';

import { PictionaryDrawingImage } from './PictionaryDrawingImage';
import {
  PICTIONARY_STAGE_MAX_WIDTH,
  PictionaryTaskHeading,
  PictionaryTaskMedia,
  type PictionaryTaskViewProps,
} from './PictionaryTaskLayout';

const PICTIONARY_OPENING_PROMPT_EXAMPLES = [
  '月球上的猫',
  '骑单车的熊猫',
  '撑雨伞的蘑菇',
  '吃西瓜的雪人',
  '坐地铁的外星人',
  '在云朵上钓鱼',
  '给太阳戴墨镜',
  '背着书包的恐龙',
  '穿拖鞋的企鹅',
  '火山里煮火锅',
  '骑扫帚送外卖',
  '海底开生日派对',
  '会飞的冰箱',
  '长出翅膀的西瓜',
  '在彩虹上滑滑梯',
  '用面条织围巾',
  '抱着月亮睡觉',
  '蜗牛开赛车',
  '章鱼打鼓',
  '长颈鹿打篮球',
  '机器人放风筝',
  '兔子在月亮上露营',
  '鸭子当船长',
  '猫咪给鱼拍照',
  '刺猬卖气球',
  '雪人泡温泉',
  '小狗开挖掘机',
  '螃蟹剪头发',
  '吐泡泡的茶壶',
  '热气球上吃早餐',
] as const;

function getTextValidationMessage(text: string): string | null {
  if (getPictionaryTextGraphemeCount(text) === 0) return '请输入一个词语或短句';
  if (text.length > PICTIONARY_TEXT_MAX_LENGTH) {
    return `最多输入 ${PICTIONARY_TEXT_MAX_LENGTH} 个字符`;
  }
  return null;
}

function PreviousDrawing({
  state,
  task,
  controlledSeat,
}: {
  readonly state: PictionaryState;
  readonly task: PictionaryTask;
  readonly controlledSeat: number | null;
}) {
  const previousEntry = task.previousEntry;
  if (previousEntry === null) {
    throw new Error('[FAIL-FAST] Pictionary text task requires a previous entry');
  }
  if (previousEntry.kind === 'missed') {
    return (
      <p className="pictionary-missed-context">
        <IconAlertCircleOutline aria-hidden />
        上一棒未完成，请自由发挥
      </p>
    );
  }
  if (previousEntry.kind !== 'drawing') {
    throw new Error('[FAIL-FAST] Pictionary text task requires a drawing context');
  }
  return (
    <section className="pictionary-context-block">
      <p className="pictionary-label">上一棒画作</p>
      <PictionaryTaskMedia>
        <PictionaryDrawingImage
          roomCode={state.roomCode}
          entryId={previousEntry.id}
          label="上一棒画作"
          controlledSeat={controlledSeat}
        />
      </PictionaryTaskMedia>
    </section>
  );
}

/** Opening prompt (step 0) or guess of the previous drawing, with a ready toggle. */
export function PictionaryTextTask({
  inputs,
  state,
  task,
  effectiveSeat,
  submit,
  isSubmitting,
  controlledSeat,
  isExpired,
}: PictionaryTaskViewProps) {
  const [text, setText] = useState(() => {
    const input = inputs.get(effectiveSeat);
    if (input !== undefined && typeof input !== 'string') {
      throw new Error('[FAIL-FAST] Expected Pictionary text input');
    }
    return input ?? '';
  });
  const [openingPromptExample] = useState(() => randomPick(PICTIONARY_OPENING_PROMPT_EXAMPLES));
  const validationMessage = getTextValidationMessage(text);
  const graphemeCount = getPictionaryTextGraphemeCount(text);
  const isOpeningPrompt = state.stepIndex === 0;
  const isReady = state.readySeats.includes(effectiveSeat);
  if (isOpeningPrompt && task.previousEntry !== null) {
    throw new Error('[FAIL-FAST] Opening Pictionary prompt cannot have previous context');
  }
  if (!isOpeningPrompt && task.previousEntry === null) {
    throw new Error('[FAIL-FAST] Pictionary guess requires previous context');
  }

  const updateText = (nextText: string): void => {
    setText(nextText);
    inputs.set(effectiveSeat, nextText);
  };

  const toggleReady = (): void => {
    if (!isReady && !isValidPictionaryText(text)) return;
    void submit(
      isReady ? '继续编辑' : '完成编辑',
      createPictionaryCommand(
        state,
        { type: 'pictionary.task.ready.set', isReady: !isReady },
        effectiveSeat,
      ),
      { controlledSeat, durable: true },
    );
  };

  const statusText =
    text.length > 0 && validationMessage !== null ? validationMessage : isReady ? '已就绪' : '';

  return (
    <RoomTaskFrame
      header={
        <PictionaryTaskHeading
          eyebrow={`第 ${state.stepIndex + 1} / ${getPictionaryRelayStepCount(state.config.numberOfPlayers)} 棒`}
          title={isOpeningPrompt ? '写下一个题目' : '猜猜画的是什么'}
        />
      }
      maxWidth={PICTIONARY_STAGE_MAX_WIDTH}
      testId={TESTIDS.pictionaryStageFrame}
      className="pictionary-task-frame"
      footer={
        <Button
          variant={isReady ? 'secondary' : 'primary'}
          onClick={toggleReady}
          disabled={(!isReady && validationMessage !== null) || isExpired}
          loading={isSubmitting}
          data-testid={TESTIDS.pictionaryTextSubmitButton}
        >
          {isReady ? '继续编辑' : '完成编辑'}
        </Button>
      }
    >
      {!isOpeningPrompt && (
        <PreviousDrawing state={state} task={task} controlledSeat={controlledSeat} />
      )}
      <div className="pictionary-composer" data-opening={isOpeningPrompt || undefined}>
        <textarea
          className="pictionary-text-input"
          value={text}
          onChange={(event) => updateText(event.target.value)}
          readOnly={isReady || isSubmitting || isExpired}
          maxLength={PICTIONARY_TEXT_MAX_LENGTH}
          placeholder={isOpeningPrompt ? `例如：${openingPromptExample}` : '写下你的猜测'}
          aria-label={isOpeningPrompt ? '接龙题目' : '看图猜词答案'}
          data-testid={TESTIDS.pictionaryTextInput}
        />
        <div className="pictionary-composer-meta">
          <p
            aria-live="polite"
            data-invalid={(validationMessage !== null && text.length > 0) || undefined}
          >
            {statusText}
          </p>
          <p data-invalid={graphemeCount > PICTIONARY_TEXT_MAX_LENGTH || undefined}>
            {graphemeCount}/{PICTIONARY_TEXT_MAX_LENGTH}
          </p>
        </div>
      </div>
    </RoomTaskFrame>
  );
}
