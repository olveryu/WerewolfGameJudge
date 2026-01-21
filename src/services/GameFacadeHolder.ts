/**
 * GameFacadeHolder - Facade 实例持有者
 *
 * 用于依赖注入，支持测试隔离。
 * 初始化时机：App.tsx composition root。
 */

import type { IGameFacade } from './types/IGameFacade';

let _instance: IGameFacade | null = null;
let _initialized = false;

export const GameFacadeHolder = {
  /**
   * 设置 Facade 实例（App.tsx 调用一次）
   */
  set(facade: IGameFacade): void {
    if (_initialized) {
      throw new Error('[GameFacadeHolder] Already initialized. Call resetForTests() first.');
    }
    _instance = facade;
    _initialized = true;
  },

  /**
   * 获取 Facade 实例
   */
  get(): IGameFacade {
    if (!_instance) {
      throw new Error('[GameFacadeHolder] Not initialized. Ensure App.tsx calls set() before use.');
    }
    return _instance;
  },

  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return _initialized;
  },

  /**
   * 测试/HMR 隔离：重置
   */
  resetForTests(): void {
    _instance = null;
    _initialized = false;
  },
};
