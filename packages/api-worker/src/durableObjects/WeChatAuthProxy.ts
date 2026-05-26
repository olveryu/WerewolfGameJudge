/**
 * WeChatAuthProxyBase — WeChat API proxy Durable Object.
 *
 * Responsibilities:
 * - Uses locationHint: "apac" to place the DO in APAC (HKG/SIN/NRT)
 * - Proxies outbound fetch to api.weixin.qq.com (APAC internal network, avoids cross-continent round trips)
 * - Provides the code2Session RPC method
 *
 * Not responsible for:
 * - Token management or user state persistence
 * - Game logic
 *
 * Boundary constraints:
 * - Stateless DO — no storage, pure RPC proxy
 * - CN user Anycast routing does not go through APAC (lands in AMS/LAX), so this DO is required to reduce WeChat API latency
 */

import * as Sentry from '@sentry/cloudflare';
import { DurableObject } from 'cloudflare:workers';

import type { Env } from '../env';

/** WeChat code2Session response shape */
interface WxCode2SessionResult {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

/** code2Session timeout (APAC -> China same-region; 15s safety net) */
const WX_API_TIMEOUT_MS = 15_000;

class WeChatAuthProxyBase extends DurableObject<Env> {
  /**
   * Calls the WeChat code2Session API to exchange for openid.
   *
   * @param code - temporary code obtained from wx.login()
   * @param appId - mini-program AppID
   * @param appSecret - mini-program AppSecret
   * @returns code2Session response (includes openid or errcode)
   * @throws Error on network timeout
   */
  async code2Session(
    code: string,
    appId: string,
    appSecret: string,
  ): Promise<WxCode2SessionResult> {
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.searchParams.set('appid', appId);
    url.searchParams.set('secret', appSecret);
    url.searchParams.set('js_code', code);
    url.searchParams.set('grant_type', 'authorization_code');

    const resp = await fetch(url.toString(), {
      signal: AbortSignal.timeout(WX_API_TIMEOUT_MS),
    });
    const data: WxCode2SessionResult = await resp.json();
    return data;
  }
}

export const WeChatAuthProxy = Sentry.instrumentDurableObjectWithSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.2 : 1.0,
    environment: env.ENVIRONMENT,
  }),
  WeChatAuthProxyBase,
);
export type WeChatAuthProxy = InstanceType<typeof WeChatAuthProxy>;
