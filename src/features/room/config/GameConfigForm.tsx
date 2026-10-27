/**
 * Renders a GameConfigSchema with the shared settings controls.
 *
 * Presentation only: each field kind maps to one shared widget, the inline
 * issue is shown under its field, and a game-supplied renderer replaces the
 * default widget for a key when the schema kind cannot express the control.
 * Values, drafts, validation and submission live in useGameConfigScreenState.
 */

import {
  type AnyConfigFieldSpec,
  type ConfigFieldValue,
  type ConfigValidationIssue,
  describeCountRange,
  type GameConfigSchema,
} from '@game-judge/game-engine/platform/config/configSchema';
import type React from 'react';
import { Text, View } from 'react-native';

import {
  formatDurationOption,
  GameSettingsChoice,
  GameSettingsStepper,
  GameSettingsSwitch,
} from '@/components/GameSettings';
import { gameSettingsStyles as styles } from '@/components/GameSettings.styles';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

import { type CountDrafts, readFieldValue } from './gameConfigFormModel';
import type { ConfigFieldRenderer } from './GameConfigScreenDefinition';

interface GameConfigFormProps<TConfig extends object> {
  readonly gameType: string;
  readonly schema: GameConfigSchema<TConfig>;
  readonly config: TConfig;
  readonly countDrafts: CountDrafts;
  readonly issue: ConfigValidationIssue<TConfig> | null;
  readonly fieldRenderers?: { readonly [K in keyof TConfig]?: ConfigFieldRenderer };
  readonly onFieldChange: (key: keyof TConfig, value: ConfigFieldValue) => void;
  readonly onCountDraftChange: (key: keyof TConfig, text: string) => void;
  readonly onStepCount: (key: keyof TConfig, delta: number) => void;
}

interface FieldViewProps {
  readonly gameType: string;
  readonly fieldKey: string;
  readonly spec: AnyConfigFieldSpec;
  readonly value: ConfigFieldValue;
  readonly draft: string | undefined;
  readonly issueMessage: string | null;
  readonly onChange: (value: ConfigFieldValue) => void;
  readonly onDraftChange: (text: string) => void;
  readonly onStep: (delta: number) => void;
}

type ChoiceValue = string | number | null;

function optionKey(value: ChoiceValue): string {
  return value === null ? 'unlimited' : String(value);
}

/** Schema option values are primitives by construction; anything else is a schema bug. */
function toChoiceValue(value: unknown, fieldKey: string): ChoiceValue {
  if (typeof value === 'number' || typeof value === 'string' || value === null) return value;
  throw new Error(`[FAIL-FAST] ${fieldKey} holds a value that is not a choice`);
}

const IssueText: React.FC<{
  readonly gameType: string;
  readonly fieldKey: string;
  readonly message: string | null;
}> = ({ gameType, fieldKey, message }) =>
  message === null ? null : (
    <Text
      style={styles.issue}
      accessibilityLiveRegion="polite"
      testID={TESTIDS.gameConfigFieldIssue(gameType, fieldKey)}
    >
      {message}
    </Text>
  );

const FieldView: React.FC<FieldViewProps> = ({
  gameType,
  fieldKey,
  spec,
  value,
  draft,
  issueMessage,
  onChange,
  onDraftChange,
  onStep,
}) => {
  const testID = TESTIDS.gameConfigField(gameType, fieldKey);
  switch (spec.kind) {
    case 'fixed':
      return null;
    case 'count': {
      if (typeof value !== 'number') {
        throw new Error(`[FAIL-FAST] ${fieldKey} count field holds a non-number`);
      }
      const hint =
        spec.hint === undefined
          ? describeCountRange(spec)
          : `${describeCountRange(spec)}，${spec.hint}`;
      return (
        <View style={styles.section}>
          <GameSettingsStepper
            label={spec.label}
            value={draft ?? String(value)}
            onChangeText={onDraftChange}
            onDecrement={() => onStep(-1)}
            onIncrement={() => onStep(1)}
            isDecrementDisabled={value <= spec.min}
            isIncrementDisabled={value >= spec.max}
            testID={testID}
          />
          <Text style={styles.hint}>{hint}</Text>
          <IssueText gameType={gameType} fieldKey={fieldKey} message={issueMessage} />
        </View>
      );
    }
    case 'toggle': {
      if (typeof value !== 'boolean') {
        throw new Error(`[FAIL-FAST] ${fieldKey} toggle field holds a non-boolean`);
      }
      const apply = (next: boolean) => {
        if (next && spec.confirmOnEnable !== undefined) {
          const confirm = spec.confirmOnEnable;
          showConfirmAlert(confirm.title, confirm.message, () => onChange(true), {
            confirmText: confirm.confirmText,
          });
          return;
        }
        onChange(next);
      };
      return (
        <View style={styles.section}>
          <GameSettingsSwitch
            label={spec.label}
            value={value}
            onValueChange={apply}
            accentColor={spec.tone === 'warning' ? colors.warning : undefined}
            testID={testID}
          />
          {spec.hint === undefined ? null : <Text style={styles.hint}>{spec.hint}</Text>}
          <IssueText gameType={gameType} fieldKey={fieldKey} message={issueMessage} />
        </View>
      );
    }
    case 'choice':
      return (
        <View>
          <GameSettingsChoice
            title={spec.label}
            hint={spec.hint}
            options={spec.options.map((option) => ({
              value: toChoiceValue(option.value, fieldKey),
              label: option.label,
            }))}
            value={toChoiceValue(value, fieldKey)}
            onChange={onChange}
            optionTestID={(option) =>
              TESTIDS.gameConfigFieldOption(gameType, fieldKey, optionKey(option))
            }
          />
          <IssueText gameType={gameType} fieldKey={fieldKey} message={issueMessage} />
        </View>
      );
    case 'duration':
      return (
        <View>
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
            optionTestID={(option) =>
              TESTIDS.gameConfigFieldOption(gameType, fieldKey, optionKey(option))
            }
          />
          <IssueText gameType={gameType} fieldKey={fieldKey} message={issueMessage} />
        </View>
      );
  }
};

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
}: GameConfigFormProps<TConfig>) {
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
              testID={TESTIDS.gameConfigField(gameType, key)}
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
      {issue !== null && issue.field === null ? (
        <Text style={styles.issue} testID={TESTIDS.gameConfigFieldIssue(gameType, 'config')}>
          {issue.message}
        </Text>
      ) : null}
    </>
  );
}
