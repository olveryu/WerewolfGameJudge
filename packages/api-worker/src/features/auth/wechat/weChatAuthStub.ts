/** WeChat authentication Durable Object routing owned by the auth feature. */

import type { Env } from '../../../env';
import type { WeChatAuthProxy } from './WeChatAuthProxy';

/** Route WeChat API calls through the singleton APAC Durable Object. */
export function getWeChatAuthStub(env: Env): DurableObjectStub<WeChatAuthProxy> {
  const id = env.WECHAT_AUTH.idFromName('wechat-auth');
  return env.WECHAT_AUTH.get(id, { locationHint: 'apac' });
}
