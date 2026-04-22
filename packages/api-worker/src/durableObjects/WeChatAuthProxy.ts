/**
 * WeChatAuthProxy — 微信 API 代理 Durable Object
 *
 * 利用 locationHint: "apac" 将 DO 放置在亚太区域（HKG/SIN/NRT），
 * 使出站 fetch 到 api.weixin.qq.com（中国服务器）走亚太内部网络而非跨洲骨干网。
 * CN 用户的 Anycast 路由不经过 APAC（落在 AMS/LAX），Worker 也在 US/EU，
 * 导致微信 code2Session 调用需跨洲往返，延迟高且不稳定。
 *
 * 无状态 DO — 不使用 storage，纯 RPC 代理。
 */

import { DurableObject } from 'cloudflare:workers';

import type { Env } from '../env';

/** 微信 code2Session 响应结构 */
interface WxCode2SessionResult {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

/** code2Session 超时（APAC→中国，同区域给 15s 安全网） */
const WX_API_TIMEOUT_MS = 15_000;

export class WeChatAuthProxy extends DurableObject<Env> {
  /**
   * 调用微信 code2Session API 换取 openid。
   *
   * @param code - wx.login() 获取的临时 code
   * @param appId - 小程序 AppID
   * @param appSecret - 小程序 AppSecret
   * @returns code2Session 响应（含 openid 或 errcode）
   * @throws 网络超时时抛出 Error
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
