import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, spacing, borderRadius, typography, ThemeColors } from '../theme';

interface NumPadProps {
  /** Current value (max 4 digits) */
  value: string;
  /** Callback when value changes */
  onValueChange: (value: string) => void;
  /** Maximum number of digits (default: 4) */
  maxLength?: number;
  /** Disable all buttons */
  disabled?: boolean;
}

/** Row definitions: row identifier + keys */
const BUTTONS: Array<{ id: string; keys: string[] }> = [
  { id: 'row1', keys: ['1', '2', '3'] },
  { id: 'row2', keys: ['4', '5', '6'] },
  { id: 'row3', keys: ['7', '8', '9'] },
  { id: 'row4', keys: ['clear', '0', 'del'] },
];

/** Get display label for a key */
const getLabel = (key: string): string => {
  if (key === 'clear') return 'C';
  if (key === 'del') return '⌫';
  return key;
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.small,
      marginBottom: spacing.small,
    },
    button: {
      width: spacing.xxlarge + spacing.xlarge + spacing.small, // ~72
      height: spacing.xxlarge + spacing.medium + spacing.small, // ~56
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      fontSize: typography.title,
      fontWeight: '600',
      color: colors.text,
    },
    specialButton: {
      backgroundColor: colors.surfaceHover,
    },
    specialButtonText: {
      fontSize: typography.body,
      color: colors.textSecondary,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });

/**
 * 9-pad numeric keypad for entering room codes
 */
export const NumPad: React.FC<NumPadProps> = ({
  value,
  onValueChange,
  maxLength = 4,
  disabled = false,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = (key: string) => {
    if (disabled) return;

    if (key === 'clear') {
      onValueChange('');
      return;
    }
    if (key === 'del') {
      onValueChange(value.slice(0, -1));
      return;
    }
    // digit - append if under max length
    if (value.length < maxLength) {
      onValueChange(value + key);
    }
  };

  const renderButton = (key: string) => {
    const isSpecial = key === 'clear' || key === 'del';
    const label = getLabel(key);

    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.button,
          isSpecial && styles.specialButton,
          disabled && styles.buttonDisabled,
        ]}
        onPress={() => handlePress(key)}
        disabled={disabled}
        activeOpacity={0.7}
        testID={`numpad-${key}`}
      >
        <Text style={[styles.buttonText, isSpecial && styles.specialButtonText]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {BUTTONS.map((row) => (
        <View key={row.id} style={styles.row}>
          {row.keys.map((key) => renderButton(key))}
        </View>
      ))}
    </View>
  );
};

export default NumPad;
