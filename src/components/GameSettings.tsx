/** Shared settings controls; callers own the displayed values, editing and validation. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';

import { colors, withAlpha } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import { Button } from './Button';
import { gameSettingsStyles as styles } from './GameSettings.styles';

/** Uses the Werewolf settings-row hierarchy without changing game-specific count semantics. */
export function GameSettingsStepper({
  label,
  value,
  onChangeText,
  testID,
  onDecrement,
  onIncrement,
  isDecrementDisabled = false,
  isIncrementDisabled = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText?: (value: string) => void;
  readonly testID?: string;
  readonly onDecrement: () => void;
  readonly onIncrement: () => void;
  readonly isDecrementDisabled?: boolean;
  readonly isIncrementDisabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Button
          variant="icon"
          onPress={onDecrement}
          disabled={isDecrementDisabled}
          accessibilityLabel="减少人数"
        >
          <Ionicons name="remove" size={componentSizes.icon.sm} color={colors.text} />
        </Button>
        {onChangeText ? (
          <TextInput
            value={value}
            onChangeText={onChangeText}
            keyboardType="number-pad"
            inputMode="numeric"
            selectTextOnFocus
            style={styles.count}
            accessibilityLabel={label}
            testID={testID}
          />
        ) : (
          <Text style={styles.count} testID={testID}>
            {value}
          </Text>
        )}
        <Button
          variant="icon"
          onPress={onIncrement}
          disabled={isIncrementDisabled}
          accessibilityLabel="增加人数"
        >
          <Ionicons name="add" size={componentSizes.icon.sm} color={colors.text} />
        </Button>
      </View>
    </View>
  );
}

/** Labelled boolean row; callers render any hint below it inside their own section. */
export function GameSettingsSwitch({
  label,
  value,
  onValueChange,
  accentColor = colors.primary,
  testID,
  accessibilityLabel = label,
}: {
  readonly label: string;
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly accentColor?: string;
  readonly testID?: string;
  readonly accessibilityLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: withAlpha(accentColor, 0.4) }}
        thumbColor={value ? accentColor : colors.textSecondary}
      />
    </View>
  );
}

/**
 * Shared radio-pill option group for game settings: one titled section whose
 * options carry caller-owned values and labels. Callers own the candidate
 * values and the selected value; presentation is shared. The accessibility
 * label defaults to `${title} ${optionLabel}`.
 */
export function GameSettingsChoice<TValue extends string | number | null>({
  title,
  hint,
  options,
  value,
  onChange,
  optionTestID,
  optionAccessibilityLabel,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly options: readonly { readonly value: TValue; readonly label: string }[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  readonly optionTestID?: (value: TValue) => string;
  readonly optionAccessibilityLabel?: (value: TValue, optionLabel: string) => string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      {hint !== undefined ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.optionRow}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value === null ? 'null' : String(option.value)}
              onPress={() => onChange(option.value)}
              testID={optionTestID?.(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={
                optionAccessibilityLabel
                  ? optionAccessibilityLabel(option.value, option.label)
                  : `${title} ${option.label}`
              }
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={componentSizes.icon.sm}
                color={selected ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Label for one second-count option; `null` means no time limit. */
export function formatDurationOption(value: number | null, nullLabel = '不限时'): string {
  return value === null ? nullLabel : `${value} 秒`;
}

/**
 * Shared duration radio group: `GameSettingsChoice` over second counts, where
 * a null option renders as `nullLabel`.
 */
export function GameSettingsDurationOptions<TDuration extends number | null>({
  title,
  hint,
  values,
  value,
  onChange,
  nullLabel = '不限时',
  optionTestID,
  optionAccessibilityLabel,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly values: readonly TDuration[];
  readonly value: TDuration;
  readonly onChange: (value: TDuration) => void;
  readonly nullLabel?: string;
  readonly optionTestID?: (value: TDuration) => string;
  readonly optionAccessibilityLabel?: (value: TDuration, optionLabel: string) => string;
}) {
  return (
    <GameSettingsChoice
      title={title}
      hint={hint}
      options={values.map((option) => ({
        value: option,
        label: formatDurationOption(option, nullLabel),
      }))}
      value={value}
      onChange={onChange}
      optionTestID={optionTestID}
      optionAccessibilityLabel={optionAccessibilityLabel}
    />
  );
}
