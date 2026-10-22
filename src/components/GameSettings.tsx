/** Shared settings controls; callers own the displayed values, editing and validation. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, TextInput, View } from 'react-native';

import { colors } from '@/theme';
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
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText?: (value: string) => void;
  readonly testID?: string;
  readonly onDecrement: () => void;
  readonly onIncrement: () => void;
  readonly isDecrementDisabled?: boolean;
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
        <Button variant="icon" onPress={onIncrement} accessibilityLabel="增加人数">
          <Ionicons name="add" size={componentSizes.icon.sm} color={colors.text} />
        </Button>
      </View>
    </View>
  );
}

/**
 * Shared duration radio group for game settings: one titled section of
 * second options, where a null option means "no time limit". Callers own
 * the candidate values and the selected value; presentation is shared.
 */
export function GameSettingsDurationOptions<TDuration extends number | null>({
  title,
  hint,
  values,
  value,
  onChange,
  nullLabel = '不限时',
  optionTestID,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly values: readonly TDuration[];
  readonly value: TDuration;
  readonly onChange: (value: TDuration) => void;
  readonly nullLabel?: string;
  readonly optionTestID?: (value: TDuration) => string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      {hint !== undefined ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.optionRow}>
        {values.map((option) => {
          const selected = option === value;
          const optionLabel = option === null ? nullLabel : `${option} 秒`;
          return (
            <Pressable
              key={option ?? 'unlimited'}
              onPress={() => onChange(option)}
              testID={optionTestID?.(option)}
              accessibilityRole="radio"
              accessibilityLabel={`${title} ${optionLabel}`}
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
                {optionLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
