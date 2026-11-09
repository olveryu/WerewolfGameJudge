/**
 * Remembered lobby-config fields per game (`rememberedGameConfigs` in `@user_settings`): the
 * values of every `isRemembered` schema field the user last chose, reapplied when creating a room.
 */
import {
  type AnyConfigFieldSpec,
  type ConfigFieldValue,
  type GameConfigSchema,
  validateConfigFieldValue,
} from '@game-judge/game-engine/platform/config/configSchema';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import { isPlainRecord, readUserSettings, writeUserSettings } from './userSettingsStorage';

const FIELD = 'rememberedGameConfigs';

type RememberedGameConfigs = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

function readRemembered(): RememberedGameConfigs {
  const value = readUserSettings()[FIELD];
  if (!isPlainRecord(value)) return {};
  const result: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [gameType, fields] of Object.entries(value)) {
    if (isPlainRecord(fields)) result[gameType] = fields;
  }
  return result;
}

/**
 * The remembered value of every `isRemembered` field of `schema`: the stored value when it still
 * passes the field spec, otherwise the schema default. Fields that are not remembered are absent.
 */
export function getRememberedGameConfig<TConfig extends object>(
  gameType: GameType,
  schema: GameConfigSchema<TConfig>,
): Partial<TConfig> {
  const stored = readRemembered()[gameType] ?? {};
  const defaults: Readonly<Record<string, unknown>> = Object.fromEntries(
    Object.entries(schema.defaults),
  );
  let remembered: Partial<TConfig> = {};
  for (const key in schema.fields) {
    const spec: AnyConfigFieldSpec = schema.fields[key];
    if (spec.kind === 'fixed' || spec.isRemembered !== true) continue;
    const candidate = stored[key];
    const value =
      candidate !== undefined && validateConfigFieldValue(spec, candidate) === null
        ? candidate
        : defaults[key];
    remembered = { ...remembered, [key]: value };
  }
  return remembered;
}

/** Persists one remembered field; throws when storage rejects the write. */
export function setRememberedGameConfigField(
  gameType: GameType,
  key: string,
  value: ConfigFieldValue,
): void {
  const remembered = readRemembered();
  writeUserSettings({
    [FIELD]: { ...remembered, [gameType]: { ...remembered[gameType], [key]: value } },
  });
}
