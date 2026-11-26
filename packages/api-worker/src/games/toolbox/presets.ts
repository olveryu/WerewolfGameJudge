/**
 * 聚会工具已保存身份方案的 D1 读写与账号合并迁移。
 *
 * 方案只保存身份定义和每人抽牌数；名称规范化与身份配置规则全部复用引擎。
 * 日志与错误中不包含方案名称或身份内容。
 */

import {
  isStorableToolboxIdentityConfig,
  normalizeToolboxName,
  parseToolboxIdentityConfig,
  TOOLBOX_IDENTITY_LIMITS,
  type ToolboxIdentityConfig,
} from '@game-judge/game-engine/games/toolbox/public';
import { getTableName } from 'drizzle-orm';
import { z } from 'zod';

import { toolboxIdentityPresets } from './dbSchema';
import { toolboxIdentityConfigSchema } from './schemas';

const TABLE = getTableName(toolboxIdentityPresets);

/** 每个账号最多保存的方案数；客户端与服务端共用此规则，调整需走容量评审。 */
export const TOOLBOX_PRESET_LIMIT_PER_ACCOUNT = 50;
/** 方案名长度上限（Unicode 码点），与身份名称一致。 */
const TOOLBOX_PRESET_NAME_MAX_LENGTH = TOOLBOX_IDENTITY_LIMITS.nameMaxLength;
/** 账号合并时为来源（微信）账号同名方案追加的后缀。 */
const TOOLBOX_PRESET_MERGE_SUFFIX = '（微信）';

export const TOOLBOX_PRESET_REASONS = {
  nameInvalid: 'TOOLBOX_PRESET_NAME_INVALID',
  identityInvalid: 'TOOLBOX_PRESET_IDENTITY_INVALID',
  notFound: 'TOOLBOX_PRESET_NOT_FOUND',
  nameTaken: 'TOOLBOX_PRESET_NAME_TAKEN',
  versionConflict: 'TOOLBOX_PRESET_VERSION_CONFLICT',
  limitReached: 'TOOLBOX_PRESET_LIMIT_REACHED',
} as const;

type ToolboxPresetReason = (typeof TOOLBOX_PRESET_REASONS)[keyof typeof TOOLBOX_PRESET_REASONS];

export const toolboxPresetSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  identity: toolboxIdentityConfigSchema,
  version: z.int().positive(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type ToolboxPreset = z.infer<typeof toolboxPresetSchema>;

const presetRowSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  config_json: z.string(),
  version: z.int().positive(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

const PRESET_COLUMNS = 'id, name, config_json, version, created_at, updated_at';

type PresetWriteResult =
  | { readonly kind: 'saved'; readonly preset: ToolboxPreset }
  | {
      readonly kind: 'rejected';
      readonly status: 400 | 404 | 409;
      readonly reason: ToolboxPresetReason;
    };

function countCodePoints(value: string): number {
  return [...value].length;
}

/** 规范化方案名；为空或超长返回 null。 */
export function normalizeToolboxPresetName(raw: string): string | null {
  const name = normalizeToolboxName(raw);
  const length = countCodePoints(name);
  return length >= 1 && length <= TOOLBOX_PRESET_NAME_MAX_LENGTH ? name : null;
}

/** 已存储行必须仍满足当前规则；破损数据直接失败，不静默修补。 */
function toPreset(row: unknown): ToolboxPreset {
  const parsed = presetRowSchema.parse(row);
  const identity = parseToolboxIdentityConfig(JSON.parse(parsed.config_json), 'preset.identity');
  if (!isStorableToolboxIdentityConfig(identity)) {
    throw new Error(
      `[FAIL-FAST] Stored toolbox preset ${parsed.id} has an invalid identity config`,
    );
  }
  return {
    id: parsed.id,
    name: parsed.name,
    identity,
    version: parsed.version,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  };
}

/** 本人方案，最近更新的在前。 */
export async function listToolboxPresets(
  db: D1Database,
  ownerUserId: string,
): Promise<ToolboxPreset[]> {
  const { results } = await db
    .prepare(
      `SELECT ${PRESET_COLUMNS} FROM ${TABLE} WHERE owner_user_id = ? ORDER BY updated_at DESC, id`,
    )
    .bind(ownerUserId)
    .all();
  return results.map(toPreset);
}

async function hasPresetNamed(db: D1Database, ownerUserId: string, name: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS found FROM ${TABLE} WHERE owner_user_id = ? AND normalized_name = ?`)
    .bind(ownerUserId, name)
    .first();
  return row !== null;
}

interface PresetInput {
  readonly ownerUserId: string;
  /** 已规范化的名称（见 {@link normalizeToolboxPresetName}）。 */
  readonly name: string;
  readonly identity: ToolboxIdentityConfig;
  readonly nowIso: string;
}

export async function createToolboxPreset(
  db: D1Database,
  input: PresetInput,
): Promise<PresetWriteResult> {
  if (!isStorableToolboxIdentityConfig(input.identity)) {
    return { kind: 'rejected', status: 400, reason: TOOLBOX_PRESET_REASONS.identityInvalid };
  }
  // 上限与同名在同一条语句内判断，避免并发创建越过上限或产生同名。
  const row = await db
    .prepare(
      `INSERT INTO ${TABLE}
        (id, owner_user_id, name, normalized_name, config_json, version, created_at, updated_at)
      SELECT ?1, ?2, ?3, ?3, ?4, 1, ?5, ?5
      WHERE (SELECT COUNT(*) FROM ${TABLE} WHERE owner_user_id = ?2) < ?6
      ON CONFLICT (owner_user_id, normalized_name) DO NOTHING
      RETURNING ${PRESET_COLUMNS}`,
    )
    .bind(
      crypto.randomUUID(),
      input.ownerUserId,
      input.name,
      JSON.stringify(input.identity),
      input.nowIso,
      TOOLBOX_PRESET_LIMIT_PER_ACCOUNT,
    )
    .first();
  if (row !== null) return { kind: 'saved', preset: toPreset(row) };
  return (await hasPresetNamed(db, input.ownerUserId, input.name))
    ? { kind: 'rejected', status: 409, reason: TOOLBOX_PRESET_REASONS.nameTaken }
    : { kind: 'rejected', status: 409, reason: TOOLBOX_PRESET_REASONS.limitReached };
}

export async function updateToolboxPreset(
  db: D1Database,
  input: PresetInput & { readonly id: string; readonly expectedVersion: number },
): Promise<PresetWriteResult> {
  if (!isStorableToolboxIdentityConfig(input.identity)) {
    return { kind: 'rejected', status: 400, reason: TOOLBOX_PRESET_REASONS.identityInvalid };
  }
  // 版本条件更新；同名检查放在同一语句内，失败后再读取以区分原因。
  const row = await db
    .prepare(
      `UPDATE ${TABLE}
      SET name = ?1, normalized_name = ?1, config_json = ?2, version = version + 1, updated_at = ?3
      WHERE id = ?4 AND owner_user_id = ?5 AND version = ?6
        AND NOT EXISTS (
          SELECT 1 FROM ${TABLE} WHERE owner_user_id = ?5 AND normalized_name = ?1 AND id <> ?4
        )
      RETURNING ${PRESET_COLUMNS}`,
    )
    .bind(
      input.name,
      JSON.stringify(input.identity),
      input.nowIso,
      input.id,
      input.ownerUserId,
      input.expectedVersion,
    )
    .first();
  if (row !== null) return { kind: 'saved', preset: toPreset(row) };

  const current = await db
    .prepare(`SELECT version FROM ${TABLE} WHERE id = ? AND owner_user_id = ?`)
    .bind(input.id, input.ownerUserId)
    .first();
  if (current === null) {
    return { kind: 'rejected', status: 404, reason: TOOLBOX_PRESET_REASONS.notFound };
  }
  const { version } = z.strictObject({ version: z.int().positive() }).parse(current);
  if (version !== input.expectedVersion) {
    return { kind: 'rejected', status: 409, reason: TOOLBOX_PRESET_REASONS.versionConflict };
  }
  return { kind: 'rejected', status: 409, reason: TOOLBOX_PRESET_REASONS.nameTaken };
}

/** 只删除本人方案；不存在或不属于本人都返回 false。 */
export async function deleteToolboxPreset(
  db: D1Database,
  id: string,
  ownerUserId: string,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM ${TABLE} WHERE id = ? AND owner_user_id = ?`)
    .bind(id, ownerUserId)
    .run();
  return result.meta.changes === 1;
}

/**
 * 为与目标重名的来源方案选择新名称：依次尝试「名（微信）」「名（微信）2」…，
 * 与 `takenNames` 比较；超长时截短原名以容纳后缀。会把选中的名称加入 `takenNames`。
 */
export function pickMergedToolboxPresetName(baseName: string, takenNames: Set<string>): string {
  const baseCodePoints = [...baseName];
  for (let attempt = 1; ; attempt += 1) {
    const suffix =
      attempt === 1 ? TOOLBOX_PRESET_MERGE_SUFFIX : `${TOOLBOX_PRESET_MERGE_SUFFIX}${attempt}`;
    const room = TOOLBOX_PRESET_NAME_MAX_LENGTH - countCodePoints(suffix);
    if (room < 1) {
      throw new Error('[FAIL-FAST] Toolbox preset merge suffix leaves no room for the name');
    }
    const candidate = normalizeToolboxName(`${baseCodePoints.slice(0, room).join('')}${suffix}`);
    if (!takenNames.has(candidate)) {
      takenNames.add(candidate);
      return candidate;
    }
  }
}

const mergeRowSchema = z.strictObject({
  id: z.string().min(1),
  owner_user_id: z.string().min(1),
  normalized_name: z.string().min(1),
});

/**
 * 账号合并：生成把来源账号方案迁移到目标账号的语句，调用方必须把它们与
 * 删除来源账号放入同一个 D1 批次。保留方案 ID、配置与版本；与目标重名的
 * 来源方案按 {@link pickMergedToolboxPresetName} 改名。批次内的唯一索引
 * 保护并发写入：若期间出现新的重名，整个批次回滚，由调用方重新计算。
 * 最后一条按 owner 整体迁移，包含名称计算后才创建的不冲突方案。
 */
export async function buildToolboxPresetMergeStatements(
  db: D1Database,
  sourceUserId: string,
  targetUserId: string,
): Promise<D1PreparedStatement[]> {
  const { results } = await db
    .prepare(
      `SELECT id, owner_user_id, normalized_name FROM ${TABLE}
      WHERE owner_user_id IN (?1, ?2) ORDER BY created_at, id`,
    )
    .bind(sourceUserId, targetUserId)
    .all();
  const rows = results.map((row) => mergeRowSchema.parse(row));
  const targetNames = new Set(
    rows.filter((row) => row.owner_user_id === targetUserId).map((row) => row.normalized_name),
  );
  const sourceRows = rows.filter((row) => row.owner_user_id === sourceUserId);
  const takenNames = new Set(targetNames);
  for (const row of sourceRows) {
    if (!targetNames.has(row.normalized_name)) takenNames.add(row.normalized_name);
  }
  const renames = sourceRows
    .filter((row) => targetNames.has(row.normalized_name))
    .map((row) => ({
      id: row.id,
      name: pickMergedToolboxPresetName(row.normalized_name, takenNames),
    }));

  return [
    ...renames.map((rename) =>
      db
        .prepare(
          `UPDATE ${TABLE} SET name = ?1, normalized_name = ?1 WHERE id = ?2 AND owner_user_id = ?3`,
        )
        .bind(rename.name, rename.id, sourceUserId),
    ),
    db
      .prepare(`UPDATE ${TABLE} SET owner_user_id = ?1 WHERE owner_user_id = ?2`)
      .bind(targetUserId, sourceUserId),
  ];
}

/** D1 批次因方案唯一索引冲突而回滚（合并期间出现并发重名）。 */
export function isToolboxPresetNameConflict(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('UNIQUE constraint failed') &&
    error.message.includes(`${TABLE}.`)
  );
}
