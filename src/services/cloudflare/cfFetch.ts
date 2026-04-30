/**
 * cfFetch — Cloudflare Workers API HTTP 客户端
 *
 * 统一封装 fetch 调用：JWT Bearer token 注入、超时（AbortSignal.timeout）、
 * 网络层自动重试（fetchWithRetry）、JSON 响应解析、
 * 401 自动 refresh（单次 refresh 锁 + 队列）、
 * 结构化错误处理（非 JSON 响应返回 `{ success: false, reason: 'SERVER_ERROR' }`）。
 * 纯 IO 模块，不含业务逻辑。
 */

import { API_BASE_URL, API_TIMEOUT_MS, FETCH_RETRY_BASE_MS, FETCH_RETRY_COUNT } from '@/config/api';
import { cfFetchLog } from '@/utils/logger';

// ── Token 管理 ──────────────────────────────────────────────────────────────

/** 从内存缓存读取 access token 的回调（由 CFAuthService 注入） */
let tokenProvider: (() => string | null) | null = null;

/** 执行 refresh token → 新 token pair 的回调（由 CFAuthService 注入） */
let refreshHandler: (() => Promise<boolean>) | null = null;

/** 当 refresh 也失败（token 彻底过期）时的回调（由 CFAuthService 注入） */
let onAuthExpired: (() => void) | null = null;

export function setTokenProvider(provider: () => string | null): void {
  tokenProvider = provider;
}

export function setRefreshHandler(handler: () => Promise<boolean>): void {
  refreshHandler = handler;
}

export function setOnAuthExpired(handler: () => void): void {
  onAuthExpired = handler;
}

/** 获取当前 JWT token（供 CFStorageService 等非 cfFetch 调用者使用） */
export function getCurrentToken(): string | null {
  return tokenProvider?.() ?? null;
}

// ── Refresh 锁：确保同一时刻只有一个 refresh 请求 ──────────────────────────

let refreshPromise: Promise<boolean> | null = null;

/**
 * 带锁的 refresh：多个并发 401 请求共享同一个 refresh 调用。
 * 返回 true 表示 refresh 成功（新 token 已设置），false 表示失败。
 */
async function refreshWithLock(): Promise<boolean> {
  if (!refreshHandler) return false;

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = refreshHandler().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

// ── 网络层重试 ──────────────────────────────────────────────────────────────

/**
 * 网络层重试: 仅重试 fetch() 抛出的 TypeError（DNS/TCP/TLS 失败 = 请求大概率未到达服务器）。
 * DOMException（AbortError/TimeoutError）和编程错误直接抛出，不重试。
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      if (init?.signal?.aborted) throw error;
      if (attempt === FETCH_RETRY_COUNT) throw error;
      const delay = FETCH_RETRY_BASE_MS * 2 ** attempt;
      cfFetchLog.debug('fetch network error, retrying', {
        attempt: attempt + 1,
        delay,
        error: (error as Error).message,
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('fetchWithRetry: unreachable');
}

// ── 内部请求执行（带 401 拦截）────────────────────────────────────────────

interface RequestOptions {
  method: string;
  path: string;
  body?: string | FormData;
  headers: Record<string, string>;
  timeoutMs: number;
  noRetry?: boolean;
  /** 是 refresh 请求自身，跳过 401 拦截 */
  skipAuthIntercept?: boolean;
}

async function executeRequest<T>(opts: RequestOptions): Promise<T> {
  const url = `${API_BASE_URL}${opts.path}`;
  const fetchFn = opts.noRetry ? fetch : fetchWithRetry;

  const doFetch = (headers: Record<string, string>) =>
    fetchFn(url, {
      method: opts.method,
      headers,
      body: opts.body,
      signal: AbortSignal.timeout(opts.timeoutMs),
    });

  // 第一次请求
  const headers = { ...opts.headers };
  const token = tokenProvider?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await doFetch(headers);

  // 401 拦截：尝试 refresh 后重试一次
  if (res.status === 401 && !opts.skipAuthIntercept && refreshHandler) {
    cfFetchLog.debug('401 received, attempting refresh', { path: opts.path });
    const refreshed = await refreshWithLock();
    if (refreshed) {
      // 用新 token 重试
      const retryHeaders = { ...opts.headers };
      const newToken = tokenProvider?.();
      if (newToken) {
        retryHeaders['Authorization'] = `Bearer ${newToken}`;
      }
      const retryRes = await doFetch(retryHeaders);
      return parseJsonResponse<T>(retryRes, opts.path);
    }
    // Refresh 失败 → 触发 auth expired 回调
    onAuthExpired?.();
  }

  return parseJsonResponse<T>(res, opts.path);
}

// ── 公共 API ────────────────────────────────────────────────────────────────

/**
 * 发起 JSON POST 请求到 Workers API。
 */
export async function cfPost<T = Record<string, unknown>>(
  path: string,
  body?: Record<string, unknown>,
  options?: {
    timeoutMs?: number;
    extraHeaders?: Record<string, string>;
    noRetry?: boolean;
    skipAuthIntercept?: boolean;
  },
): Promise<T> {
  cfFetchLog.debug('POST', { path });
  return executeRequest<T>({
    method: 'POST',
    path,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...options?.extraHeaders,
    },
    timeoutMs: options?.timeoutMs ?? API_TIMEOUT_MS,
    noRetry: options?.noRetry,
    skipAuthIntercept: options?.skipAuthIntercept,
  });
}

/**
 * 发起 GET 请求到 Workers API。
 */
export async function cfGet<T = Record<string, unknown>>(
  path: string,
  options?: { skipAuthIntercept?: boolean },
): Promise<T> {
  cfFetchLog.debug('GET', { path });
  return executeRequest<T>({
    method: 'GET',
    path,
    headers: {},
    timeoutMs: API_TIMEOUT_MS,
    skipAuthIntercept: options?.skipAuthIntercept,
  });
}

/**
 * 发起 PUT 请求到 Workers API。
 */
export async function cfPut<T = Record<string, unknown>>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  cfFetchLog.debug('PUT', { path });
  return executeRequest<T>({
    method: 'PUT',
    path,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
    timeoutMs: API_TIMEOUT_MS,
  });
}

/**
 * 安全解析 JSON 响应。非 JSON（502/503 HTML）返回结构化错误。
 */
async function parseJsonResponse<T>(res: Response, path: string): Promise<T> {
  const contentType = res.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      cfFetchLog.warn('HTTP error (non-JSON)', {
        status: res.status,
        statusText: res.statusText,
        path,
      });
      throw Object.assign(new Error(`服务端错误 (${res.status})`), {
        status: res.status,
        reason: 'SERVER_ERROR',
      });
    }
    cfFetchLog.warn('Non-JSON 200 response', { path, status: res.status, contentType });
    throw Object.assign(new Error('响应格式异常'), { reason: 'SERVER_ERROR' });
  }

  const data = (await res.json()) as T;

  if (!res.ok) {
    const errBody = data as Record<string, unknown>;
    cfFetchLog.warn('HTTP error', {
      status: res.status,
      path,
      error: errBody.error,
      reason: errBody.reason,
    });
    throw Object.assign(
      new Error((errBody.error as string) ?? (errBody.reason as string) ?? `HTTP ${res.status}`),
      { status: res.status, reason: errBody.reason ?? 'SERVER_ERROR', body: errBody },
    );
  }

  return data;
}

/**
 * 上传 multipart/form-data 到 Workers API。
 */
export async function cfUpload<T = Record<string, unknown>>(
  path: string,
  formData: FormData,
  timeoutMs?: number,
): Promise<T> {
  cfFetchLog.debug('UPLOAD', { path });
  return executeRequest<T>({
    method: 'POST',
    path,
    body: formData as unknown as string, // FormData handled by fetch natively
    headers: {}, // No Content-Type — let browser set multipart boundary
    timeoutMs: timeoutMs ?? API_TIMEOUT_MS,
  });
}
