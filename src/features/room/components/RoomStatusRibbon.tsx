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
import { NightProgressIndicator } from './NightProgressIndicator';
import type {
  ConnectionStatusBarStyles,
  HostGuideBannerStyles,
  NightProgressIndicatorStyles,
  StatusRibbonStyles,
} from './styles';

interface RoomStatusRibbonProps {
  readonly connection: RoomConnectionViewModel;
  readonly status: RoomStatusRibbonModel | null;
  readonly styles: StatusRibbonStyles;
  readonly connectionStatusBarStyles: ConnectionStatusBarStyles;
  readonly nightProgressIndicatorStyles: NightProgressIndicatorStyles;
  readonly hostGuideBannerStyles: HostGuideBannerStyles;
}

const RoomStatusRibbonComponent: React.FC<RoomStatusRibbonProps> = ({
  connection,
  status,
  styles,
  connectionStatusBarStyles,
  nightProgressIndicatorStyles,
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
      <NightProgressIndicator
        currentStep={status.current}
        totalSteps={status.total}
        currentRoleName={status.label ?? undefined}
        styles={nightProgressIndicatorStyles}
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
