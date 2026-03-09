/**
 * TipCard - Contextual tip card (Apple HIG style)
 *
 * Displays a single contextual tip between the action row and footer.
 * Rendered by HomeScreen based on user state (login, profile, features).
 * Dismissible per session (state-driven, no persistence).
 * Pure UI component: does not import services or contain business logic.
 */
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { type ThemeColors } from '@/theme';
import { fixed } from '@/theme/tokens';

import { type HomeScreenStyles } from './styles';

interface TipCardProps {
  tipId: string;
  icon: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  onDismiss?: (tipId: string) => void;
  styles: HomeScreenStyles;
  colors: ThemeColors;
  testID?: string;
}

export const TipCard = memo<TipCardProps>(
  ({ tipId, icon, title, subtitle, onPress, onDismiss, styles, colors, testID }) => {
    const content = (
      <>
        <Text style={styles.tipCardIcon}>{icon}</Text>
        <View style={styles.tipCardBody}>
          <Text style={styles.tipCardTitle}>{title}</Text>
          <Text style={styles.tipCardSub}>{subtitle}</Text>
        </View>
        {onDismiss && (
          <TouchableOpacity
            style={styles.tipCardClose}
            onPress={() => onDismiss(tipId)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="关闭提示"
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </>
    );

    if (onPress) {
      return (
        <TouchableOpacity
          style={styles.tipCard}
          onPress={onPress}
          activeOpacity={fixed.activeOpacity}
          testID={testID}
        >
          {content}
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.tipCard} testID={testID}>
        {content}
      </View>
    );
  },
);

TipCard.displayName = 'TipCard';
