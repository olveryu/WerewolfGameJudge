/** Adaptive containers for sheriff details: blocking sheet on compact screens, inspector on wide screens. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, spacing } from '@/theme';

import { SheriffElectionPanel } from './SheriffElectionPanel';
import type { SheriffElectionPanelStyles } from './sheriffElectionPanel.styles';

interface SheriffElectionSurfaceProps {
  readonly model: SheriffElectionPanelModel;
  readonly styles: SheriffElectionPanelStyles;
}

interface SheriffElectionSheetProps extends SheriffElectionSurfaceProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

const SheriffElectionSheetComponent: React.FC<SheriffElectionSheetProps> = ({
  visible,
  model,
  styles,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={() => {
            // Keep taps inside the sheet from dismissing it.
          }}
          accessibilityViewIsModal
          testID={TESTIDS.sheriffElectionSheet}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetCloseRow}>
            <Button
              variant="icon"
              size="sm"
              onPress={onClose}
              accessibilityLabel="关闭警长竞选详情"
              testID={TESTIDS.sheriffDetailsCloseButton}
            >
              <Ionicons name="close" size={componentSizes.icon.md} color={colors.textSecondary} />
            </Button>
          </View>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={[
              styles.sheetScrollContent,
              { paddingBottom: Math.max(spacing.xlarge, insets.bottom + spacing.medium) },
            ]}
            showsVerticalScrollIndicator
          >
            <SheriffElectionPanel model={model} styles={styles} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const SheriffElectionInspectorComponent: React.FC<SheriffElectionSurfaceProps> = ({
  model,
  styles,
}) => (
  <View style={styles.inspector} testID={TESTIDS.sheriffElectionInspector}>
    <ScrollView
      style={styles.inspectorScroll}
      contentContainerStyle={styles.inspectorScrollContent}
      showsVerticalScrollIndicator
    >
      <SheriffElectionPanel model={model} styles={styles} />
    </ScrollView>
  </View>
);

export const SheriffElectionSheet = memo(SheriffElectionSheetComponent);
SheriffElectionSheet.displayName = 'SheriffElectionSheet';

export const SheriffElectionInspector = memo(SheriffElectionInspectorComponent);
SheriffElectionInspector.displayName = 'SheriffElectionInspector';
