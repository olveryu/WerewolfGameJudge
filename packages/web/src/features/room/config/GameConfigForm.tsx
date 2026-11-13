/**
 * Renders a GameConfigSchema with the shared settings controls. Presentation only: each field
 * kind maps to one widget, the inline issue shows under its field, and a game-supplied renderer
 * replaces the default widget when the schema kind cannot express the control.
 */
import {
  type AnyConfigFieldSpec,
  type ConfigFieldValue,
  type ConfigValidationIssue,
  describeCountRange,
  type GameConfigSchema,
} from '@game-judge/game-engine/platform/config/configSchema';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import {
  formatDurationOption,
  GameSettingsChoice,
  GameSettingsStepper,
  GameSettingsSwitch,
} from '@/components/GameSettings';
import { TESTIDS } from '@/testids';
import { showConfirmAlert } from '@/utils/alertPresets';

import { type CountDrafts, readFieldValue } from './gameConfigFormModel';
import type { ConfigFieldRenderer } from './GameConfigScreenDefinition';

type ChoiceValue = string | number | null;

function optionKey(value: ChoiceValue): string {
  return value === null ? 'unlimited' : String(value);
}

/** Schema option values are primitives by construction; anything else is a schema bug. */
function toChoiceValue(value: unknown, fieldKey: string): ChoiceValue {
  if (typeof value === 'number' || typeof value === 'string' || value === null) return value;
  throw new Error(`[FAIL-FAST] ${fieldKey} holds a value that is not a choice`);
}

function IssueText({
  id,
  gameType,
  fieldKey,
  message,
}: {
  readonly id: string;
  readonly gameType: GameType;
  readonly fieldKey: string;
  readonly message: string | null;
}) {
  if (message === null) return null;
  return (
    <p
      id={id}
      className="game-settings-issue"
      aria-live="polite"
      data-testid={TESTIDS.gameConfigFieldIssue(gameType, fieldKey)}
    >
      {message}
    </p>
  );
}

function FieldView({
  gameType,
  fieldKey,
  spec,
  value,
  draft,
  issueMessage,
  onChange,
  onDraftChange,
  onStep,
}: {
  readonly gameType: GameType;
  readonly fieldKey: string;
  readonly spec: AnyConfigFieldSpec;
  readonly value: ConfigFieldValue;
  readonly draft: string | undefined;
  readonly issueMessage: string | null;
  readonly onChange: (value: ConfigFieldValue) => void;
  readonly onDraftChange: (text: string) => void;
  readonly onStep: (delta: number) => void;
}) {
  const testId = TESTIDS.gameConfigField(gameType, fieldKey);
  const issueId = TESTIDS.gameConfigFieldIssue(gameType, fieldKey);
  const hasIssue = issueMessage !== null;
  const issue = (
    <IssueText id={issueId} gameType={gameType} fieldKey={fieldKey} message={issueMessage} />
  );
  switch (spec.kind) {
    case 'fixed':
      return null;
    case 'count': {
      if (typeof value !== 'number') {
        throw new Error(`[FAIL-FAST] ${fieldKey} count field holds a non-number`);
      }
      const range = describeCountRange(spec);
      return (
        <div className="game-settings-section">
          <GameSettingsStepper
            label={spec.label}
            value={draft ?? String(value)}
            onChangeText={onDraftChange}
            onDecrement={() => onStep(-1)}
            onIncrement={() => onStep(1)}
            isDecrementDisabled={value <= spec.min}
            isIncrementDisabled={value >= spec.max}
            testId={testId}
            decrementTestId={TESTIDS.gameConfigFieldDecrement(gameType, fieldKey)}
            incrementTestId={TESTIDS.gameConfigFieldIncrement(gameType, fieldKey)}
            issueId={hasIssue ? issueId : undefined}
            isInvalid={hasIssue}
          />
          <p className="game-settings-hint">
            {spec.hint === undefined ? range : `${range}，${spec.hint}`}
          </p>
          {issue}
        </div>
      );
    }
    case 'toggle': {
      if (typeof value !== 'boolean') {
        throw new Error(`[FAIL-FAST] ${fieldKey} toggle field holds a non-boolean`);
      }
      const apply = (next: boolean) => {
        const confirm = spec.confirmOnEnable;
        if (next && confirm !== undefined) {
          showConfirmAlert(confirm.title, confirm.message, () => onChange(true), {
            confirmText: confirm.confirmText,
          });
          return;
        }
        onChange(next);
      };
      return (
        <div className="game-settings-section">
          <GameSettingsSwitch
            label={spec.label}
            value={value}
            onValueChange={apply}
            tone={spec.tone === 'warning' ? 'warning' : 'primary'}
            testId={testId}
            issueId={hasIssue ? issueId : undefined}
            isInvalid={hasIssue}
          />
          {spec.hint !== undefined && <p className="game-settings-hint">{spec.hint}</p>}
          {issue}
        </div>
      );
    }
    case 'choice':
      return (
        <div>
          <GameSettingsChoice
            title={spec.label}
            hint={spec.hint}
            options={spec.options.map((option) => ({
              value: toChoiceValue(option.value, fieldKey),
              label: option.label,
            }))}
            value={toChoiceValue(value, fieldKey)}
            onChange={onChange}
            optionTestId={(option) =>
              TESTIDS.gameConfigFieldOption(gameType, fieldKey, optionKey(option))
            }
            issueId={hasIssue ? issueId : undefined}
            isInvalid={hasIssue}
          />
          {issue}
        </div>
      );
    case 'duration':
      return (
        <div>
          <GameSettingsChoice
            title={spec.label}
            hint={spec.hint}
            options={spec.values.map((candidate) => {
              const option = toChoiceValue(candidate, fieldKey);
              if (typeof option === 'string') {
                throw new Error(`[FAIL-FAST] ${fieldKey} duration option is not a second count`);
              }
              return { value: option, label: formatDurationOption(option, spec.nullLabel) };
            })}
            value={toChoiceValue(value, fieldKey)}
            onChange={onChange}
            optionTestId={(option) =>
              TESTIDS.gameConfigFieldOption(gameType, fieldKey, optionKey(option))
            }
            issueId={hasIssue ? issueId : undefined}
            isInvalid={hasIssue}
          />
          {issue}
        </div>
      );
  }
}

export function GameConfigForm<TConfig extends object>({
  gameType,
  schema,
  config,
  countDrafts,
  issue,
  fieldRenderers,
  onFieldChange,
  onCountDraftChange,
  onStepCount,
}: {
  readonly gameType: GameType;
  readonly schema: GameConfigSchema<TConfig>;
  readonly config: TConfig;
  readonly countDrafts: CountDrafts;
  readonly issue: ConfigValidationIssue<TConfig> | null;
  readonly fieldRenderers: { readonly [K in keyof TConfig]?: ConfigFieldRenderer } | undefined;
  readonly onFieldChange: (key: keyof TConfig, value: ConfigFieldValue) => void;
  readonly onCountDraftChange: (key: keyof TConfig, text: string) => void;
  readonly onStepCount: (key: keyof TConfig, delta: number) => void;
}) {
  const keys: (keyof TConfig & string)[] = [];
  for (const key in schema.fields) keys.push(key);
  return (
    <>
      {keys.map((key) => {
        const spec: AnyConfigFieldSpec = schema.fields[key];
        const issueMessage = issue !== null && issue.field === key ? issue.message : null;
        const value = readFieldValue(config, key);
        const Renderer: ConfigFieldRenderer | undefined = fieldRenderers?.[key];
        if (Renderer !== undefined) {
          return (
            <Renderer
              key={key}
              spec={spec}
              value={value}
              onChange={(next) => onFieldChange(key, next)}
              issueMessage={issueMessage}
              issueId={TESTIDS.gameConfigFieldIssue(gameType, key)}
              testId={TESTIDS.gameConfigField(gameType, key)}
            />
          );
        }
        return (
          <FieldView
            key={key}
            gameType={gameType}
            fieldKey={key}
            spec={spec}
            value={value}
            draft={countDrafts[key]}
            issueMessage={issueMessage}
            onChange={(next) => onFieldChange(key, next)}
            onDraftChange={(text) => onCountDraftChange(key, text)}
            onStep={(delta) => onStepCount(key, delta)}
          />
        );
      })}
      {issue !== null && issue.field === null && (
        <p
          className="game-settings-issue"
          data-testid={TESTIDS.gameConfigFieldIssue(gameType, 'config')}
        >
          {issue.message}
        </p>
      )}
    </>
  );
}
