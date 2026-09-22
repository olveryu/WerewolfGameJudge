/** Shared count control; callers own the displayed value, editing and validation. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, TextInput, View } from 'react-native';

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
