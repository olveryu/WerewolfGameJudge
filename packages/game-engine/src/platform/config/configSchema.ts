/**
 * Game configuration schema — the single declaration of each lobby setting.
 *
 * A game declares one `GameConfigSchema` for its config object: every key of
 * the config gets exactly one field spec (enforced at compile time by the
 * mapped `fields` type) carrying the user-facing label, hint, and the legal
 * value range. `validateConfig` derives field-level validation from those
 * specs; the schema's `validate` hook holds only cross-field invariants.
 *
 * Consumers: engine `isValid<Game>Config` (normalize / createInitialState),
 * the Worker boundary schema, and the client config form. None of them may
 * restate a limit that lives here.
 *
 * Boundary: pure data and pure functions, no IO, no game imports.
 */

/** Integer stepper; the config value must be a `number` (or a numeric literal union). */
export interface CountFieldSpec {
  readonly kind: 'count';
  readonly label: string;
  readonly hint?: string;
  readonly min: number;
  readonly max: number;
  readonly isRemembered?: boolean;
}

/** Boolean switch; `confirmOnEnable` asks before turning on. */
export interface ToggleFieldSpec {
  readonly kind: 'toggle';
  readonly label: string;
  readonly hint?: string;
  readonly tone?: 'default' | 'warning';
  readonly confirmOnEnable?: {
    readonly title: string;
    readonly message: string;
    readonly confirmText: string;
  };
  readonly isRemembered?: boolean;
}

export interface ChoiceOption<TValue> {
  readonly value: TValue;
  readonly label: string;
  readonly hint?: string;
}

/** Single select among string-like options. */
export interface ChoiceFieldSpec<TValue> {
  readonly kind: 'choice';
  readonly label: string;
  readonly hint?: string;
  readonly options: readonly ChoiceOption<TValue>[];
  readonly isRemembered?: boolean;
}

/** Single select among second counts; `null` means no limit and renders as `nullLabel`. */
export interface DurationFieldSpec<TValue> {
  readonly kind: 'duration';
  readonly label: string;
  readonly hint?: string;
  readonly values: readonly TValue[];
  readonly nullLabel?: string;
  readonly isRemembered?: boolean;
}

/** Not user-editable; must still equal `value` so strict boundaries accept the key. */
export interface FixedFieldSpec<TValue> {
  readonly kind: 'fixed';
  readonly value: TValue;
}

/**
 * Field specs allowed for a value of type `TValue`. Uses non-distributive
 * conditionals so `number | null` stays whole and resolves to `duration`.
 */
export type ConfigFieldSpec<TValue> =
  | ([TValue] extends [boolean] ? ToggleFieldSpec : never)
  | ([TValue] extends [number] ? CountFieldSpec : never)
  | ([TValue] extends [number | null] ? DurationFieldSpec<TValue> : never)
  | ([TValue] extends [string] ? ChoiceFieldSpec<TValue> : never)
  | FixedFieldSpec<TValue>;

/** Value-erased spec union for runtime dispatch. */
export type AnyConfigFieldSpec =
  | CountFieldSpec
  | ToggleFieldSpec
  | ChoiceFieldSpec<unknown>
  | DurationFieldSpec<unknown>
  | FixedFieldSpec<unknown>;

/** Every runtime value a schema-driven field widget can emit. */
export type ConfigFieldValue = number | boolean | string | null;

/** Hint text derived from a count range so copy cannot drift from the limit. */
export function describeCountRange(spec: CountFieldSpec): string {
  return `支持 ${spec.min} 至 ${spec.max} 人`;
}

export interface ConfigValidationIssue<TConfig extends object> {
  /** `null` reports a whole-config problem from the cross-field hook. */
  readonly field: keyof TConfig | null;
  /** Chinese, ready to show to the user. */
  readonly message: string;
}

export interface GameConfigSchema<TConfig extends object> {
  /** One spec per config key; declaration order is render order. */
  readonly fields: { readonly [K in keyof TConfig]-?: ConfigFieldSpec<TConfig[K]> };
  readonly defaults: TConfig;
  /** Cross-field invariants only; field ranges come from `fields`. */
  readonly validate: (config: TConfig) => ConfigValidationIssue<TConfig> | null;
}

/** Field-level check for one spec; null when the value is acceptable. */
export function validateConfigFieldValue(spec: AnyConfigFieldSpec, value: unknown): string | null {
  switch (spec.kind) {
    case 'count':
      if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < spec.min ||
        value > spec.max
      ) {
        return `${spec.label}需为 ${spec.min} 至 ${spec.max} 的整数`;
      }
      return null;
    case 'toggle':
      return typeof value === 'boolean' ? null : `${spec.label}设置无效`;
    case 'choice':
      return spec.options.some((option) => option.value === value)
        ? null
        : `${spec.label}不在可选范围内`;
    case 'duration':
      return spec.values.some((candidate) => candidate === value)
        ? null
        : `${spec.label}不在可选范围内`;
    case 'fixed':
      return value === spec.value ? null : '该设置不可修改';
  }
}

/** Field-level checks in declaration order, then the cross-field hook; first issue wins. */
export function validateConfig<TConfig extends object>(
  schema: GameConfigSchema<TConfig>,
  config: TConfig,
): ConfigValidationIssue<TConfig> | null {
  for (const key in schema.fields) {
    const spec: AnyConfigFieldSpec = schema.fields[key];
    const message = validateConfigFieldValue(spec, config[key]);
    if (message !== null) return { field: key, message };
  }
  return schema.validate(config);
}

export function isValidConfig<TConfig extends object>(
  schema: GameConfigSchema<TConfig>,
  config: TConfig,
): boolean {
  return validateConfig(schema, config) === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every declared field passes its spec; combined with an exact key set this is the `TConfig` shape. */
function hasValidFields<TConfig extends object>(
  schema: GameConfigSchema<TConfig>,
  record: Record<string, unknown>,
): record is Record<string, unknown> & TConfig {
  for (const key in schema.fields) {
    const spec: AnyConfigFieldSpec = schema.fields[key];
    if (validateConfigFieldValue(spec, record[key]) !== null) return false;
  }
  return true;
}

/**
 * Narrows an untrusted value to `TConfig`: a plain object with exactly the
 * schema's keys whose fields and cross-field invariants all pass. This is the
 * single point where unknown input becomes a typed config, so transport
 * boundaries (Worker zod) build on it instead of restating field rules.
 */
export function isConfig<TConfig extends object>(
  schema: GameConfigSchema<TConfig>,
  value: unknown,
): value is TConfig {
  if (!isRecord(value)) return false;
  const expectedKeys = Object.keys(schema.fields);
  if (Object.keys(value).length !== expectedKeys.length) return false;
  if (!expectedKeys.every((key) => Object.hasOwn(value, key))) return false;
  if (!hasValidFields(schema, value)) return false;
  return schema.validate(value) === null;
}
