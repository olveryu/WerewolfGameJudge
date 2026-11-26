/** 聚会工具 Worker 运行时模块：无系统命令、无副作用、无完成结算；对外只发送按用户投影的视图。 */

import {
  projectToolboxStateForUser,
  TOOLBOX_STATE_CODEC,
  TOOLBOX_VIEW_CODEC,
  toolboxEngine,
} from '@game-judge/game-engine/games/toolbox/public';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { toolboxPresetRoutes } from './routes';
import {
  toolboxCreateConfigSchema,
  toolboxEffectSchema,
  toolboxInternalCommandSchema,
  toolboxPublicCommandSchema,
} from './schemas';

export const toolboxWorkerModule = defineWorkerGameModule({
  gameType: 'toolbox',
  engine: toolboxEngine,
  stateCodec: TOOLBOX_STATE_CODEC,
  viewCodec: TOOLBOX_VIEW_CODEC,
  projectStateForUser: projectToolboxStateForUser,
  createConfigSchema: toolboxCreateConfigSchema,
  publicCommandSchema: toolboxPublicCommandSchema,
  internalCommandSchema: toolboxInternalCommandSchema,
  effectSchema: toolboxEffectSchema,
  httpRoutes: [{ path: '/api/games/toolbox/presets', router: toolboxPresetRoutes }],
  // 奖励策略为 `none`：引擎不产生任何副作用，到达这里说明不变量已破坏。
  handleEffect: (effect) =>
    Promise.reject(new Error(`[FAIL-FAST] Toolbox has no effects, received ${String(effect)}`)),
});
