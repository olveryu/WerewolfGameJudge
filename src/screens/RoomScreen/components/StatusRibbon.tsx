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
import type React from 'react';
import { memo } from 'react';
import { Text, View } from 'react-native';

import { RoomStatusRibbon } from '@/components/room/RoomStatusRibbon';
import { STATUS_ICONS } from '@/config/iconTokens';
import { type ConnectionStatus } from '@/services/types/IGameFacade';
import { typography } from '@/theme';

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
  let content: React.ReactNode = null;
  if (nightProgress) {
    content = (
      <NightProgressIndicator
        currentStep={nightProgress.current}
        totalSteps={nightProgress.total}
        currentRoleName={nightProgress.roleName}
        styles={nightProgressIndicatorStyles}
      />
    );
  } else if (speakingOrderText != null) {
    content = (
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

  return (
    <RoomStatusRibbon
      connectionStatus={connectionStatus}
      onManualReconnect={onManualReconnect}
      content={content}
      guideMessage={guideMessage}
      connectionStatusBarStyles={connectionStatusBarStyles}
      hostGuideBannerStyles={hostGuideBannerStyles}
    />
  );
};

export const StatusRibbon = memo(StatusRibbonComponent);

StatusRibbon.displayName = 'StatusRibbon';
