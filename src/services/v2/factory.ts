/**
 * Service Factory - v2 服务工厂
 *
 * 创建并组装 v2 服务层组件
 */

import { GameStore } from './store';
import { TransportAdapter } from './transport';
import type { BroadcastService } from '../BroadcastService';
import type { RoleId } from '../../models/roles';
import type { GameState } from './store/types';

/**
 * 服务实例
 */
export interface GameServices {
  store: GameStore;
  transport: TransportAdapter;
}

/**
 * 创建服务的配置
 */
export interface CreateServicesOptions {
  roomCode: string;
  hostUid: string;
  isHost: boolean;
  templateRoles: RoleId[];
  broadcastService: BroadcastService;
}

/**
 * 创建初始状态
 */
function createInitialState(
  roomCode: string,
  hostUid: string,
  templateRoles: RoleId[],
): GameState {
  return {
    roomCode,
    hostUid,
    status: 'unseated',
    templateRoles,
    players: {},
    actions: [],
    wolfVotes: {},
    currentActionerIndex: -1,
    isAudioPlaying: false,
  };
}

/**
 * 创建 v2 服务实例
 */
export function createGameServices(options: CreateServicesOptions): GameServices {
  const { roomCode, hostUid, isHost, templateRoles, broadcastService } = options;

  // 创建初始状态
  const initialState = createInitialState(roomCode, hostUid, templateRoles);

  // 创建 store
  const store = new GameStore();
  store.setState(initialState);

  // 创建 transport adapter
  const transport = new TransportAdapter(broadcastService, isHost);

  return {
    store,
    transport,
  };
}

/**
 * 销毁服务实例
 */
export async function destroyGameServices(services: GameServices): Promise<void> {
  await services.transport.disconnect();
}
