/**
 * 聚会工具已保存身份方案 API（挂载于 `/api/games/toolbox/presets`）。
 *
 * 所有操作只作用于认证账号自己的方案，owner 只从认证上下文读取。
 *
 * @throws 401 未认证；403 `ANONYMOUS_NOT_SUPPORTED` 匿名账号；
 * 400 `VALIDATION_ERROR` | `TOOLBOX_PRESET_NAME_INVALID` | `TOOLBOX_PRESET_IDENTITY_INVALID`；
 * 404 `TOOLBOX_PRESET_NOT_FOUND`；409 `TOOLBOX_PRESET_NAME_TAKEN` |
 * `TOOLBOX_PRESET_VERSION_CONFLICT` | `TOOLBOX_PRESET_LIMIT_REACHED`。
 */

import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../../env';
import { requireAuth, requireNonAnonymous } from '../../features/auth/tokenAuth';
import { jsonBody } from '../../platform/http/jsonBody';
import {
  createToolboxPreset,
  deleteToolboxPreset,
  listToolboxPresets,
  normalizeToolboxPresetName,
  TOOLBOX_PRESET_REASONS,
  toolboxPresetSchema,
  updateToolboxPreset,
} from './presets';
import { toolboxIdentityConfigSchema } from './schemas';

const presetBodySchema = z.strictObject({
  name: z.string(),
  identity: toolboxIdentityConfigSchema,
});

const presetUpdateBodySchema = z.strictObject({
  name: z.string(),
  identity: toolboxIdentityConfigSchema,
  expectedVersion: z.int().positive(),
});

const presetListResponseSchema = z.strictObject({ presets: z.array(toolboxPresetSchema) });
const presetResponseSchema = z.strictObject({ preset: toolboxPresetSchema });
const presetIdSchema = z.string().min(1).max(64);

export const toolboxPresetRoutes = new Hono<AppEnv>();

toolboxPresetRoutes.use('*', requireAuth, requireNonAnonymous);

toolboxPresetRoutes.get('/', async (c) => {
  const presets = await listToolboxPresets(c.env.DB, c.var.userId);
  c.header('Cache-Control', 'no-store');
  return c.json(presetListResponseSchema.parse({ presets }), 200);
});

toolboxPresetRoutes.post('/', jsonBody(presetBodySchema), async (c) => {
  const body = c.req.valid('json');
  const name = normalizeToolboxPresetName(body.name);
  if (name === null) {
    return c.json({ success: false, reason: TOOLBOX_PRESET_REASONS.nameInvalid }, 400);
  }
  const result = await createToolboxPreset(c.env.DB, {
    ownerUserId: c.var.userId,
    name,
    identity: body.identity,
    nowIso: new Date().toISOString(),
  });
  if (result.kind === 'rejected') {
    return c.json({ success: false, reason: result.reason }, result.status);
  }
  return c.json(presetResponseSchema.parse({ preset: result.preset }), 201);
});

toolboxPresetRoutes.put('/:presetId', jsonBody(presetUpdateBodySchema), async (c) => {
  const presetId = presetIdSchema.safeParse(c.req.param('presetId'));
  if (!presetId.success) {
    return c.json({ success: false, reason: TOOLBOX_PRESET_REASONS.notFound }, 404);
  }
  const body = c.req.valid('json');
  const name = normalizeToolboxPresetName(body.name);
  if (name === null) {
    return c.json({ success: false, reason: TOOLBOX_PRESET_REASONS.nameInvalid }, 400);
  }
  const result = await updateToolboxPreset(c.env.DB, {
    id: presetId.data,
    ownerUserId: c.var.userId,
    name,
    identity: body.identity,
    expectedVersion: body.expectedVersion,
    nowIso: new Date().toISOString(),
  });
  if (result.kind === 'rejected') {
    return c.json({ success: false, reason: result.reason }, result.status);
  }
  return c.json(presetResponseSchema.parse({ preset: result.preset }), 200);
});

toolboxPresetRoutes.delete('/:presetId', async (c) => {
  const presetId = presetIdSchema.safeParse(c.req.param('presetId'));
  const deleted =
    presetId.success && (await deleteToolboxPreset(c.env.DB, presetId.data, c.var.userId));
  if (!deleted) {
    return c.json({ success: false, reason: TOOLBOX_PRESET_REASONS.notFound }, 404);
  }
  return c.json({ success: true }, 200);
});
