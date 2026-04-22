/**
 * StatusRibbon — Unified status indicator slot below the header.
 *
 * Renders exactly one status indicator at a time, prioritized:
 *   1. ConnectionStatusBar (highest — disconnection must always be visible)
 *   2. NightProgressIndicator (Ongoing phase)
 *   3. Speaking order (Ended, transient ~60s)
 *   4. HostGuideBanner (lowest — contextual hint)
 *
 * Does not import services. Receives all data via props. Pure presentation.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { STATUS_ICONS } from '@/config/iconTokens';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import { typography } from '@/theme';

import { ConnectionStatusBar } from './ConnectionStatusBar';
import { HostGuideBanner } from './HostGuideBanner';
import { NightProgressIndicator } from './NightProgressIndicator';
import type {
  ConnectionStatusBarStyles,
  HostGuideBannerStyles,
  NightProgressIndicatorStyles,
  StatusRibbonStyles,
} from './styles';

interface StatusRibbonProps {
  connectionStatus: ConnectionStatus;
  onManualReconnect: () => void;
  nightProgress: { current: number; total: number; roleName?: string } | null;
  guideMessage: string | null;
  speakingOrderText?: string;
  styles: StatusRibbonStyles;
  connectionStatusBarStyles: ConnectionStatusBarStyles;
  nightProgressIndicatorStyles: NightProgressIndicatorStyles;
  hostGuideBannerStyles: HostGuideBannerStyles;
}

const StatusRibbonComponent: React.FC<StatusRibbonProps> = ({
  connectionStatus,
  onManualReconnect,
  nightProgress,
  guideMessage,
  speakingOrderText,
  styles,
  connectionStatusBarStyles,
  nightProgressIndicatorStyles,
  hostGuideBannerStyles,
}) => {
  const isDisconnected = connectionStatus !== ConnectionStatus.Live;

  // Priority 1: Connection status (always overrides everything)
  if (isDisconnected) {
    return (
      <ConnectionStatusBar
        status={connectionStatus}
        onManualReconnect={onManualReconnect}
        styles={connectionStatusBarStyles}
      />
    );
  }

  // Priority 2: Night progress (Ongoing phase)
  if (nightProgress) {
    return (
      <NightProgressIndicator
        currentStep={nightProgress.current}
        totalSteps={nightProgress.total}
        currentRoleName={nightProgress.roleName}
        styles={nightProgressIndicatorStyles}
      />
    );
  }

  // Priority 3: Speaking order (Ended, transient)
  if (speakingOrderText != null) {
    return (
      <View style={styles.speakingOrderContainer}>
        <Ionicons
          name={STATUS_ICONS.SPEAKING}
          size={typography.secondary}
          style={styles.speakingOrderIcon}
        />
        <View style={styles.speakingOrderTextContainer}>
          <Text style={styles.speakingOrderText}>{speakingOrderText}</Text>
          <Text style={styles.speakingOrderSubText}>未参与竞选的玩家自动跳过</Text>
        </View>
      </View>
    );
  }

  // Priority 4: Host guide
  if (guideMessage) {
    return <HostGuideBanner message={guideMessage} styles={hostGuideBannerStyles} />;
  }

  return null;
};

export const StatusRibbon = memo(StatusRibbonComponent);

StatusRibbon.displayName = 'StatusRibbon';
