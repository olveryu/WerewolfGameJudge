/**
 * Pure state helpers for the schema-driven config form.
 *
 * A count field keeps the user's raw text while they type so a transient
 * value such as "1" on the way to "12" is not clamped. The draft becomes the
 * field's inline issue when it is not an integer; once it parses, the typed
 * config holds the number and schema validation takes over.
 */

import {
  type AnyConfigFieldSpec,
  type ConfigFieldValue,
  type ConfigValidationIssue,
  type GameConfigSchema,
  validateConfig,
} from '@game-judge/game-engine/platform/config/configSchema';

export type CountDrafts = Readonly<Record<string, string>>;

const INTEGER_TEXT = /^\d+$/;

/** Parses a count draft; null when the text is not a non-negative integer. */
export function parseCountDraft(text: string): number | null {
  return INTEGER_TEXT.test(text) ? Number(text) : null;
}

/**
 * Removes one draft, returning the same object when nothing changes. Written as
 * an explicit filter: a computed-key rest destructure (`{ [key]: _, ...rest }`)
 * kept the key in the production web bundle because the unused binding was
 * eliminated before the rest pattern was lowered.
 */
export function dropCountDraft(drafts: CountDrafts, key: string): CountDrafts {
  if (!(key in drafts)) return drafts;
  return Object.fromEntries(Object.entries(drafts).filter(([draftKey]) => draftKey !== key));
}

/** Applies one field value to a config without disturbing its other keys. */
export function withFieldValue<TConfig extends object>(
  config: TConfig,
  key: keyof TConfig,
  value: ConfigFieldValue,
): TConfig {
  return { ...config, [key]: value };
}

/** Reads one field as a widget value; schemas only hold primitives, so this is total. */
export function readFieldValue<TConfig extends object>(
  config: TConfig,
  key: keyof TConfig,
): ConfigFieldValue {
  const value: unknown = config[key];
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    value === null
  ) {
    return value;
  }
  throw new Error(`[FAIL-FAST] Config field ${String(key)} is not a primitive`);
}

/** Unparsable drafts win over schema issues so the user sees what they typed is wrong. */
export function resolveConfigIssue<TConfig extends object>(
  schema: GameConfigSchema<TConfig>,
  config: TConfig,
  drafts: CountDrafts,
): ConfigValidationIssue<TConfig> | null {
  for (const key in schema.fields) {
    const spec: AnyConfigFieldSpec = schema.fields[key];
    if (spec.kind !== 'count') continue;
    const draft = drafts[key];
    if (draft !== undefined && parseCountDraft(draft) === null) {
      return { field: key, message: `${spec.label}需为 ${spec.min} 至 ${spec.max} 的整数` };
    }
  }
  return validateConfig(schema, config);
}

/** Plain record view of a config for transport payloads and key-based reads. */
export function toConfigRecord<TConfig extends object>(
  config: TConfig,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(config));
}

/** Footer summary when a game does not supply its own. */
export function describeDefaultSummary<TConfig extends object>(config: TConfig): string | null {
  const count = toConfigRecord(config)['numberOfPlayers'];
  return typeof count === 'number' ? `共 ${count} 人` : null;
}
