/** Prioritized connection and game-provided status slot below the room header. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo } from 'react';
import { Text, View } from 'react-native';

import { STATUS_ICONS } from '@/config/iconTokens';
import type {
  RoomConnectionViewModel,
  RoomStatusRibbonModel,
} from '@/features/room/model/RoomShellModel';
import { typography } from '@/theme';

import { ConnectionStatusBar } from './ConnectionStatusBar';
import { HostGuideBanner } from './HostGuideBanner';
import { RoomProgressIndicator } from './RoomProgressIndicator';
import type {
  ConnectionStatusBarStyles,
  HostGuideBannerStyles,
  RoomProgressIndicatorStyles,
  StatusRibbonStyles,
} from './styles';

interface RoomStatusRibbonProps {
  readonly connection: RoomConnectionViewModel;
  readonly status: RoomStatusRibbonModel | null;
  readonly styles: StatusRibbonStyles;
  readonly connectionStatusBarStyles: ConnectionStatusBarStyles;
  readonly progressIndicatorStyles: RoomProgressIndicatorStyles;
  readonly hostGuideBannerStyles: HostGuideBannerStyles;
}

const RoomStatusRibbonComponent: React.FC<RoomStatusRibbonProps> = ({
  connection,
  status,
  styles,
  connectionStatusBarStyles,
  progressIndicatorStyles,
  hostGuideBannerStyles,
}) => {
  if (connection.status !== 'live') {
    return (
      <ConnectionStatusBar
        status={connection.status}
        onManualReconnect={connection.onManualReconnect}
        styles={connectionStatusBarStyles}
      />
    );
  }

  if (!status) return null;

  if (status.kind === 'progress') {
    return (
      <RoomProgressIndicator
        currentStep={status.current}
        totalSteps={status.total}
        currentLabel={status.label ?? undefined}
        styles={progressIndicatorStyles}
      />
    );
  }

  if (status.icon === 'guide') {
    return <HostGuideBanner message={status.text} styles={hostGuideBannerStyles} />;
  }

  return (
    <View style={styles.speakingOrderContainer}>
      <Ionicons
        name={STATUS_ICONS.SPEAKING}
        size={typography.secondary}
        style={styles.speakingOrderIcon}
      />
      <View style={styles.speakingOrderTextContainer}>
        <Text style={styles.speakingOrderText}>{status.text}</Text>
        {status.supportingText && (
          <Text style={styles.speakingOrderSubText}>{status.supportingText}</Text>
        )}
      </View>
    </View>
  );
};

export const RoomStatusRibbon = memo(RoomStatusRibbonComponent);
RoomStatusRibbon.displayName = 'RoomStatusRibbon';
