/**
 * HostGuideBanner — Contextual hint bar shown only to the Host.
 *
 * Displays a single-line guide message at each game phase, telling the Host
 * what to do next. Renders between NightProgressIndicator and ControlledSeatBanner.
 * Returns null when message is empty (e.g. during Ongoing phase).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { UI_ICONS } from '@/config/iconTokens';
import { typography } from '@/theme';

import type { HostGuideBannerStyles } from './styles';

interface HostGuideBannerProps {
  /** Guide message to display. Component renders nothing when null/empty. */
  message: string;
  /** Pre-created styles from parent. */
  styles: HostGuideBannerStyles;
}

const HostGuideBannerComponent: React.FC<HostGuideBannerProps> = ({ message, styles }) => {
  return (
    <View style={styles.container}>
      <Ionicons name={UI_ICONS.HINT} size={typography.secondary} style={styles.icon} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

export const HostGuideBanner = memo(HostGuideBannerComponent);

HostGuideBanner.displayName = 'HostGuideBanner';
