/**
 * 已保存身份方案的账号 API 客户端（Worker `/api/games/toolbox/presets`）。
 * owner 由服务端认证上下文决定；客户端只严格解码响应。
 */

import {
  parseToolboxIdentityConfig,
  type ToolboxIdentityConfig,
} from '@game-judge/game-engine/games/toolbox/public';
import { queryOptions } from '@tanstack/react-query';

import { ApiError } from '@/platform/http/ApiError';
import { apiClient } from '@/platform/http/client';

const PRESETS_PATH = '/api/games/toolbox/presets';
const PRESET_KEYS = ['id', 'name', 'identity', 'version', 'createdAt', 'updatedAt'] as const;

export interface ToolboxPreset {
  readonly id: string;
  readonly name: string;
  readonly identity: ToolboxIdentityConfig;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function failPresetContract(detail: string): never {
  throw new Error(`Invalid toolbox preset response: ${detail}`);
}

function readNonEmptyString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : failPresetContract(key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parsePreset(value: unknown): ToolboxPreset {
  if (!isRecord(value)) return failPresetContract('preset');
  const keys = Object.keys(value);
  if (keys.length !== PRESET_KEYS.length || !PRESET_KEYS.every((key) => keys.includes(key)))
    return failPresetContract('preset keys');
  const version = value.version;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1)
    return failPresetContract('version');
  return {
    id: readNonEmptyString(value, 'id'),
    name: readNonEmptyString(value, 'name'),
    identity: parseToolboxIdentityConfig(value.identity, 'preset.identity'),
    version,
    createdAt: readNonEmptyString(value, 'createdAt'),
    updatedAt: readNonEmptyString(value, 'updatedAt'),
  };
}

function parseSinglePresetResponse(value: unknown): ToolboxPreset {
  if (!isRecord(value) || Object.keys(value).length !== 1) return failPresetContract('envelope');
  return parsePreset(value.preset);
}

function parsePresetListResponse(value: unknown): readonly ToolboxPreset[] {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Array.isArray(value.presets))
    return failPresetContract('list envelope');
  return value.presets.map(parsePreset);
}

function parseDeleteResponse(value: unknown): void {
  if (!isRecord(value) || value.success !== true) failPresetContract('delete');
}

export const toolboxPresetListOptions = queryOptions({
  queryKey: ['games', 'toolbox', 'presets'] as const,
  queryFn: () =>
    apiClient.json({
      method: 'GET',
      path: PRESETS_PATH,
      auth: 'required',
      idempotent: true,
      decode: parsePresetListResponse,
    }),
  staleTime: 0,
});

/** 另存新方案。 */
export function createToolboxPreset(input: {
  readonly name: string;
  readonly identity: ToolboxIdentityConfig;
}): Promise<ToolboxPreset> {
  return apiClient.json({
    method: 'POST',
    path: PRESETS_PATH,
    auth: 'required',
    idempotent: false,
    body: { name: input.name, identity: input.identity },
    decode: parseSinglePresetResponse,
  });
}

/** 带版本条件地更新或重命名方案。 */
export function updateToolboxPreset(input: {
  readonly id: string;
  readonly name: string;
  readonly identity: ToolboxIdentityConfig;
  readonly expectedVersion: number;
}): Promise<ToolboxPreset> {
  return apiClient.json({
    method: 'PUT',
    path: `${PRESETS_PATH}/${encodeURIComponent(input.id)}`,
    auth: 'required',
    idempotent: true,
    body: { name: input.name, identity: input.identity, expectedVersion: input.expectedVersion },
    decode: parseSinglePresetResponse,
  });
}

/** 删除本人方案。 */
export function deleteToolboxPreset(id: string): Promise<void> {
  return apiClient.json({
    method: 'DELETE',
    path: `${PRESETS_PATH}/${encodeURIComponent(id)}`,
    auth: 'required',
    idempotent: true,
    decode: parseDeleteResponse,
  });
}

const PRESET_FAILURE_MESSAGES: Readonly<Record<string, string>> = {
  TOOLBOX_PRESET_NAME_INVALID: '方案名称需为 1–20 个字',
  TOOLBOX_PRESET_IDENTITY_INVALID: '身份设置有误，请检查后再保存',
  TOOLBOX_PRESET_NOT_FOUND: '方案不存在或已被删除，请刷新列表',
  TOOLBOX_PRESET_NAME_TAKEN: '已有同名方案，请换一个名称',
  TOOLBOX_PRESET_VERSION_CONFLICT: '方案已更新，请重新载入后再保存',
  TOOLBOX_PRESET_LIMIT_REACHED: '方案数量已达上限，请先删除不用的方案',
  ANONYMOUS_NOT_SUPPORTED: '登录后可保存和使用方案',
};

/** 服务端已知拒绝原因的中文；其他失败返回 null，交给统一错误管线。 */
export function getToolboxPresetFailureMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.isHttp()) return null;
  return PRESET_FAILURE_MESSAGES[error.reason] ?? null;
}
