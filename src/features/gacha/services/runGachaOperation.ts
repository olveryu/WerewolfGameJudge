/** Execute persisted asset intent under its originating authenticated session. */
import { CloudflareHttpError } from '@/services/cloudflare/cfFetch';
import type { IAuthService } from '@/services/types/IAuthService';

import {
  type GachaOperationRequest,
  type GachaOperationStore,
  gachaOperationStore,
} from './GachaOperationStore';

const TERMINAL_GACHA_REJECTIONS = new Set([
  'NO_STATS',
  'INSUFFICIENT_DRAWS',
  'INSUFFICIENT_SHARDS',
  'ALREADY_OWNED',
  'INVALID_ITEM',
]);
const activeOperations = new Set<string>();

export async function runGachaOperation<TResponse>(
  authService: IAuthService,
  userId: string | null,
  request: GachaOperationRequest,
  send: (idempotencyKey: string) => Promise<TResponse>,
  store: GachaOperationStore = gachaOperationStore,
): Promise<TResponse> {
  const session = authService.getAuthSession();
  if (userId === null || session === null || session.userId !== userId) {
    throw new Error('账号已改变，请重新进入抽奖页面');
  }
  if (activeOperations.has(userId)) throw new Error('操作正在确认，请等待本次请求结束');
  const operation = store.begin(userId, request);
  activeOperations.add(userId);
  try {
    const response = await send(operation.idempotencyKey);
    if (authService.getAuthSession() !== session) {
      throw new DOMException('Authentication changed', 'AbortError');
    }
    store.complete(operation);
    return response;
  } catch (error) {
    if (authService.getAuthSession() !== session)
      throw new DOMException('Authentication changed', 'AbortError');
    if (
      authService.getAuthSession() === session &&
      error instanceof CloudflareHttpError &&
      TERMINAL_GACHA_REJECTIONS.has(error.reason)
    ) {
      store.complete(operation);
      throw error;
    }
    throw new Error('操作结果待确认，请恢复原操作，不会重复扣除', { cause: error });
  } finally {
    activeOperations.delete(userId);
  }
}
