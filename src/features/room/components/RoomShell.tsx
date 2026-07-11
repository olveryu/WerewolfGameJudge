/** Shared visual frame for every game room. Game adapters provide models and explicit slots. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import type { RoomHeaderMenuItem, RoomShellModel } from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, layout } from '@/theme';

import { ControlledSeatBanner } from './ControlledSeatBanner';
import { QRCodeModal } from './QRCodeModal';
import { RoomBottomActionPanel } from './RoomBottomActionPanel';
import { RoomHeaderActions } from './RoomHeaderActions';
import { RoomSeatBoard } from './RoomSeatBoard';
import { RoomSeatConfirmModal } from './RoomSeatConfirmModal';
import { createRoomShellStyles } from './RoomShell.styles';
import { RoomStatusRibbon } from './RoomStatusRibbon';
import { createRoomFeatureStyles } from './styles';

export interface RoomShellProps {
  readonly model: RoomShellModel;
  readonly beforeSeatBoard: React.ReactElement;
  readonly afterSeatBoard: React.ReactElement | null;
  readonly leadingExtraActions: React.ReactNode;
  readonly trailingExtraActions: React.ReactNode;
  readonly gameOverlays: React.ReactNode;
}

export const RoomShell: React.FC<RoomShellProps> = ({
  model,
  beforeSeatBoard,
  afterSeatBoard,
  leadingExtraActions,
  trailingExtraActions,
  gameOverlays,
}) => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createRoomShellStyles(colors), []);
  const componentStyles = useMemo(() => createRoomFeatureStyles(colors), []);
  const menuItems = useMemo(() => buildMenuItems(model), [model]);

  const title = <Text style={styles.headerTitle}>房间 {model.roomCode}</Text>;

  return (
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID={TESTIDS.roomScreenRoot}
    >
      <View
        style={[styles.header, { paddingTop: insets.top + layout.headerPaddingV }]}
        testID={TESTIDS.roomHeader}
      >
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

        <View style={styles.headerCenter}>
          {model.header.onTitlePress ? (
            <TouchableOpacity onPress={model.header.onTitlePress} activeOpacity={1}>
              {title}
            </TouchableOpacity>
          ) : (
            title
          )}
        </View>

        <View style={styles.headerSide}>
          {trailingExtraActions}
          <RoomHeaderActions
            userAction={model.header.userAction}
            items={menuItems}
            styles={componentStyles.headerActions}
          />
        </View>
      </View>

      <RoomStatusRibbon
        connection={model.connection}
        status={model.statusRibbon}
        styles={componentStyles.statusRibbon}
        connectionStatusBarStyles={componentStyles.connectionStatusBar}
        nightProgressIndicatorStyles={componentStyles.nightProgressIndicator}
        hostGuideBannerStyles={componentStyles.hostGuideBanner}
      />

      {model.controlledSeat && (
        <ControlledSeatBanner
          model={model.controlledSeat}
          styles={componentStyles.controlledSeatBanner}
        />
      )}

      <RoomSeatBoard
        model={model.seats}
        header={beforeSeatBoard}
        footer={afterSeatBoard}
        contentContainerStyle={styles.scrollContent}
      />

      <RoomBottomActionPanel
        model={model.bottomActions}
        styles={componentStyles.bottomActionPanel}
        bottomInset={insets.bottom}
      />

      {model.seatConfirmation && (
        <RoomSeatConfirmModal
          model={model.seatConfirmation}
          styles={componentStyles.seatConfirmModal}
        />
      )}

      <QRCodeModal model={model.share} />

      {gameOverlays}
    </SafeAreaView>
  );
};

function buildMenuItems(model: RoomShellModel): readonly RoomHeaderMenuItem[] {
  const utilityItems = model.header.menuItems.filter((item) => item.group === 'utility');
  const operationItems = model.header.menuItems.filter((item) => item.group === 'operation');
  const sharedUtility: RoomHeaderMenuItem[] = [];
  const sharedOperations: RoomHeaderMenuItem[] = [];

  if (model.capabilities.canShareRoom.isAllowed) {
    sharedUtility.push({
      id: 'share-room',
      label: '分享房间',
      icon: 'share-outline',
      group: 'utility',
      tone: 'default',
      onPress: model.capabilities.canShareRoom.execute,
    });
  }
  const clearSeats = model.capabilities.canClearSeats;
  if (clearSeats.isAllowed) {
    sharedOperations.push({
      id: 'clear-seats',
      label: '清空座位',
      icon: 'exit-outline',
      group: 'operation',
      tone: 'danger',
      onPress: clearSeats.execute,
    });
  }
  const fillBots = model.capabilities.canFillBots;
  if (fillBots.isAllowed) {
    sharedOperations.push({
      id: 'fill-bots',
      label: '填充机器人',
      icon: 'people-outline',
      group: 'operation',
      tone: 'default',
      onPress: fillBots.execute,
    });
  }

  return [...sharedUtility, ...utilityItems, ...sharedOperations, ...operationItems];
}
