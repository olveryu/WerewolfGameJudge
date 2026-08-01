/** Exhaustive ActionIntent executor table and dispatch entry point. */

import type { ActionIntent } from '@/games/werewolf/room/policy/types';
import { roomScreenLog } from '@/utils/logger';

import { actionConfirmExecutor, magicianFirstExecutor } from './actionSubmitExecutor';
import { chooseCardExecutor } from './chooseCardExecutor';
import { groupConfirmAckExecutor } from './groupConfirmExecutor';
import { multiSelectConfirmExecutor, multiSelectToggleExecutor } from './multiSelectExecutor';
import { actionPromptExecutor, confirmTriggerExecutor } from './promptExecutor';
import { revealExecutor } from './revealExecutor';
import { skipExecutor } from './skipExecutor';
import type { CompleteExecutorMap, ExecutorContext } from './types';
import { wolfRobotViewHunterStatusExecutor } from './wolfRobotExecutor';
import { wolfVoteExecutor } from './wolfVoteExecutor';

const executors = {
  reveal: revealExecutor,
  magicianFirst: magicianFirstExecutor,
  wolfVote: wolfVoteExecutor,
  actionConfirm: actionConfirmExecutor,
  skip: skipExecutor,
  actionPrompt: actionPromptExecutor,
  confirmTrigger: confirmTriggerExecutor,
  wolfRobotViewHunterStatus: wolfRobotViewHunterStatusExecutor,
  multiSelectToggle: multiSelectToggleExecutor,
  multiSelectConfirm: multiSelectConfirmExecutor,
  groupConfirmAck: groupConfirmAckExecutor,
  chooseCard: chooseCardExecutor,
} satisfies CompleteExecutorMap;

export async function dispatchIntent(intent: ActionIntent, ctx: ExecutorContext): Promise<void> {
  const executor = executors[intent.type];
  roomScreenLog.debug('Dispatching action intent', { type: intent.type });
  await executor(intent, ctx);
}

export type { ExecutorContext } from './types';
