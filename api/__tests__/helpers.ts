/**
 * API Handler Test Helpers
 *
 * Mock utilities for Vercel Serverless Function handler unit tests.
 * Provides mock VercelRequest / VercelResponse factories.
 * 仅提供测试构造工具，不包含业务逻辑。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Create a mock VercelRequest with sensible defaults.
 */
export function mockRequest(
  overrides: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    query?: Record<string, string | string[]>;
  } = {},
): VercelRequest {
  return {
    method: overrides.method ?? 'POST',
    body: overrides.body ?? {},
    headers: overrides.headers ?? {},
    query: overrides.query ?? {},
  } as unknown as VercelRequest;
}

/**
 * Create a mock VercelResponse with chainable status().json().
 */
export function mockResponse(): VercelResponse & {
  _status: number;
  _json: unknown;
  _ended: boolean;
} {
  const res = {
    _status: 0,
    _json: undefined as unknown,
    _ended: false,

    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
    end() {
      res._ended = true;
      return res;
    },
    setHeader() {
      return res;
    },
  };
  return res as unknown as VercelResponse & {
    _status: number;
    _json: unknown;
    _ended: boolean;
  };
}
