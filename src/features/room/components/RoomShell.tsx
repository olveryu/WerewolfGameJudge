/** Shared visual frame for every game room. Game adapters provide models and explicit slots. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import {
  usesRoomSideInspector,
  usesStackedRoomHeader,
} from '@/features/room/model/roomShellLayout';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, layout } from '@/theme';

import { ControlledSeatBanner } from './ControlledSeatBanner';
import { PlayerProfileCard } from './PlayerProfileCard';
import { QRCodeModal } from './QRCodeModal';
import { RoomBottomActionPanel } from './RoomBottomActionPanel';
import { RoomHeaderActions } from './RoomHeaderActions';
import { RoomHostManagementPanel } from './RoomHostManagementPanel';
import { RoomSeatBoard } from './RoomSeatBoard';
import { RoomSeatConfirmModal } from './RoomSeatConfirmModal';
import { createRoomShellStyles } from './RoomShell.styles';
import { RoomStatusRibbon } from './RoomStatusRibbon';
import { createRoomFeatureStyles } from './styles';

export interface RoomShellProps {
  readonly model: RoomShellModel;
  readonly contextHeader: React.ReactElement | null;
  readonly beforeSeatBoard: React.ReactElement;
  readonly afterSeatBoard: React.ReactElement | null;
  readonly sideInspector: React.ReactElement | null;
  readonly leadingExtraActions: React.ReactNode;
  readonly trailingExtraActions: React.ReactNode;
  readonly gameOverlays: React.ReactNode;
}

export const RoomShell: React.FC<RoomShellProps> = ({
  model,
  contextHeader,
  beforeSeatBoard,
  afterSeatBoard,
  sideInspector,
  leadingExtraActions,
  trailingExtraActions,
  gameOverlays,
}) => {
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const [isHostManagementOpen, setIsHostManagementOpen] = useState(false);
  const styles = useMemo(() => createRoomShellStyles(colors), []);
  const componentStyles = useMemo(() => createRoomFeatureStyles(colors), []);
  const isWideLayout = usesRoomSideInspector(viewportWidth);
  const isHeaderStacked = usesStackedRoomHeader(viewportWidth);
  const openHostManagement = useCallback(() => {
    if (model.hostManagement === null) {
      throw new Error('Cannot open unavailable Host management');
    }
    setIsHostManagementOpen(true);
  }, [model.hostManagement]);
  const closeHostManagement = useCallback(() => setIsHostManagementOpen(false), []);
  const activeSideInspector =
    isHostManagementOpen && model.hostManagement !== null ? (
      <RoomHostManagementPanel
        model={model.hostManagement}
        isVisible
        presentation="inspector"
        onClose={closeHostManagement}
      />
    ) : (
      sideInspector
    );
  const shouldRenderSideInspector = activeSideInspector !== null && isWideLayout;

  const title = <Text style={styles.headerTitle}>房间 {model.roomCode}</Text>;
  const shareCapability = model.capabilities.canShareRoom;
  const leadingHeaderActions = (
    <View style={styles.headerSide}>
      <Button
        variant="icon"
        onPress={model.header.onBack}
        style={styles.iconButton}
        testID={TESTIDS.roomBackButton}
        accessibilityLabel="离开房间"
      >
        <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
      </Button>
      {leadingExtraActions}
    </View>
  );
  const trailingHeaderActions = (
    <View style={styles.headerSide}>
      {trailingExtraActions}
      <RoomHeaderActions
        userAction={model.header.userAction}
        styles={componentStyles.headerActions}
      />
    </View>
  );
  const centeredHeader = (
    <View style={isHeaderStacked ? styles.headerCenterStacked : styles.headerCenter}>
      <View style={styles.headerTitleRow}>
        {model.header.onTitlePress ? (
          <TouchableOpacity onPress={model.header.onTitlePress} activeOpacity={1}>
            {title}
          </TouchableOpacity>
        ) : (
          title
        )}
        {shareCapability.isAllowed && (
          <Button
            variant="icon"
            size="sm"
            onPress={shareCapability.execute}
            testID={TESTIDS.roomShareButton}
            accessibilityLabel="分享房间"
            buttonColor={colors.surface}
          >
            <Ionicons
              name="share-outline"
              size={componentSizes.icon.sm}
              color={colors.textSecondary}
            />
          </Button>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID={TESTIDS.roomScreenRoot}
    >
      <View
        style={[
          styles.header,
          isHeaderStacked && styles.headerStacked,
          { paddingTop: insets.top + layout.headerPaddingV },
        ]}
        testID={TESTIDS.roomHeader}
      >
        {isHeaderStacked ? (
          <>
            <View style={styles.headerTopRow}>
              {leadingHeaderActions}
              {trailingHeaderActions}
            </View>
            {centeredHeader}
          </>
        ) : (
          <>
            {leadingHeaderActions}
            {centeredHeader}
            {trailingHeaderActions}
          </>
        )}
      </View>

      <RoomStatusRibbon
        connection={model.connection}
        status={model.statusRibbon}
        styles={componentStyles.statusRibbon}
        connectionStatusBarStyles={componentStyles.connectionStatusBar}
        progressIndicatorStyles={componentStyles.progressIndicator}
        hostGuideBannerStyles={componentStyles.hostGuideBanner}
      />

      {model.controlledSeat && (
        <ControlledSeatBanner
          model={model.controlledSeat}
          styles={componentStyles.controlledSeatBanner}
        />
      )}

      <View style={styles.roomContent}>
        <View style={styles.boardColumn}>
          {contextHeader !== null && (
            <View style={styles.contextHeaderContainer}>{contextHeader}</View>
          )}
          <RoomSeatBoard
            model={model.seats}
            header={beforeSeatBoard}
            footer={afterSeatBoard}
            contentContainerStyle={styles.scrollContent}
          />
        </View>
        {shouldRenderSideInspector && (
          <View style={styles.sideInspectorContainer}>{activeSideInspector}</View>
        )}
      </View>

      <RoomBottomActionPanel
        model={model.bottomActions}
        hostManagement={model.hostManagement}
        onOpenHostManagement={openHostManagement}
        styles={componentStyles.bottomActionPanel}
        bottomInset={insets.bottom}
      />

      {model.hostManagement !== null && (
        <RoomHostManagementPanel
          model={model.hostManagement}
          isVisible={isHostManagementOpen && !isWideLayout}
          presentation="sheet"
          onClose={closeHostManagement}
        />
      )}

      {model.seatConfirmation && (
        <RoomSeatConfirmModal
          model={model.seatConfirmation}
          styles={componentStyles.seatConfirmModal}
        />
      )}

      {model.profile && <PlayerProfileCard model={model.profile} />}

      <QRCodeModal model={model.share} />

      {gameOverlays}
    </SafeAreaView>
  );
};
