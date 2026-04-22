/**
 * cfFetch — Cloudflare Workers API HTTP 客户端
 *
 * 统一封装 fetch 调用：JWT Bearer token 注入、超时（AbortSignal.timeout）、
 * 网络层自动重试（fetchWithRetry）、JSON 响应解析、
 * 结构化错误处理（非 JSON 响应返回 `{ success: false, reason: 'SERVER_ERROR' }`）。
 * 纯 IO 模块，不含业务逻辑。
 */

import { API_BASE_URL, API_TIMEOUT_MS, FETCH_RETRY_BASE_MS, FETCH_RETRY_COUNT } from '@/config/api';
import { cfFetchLog } from '@/utils/logger';

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
 * 网络层重试: 仅重试 fetch() 抛出的 TypeError（DNS/TCP/TLS 失败 = 请求大概率未到达服务器）。
 * DOMException（AbortError/TimeoutError）和编程错误直接抛出，不重试。
 *
 * 注意 total-operation timeout 语义：调用方传入的 AbortSignal.timeout(N) 在所有
 * attempt 间共享同一倒计时。首次 attempt 快速失败后剩余时间供后续 attempt 使用。
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      // 只重试 TypeError（fetch() 网络失败的标准错误类型）。
      // DOMException（AbortError/TimeoutError）和其他错误直接抛出。
      if (!(error instanceof TypeError)) throw error;
      // signal 已 aborted（超时 TimeoutError 在 delay 期间触发）→ 不重试
      if (init?.signal?.aborted) throw error;
      // 最后一次重试也失败 → 抛出
      if (attempt === FETCH_RETRY_COUNT) throw error;
      // 指数退避: 1s, 2s
      const delay = FETCH_RETRY_BASE_MS * 2 ** attempt;
      cfFetchLog.debug('fetch network error, retrying', {
        attempt: attempt + 1,
        delay,
        error: (error as Error).message,
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // TypeScript: unreachable, for 循环必定 return 或 throw
  throw new Error('fetchWithRetry: unreachable');
}

/**
 * 发起 JSON POST 请求到 Workers API。
 *
 * - 自动注入 Authorization: Bearer <token>
 * - 校验 res.ok + content-type 含 application/json
 * - AbortSignal.timeout 超时保护
 * - fetchWithRetry 网络层自动重试（可通过 noRetry 禁用）
 */
export async function cfPost<T = Record<string, unknown>>(
  path: string,
  body?: Record<string, unknown>,
  options?: {
    timeoutMs?: number;
    extraHeaders?: Record<string, string>;
    noRetry?: boolean;
  },
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  cfFetchLog.debug('POST', { path });
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.extraHeaders,
  };

  const token = tokenProvider?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchFn = options?.noRetry ? fetch : fetchWithRetry;
  const res = await fetchFn(url, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(options?.timeoutMs ?? API_TIMEOUT_MS),
  });

  return parseJsonResponse<T>(res, path);
}

/**
 * 发起 GET 请求到 Workers API。
 */
export async function cfGet<T = Record<string, unknown>>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  cfFetchLog.debug('GET', { path });
  const headers: Record<string, string> = {};

  const token = tokenProvider?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetchWithRetry(url, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  return parseJsonResponse<T>(res, path);
}

/**
 * 发起 PUT 请求到 Workers API。
 */
export async function cfPut<T = Record<string, unknown>>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  cfFetchLog.debug('PUT', { path });
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = tokenProvider?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetchWithRetry(url, {
    method: 'PUT',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  return parseJsonResponse<T>(res, path);
}

/**
 * 安全解析 JSON 响应。非 JSON（502/503 HTML）返回结构化错误。
 */
async function parseJsonResponse<T>(res: Response, path: string): Promise<T> {
  const contentType = res.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      cfFetchLog.warn('HTTP error (non-JSON)', { status: res.status, path });
      throw Object.assign(new Error(`服务端错误 (${res.status})`), {
        status: res.status,
        reason: 'SERVER_ERROR',
      });
    }
    // 200 but not JSON — unusual
    cfFetchLog.warn('Non-JSON 200 response', { path });
    throw Object.assign(new Error('响应格式异常'), { reason: 'SERVER_ERROR' });
  }

  const data = (await res.json()) as T;

  if (!res.ok) {
    const errBody = data as Record<string, unknown>;
    cfFetchLog.warn('HTTP error', { status: res.status, path, reason: errBody.reason });
    throw Object.assign(
      new Error((errBody.error as string) ?? (errBody.reason as string) ?? `HTTP ${res.status}`),
      { status: res.status, reason: errBody.reason ?? 'SERVER_ERROR', body: errBody },
    );
  }

  return data;
}

/**
 * 上传 multipart/form-data 到 Workers API。
 *
 * - 自动注入 Authorization: Bearer <token>
 * - 不设 Content-Type（让浏览器自动加 boundary）
 * - fetchWithRetry 网络层自动重试
 * - AbortSignal.timeout 超时保护
 */
export async function cfUpload<T = Record<string, unknown>>(
  path: string,
  formData: FormData,
  timeoutMs?: number,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  cfFetchLog.debug('UPLOAD', { path });
  const headers: Record<string, string> = {};

  const token = tokenProvider?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body: formData,
    signal: AbortSignal.timeout(timeoutMs ?? API_TIMEOUT_MS),
  });

  return parseJsonResponse<T>(res, path);
}
