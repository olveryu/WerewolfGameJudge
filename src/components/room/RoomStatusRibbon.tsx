/**
 * RoomStatusRibbon — shared status slot for room shells.
 *
 * Priority: connection state first, adapter-provided content second, guide text last.
 */
import type React from 'react';
import { memo } from 'react';

import { ConnectionStatus } from '@/services/types/IGameFacade';

import { ConnectionStatusBar } from './ConnectionStatusBar';
import { HostGuideBanner } from './HostGuideBanner';
import type { ConnectionStatusBarStyles, HostGuideBannerStyles } from './roomComponentStyles';

interface RoomStatusRibbonProps {
  connectionStatus: ConnectionStatus;
  onManualReconnect: () => void;
  content?: React.ReactNode;
  guideMessage: string | null;
  connectionStatusBarStyles: ConnectionStatusBarStyles;
  hostGuideBannerStyles: HostGuideBannerStyles;
}

const RoomStatusRibbonComponent: React.FC<RoomStatusRibbonProps> = ({
  connectionStatus,
  onManualReconnect,
  content = null,
  guideMessage,
  connectionStatusBarStyles,
  hostGuideBannerStyles,
}) => {
  if (connectionStatus !== ConnectionStatus.Live) {
    return (
      <ConnectionStatusBar
        status={connectionStatus}
        onManualReconnect={onManualReconnect}
        styles={connectionStatusBarStyles}
      />
    );
  }

  if (content) return <>{content}</>;

  if (guideMessage) {
    return <HostGuideBanner message={guideMessage} styles={hostGuideBannerStyles} />;
  }

  return null;
};

export const RoomStatusRibbon = memo(RoomStatusRibbonComponent);

RoomStatusRibbon.displayName = 'RoomStatusRibbon';
