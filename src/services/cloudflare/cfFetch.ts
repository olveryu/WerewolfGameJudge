/**
 * cfFetch — Cloudflare Workers API HTTP 客户端
 *
 * 统一封装 fetch 调用：JWT Bearer token 注入、超时、JSON 响应解析、
 * 结构化错误处理（非 JSON 响应返回 `{ success: false, reason: 'SERVER_ERROR' }`）。
 * 纯 IO 模块，不含业务逻辑。
 */

import { API_BASE_URL, API_TIMEOUT_MS } from '@/config/api';
import { withTimeout } from '@/utils/withTimeout';

/** 从 AsyncStorage 读取 JWT token 的回调（由 CFAuthService 注入） */
let tokenProvider: (() => string | null) | null = null;

export function setTokenProvider(provider: () => string | null): void {
  tokenProvider = provider;
}

/** 获取当前 JWT token（供 CFStorageService 等非 cfFetch 调用者使用） */
export function getCurrentToken(): string | null {
  return tokenProvider?.() ?? null;
}

/**
 * 发起 JSON POST 请求到 Workers API。
 *
 * - 自动注入 Authorization: Bearer <token>
 * - 校验 res.ok + content-type 含 application/json
 * - 超时保护（API_TIMEOUT_MS）
 */
export async function cfPost<T = Record<string, unknown>>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = tokenProvider?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchPromise = fetch(url, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const res = await withTimeout(fetchPromise, API_TIMEOUT_MS, () => new Error('请求超时'));

  return parseJsonResponse<T>(res);
}

/**
 * 发起 GET 请求到 Workers API。
 */
export async function cfGet<T = Record<string, unknown>>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {};

  const token = tokenProvider?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchPromise = fetch(url, { method: 'GET', headers });
  const res = await withTimeout(fetchPromise, API_TIMEOUT_MS, () => new Error('请求超时'));

  return parseJsonResponse<T>(res);
}

/**
 * 发起 PUT 请求到 Workers API。
 */
export async function cfPut<T = Record<string, unknown>>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = tokenProvider?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchPromise = fetch(url, {
    method: 'PUT',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const res = await withTimeout(fetchPromise, API_TIMEOUT_MS, () => new Error('请求超时'));

  return parseJsonResponse<T>(res);
}

/**
 * 安全解析 JSON 响应。非 JSON（502/503 HTML）返回结构化错误。
 */
async function parseJsonResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      throw Object.assign(new Error(`服务端错误 (${res.status})`), {
        status: res.status,
        reason: 'SERVER_ERROR',
      });
    }
    // 200 but not JSON — unusual
    throw Object.assign(new Error('响应格式异常'), { reason: 'SERVER_ERROR' });
  }

  const data = (await res.json()) as T;

  if (!res.ok) {
    const errBody = data as Record<string, unknown>;
    throw Object.assign(
      new Error((errBody.error as string) ?? (errBody.reason as string) ?? `HTTP ${res.status}`),
      { status: res.status, reason: errBody.reason ?? 'SERVER_ERROR', body: errBody },
    );
  }

  return data;
}
