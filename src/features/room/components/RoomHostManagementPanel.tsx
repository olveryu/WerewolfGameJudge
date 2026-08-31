/** Shared host management surface. It renders game-owned actions without deriving permissions. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
} from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  textStyles,
  withAlpha,
} from '@/theme';

interface RoomHostManagementPanelProps {
  readonly model: RoomHostManagementModel;
  readonly isVisible: boolean;
  readonly presentation: 'sheet' | 'inspector';
  readonly onClose: () => void;
}

const RoomHostManagementPanelComponent: React.FC<RoomHostManagementPanelProps> = ({
  model,
  isVisible,
  presentation,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  if (!isVisible) return null;

  if (presentation === 'inspector') {
    return (
      <View style={styles.inspector} testID={TESTIDS.roomHostManagementPanel}>
        <ManagementContent model={model} bottomInset={spacing.xlarge} onClose={onClose} />
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          testID={TESTIDS.roomHostManagementPanel}
          onPress={() => {
            // Keep taps inside the sheet from dismissing it.
          }}
          accessibilityViewIsModal
        >
          <View style={styles.sheetHandle} />
          <ManagementContent
            model={model}
            bottomInset={Math.max(spacing.xlarge, insets.bottom + spacing.medium)}
            onClose={onClose}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const ManagementContent: React.FC<{
  readonly model: RoomHostManagementModel;
  readonly bottomInset: number;
  readonly onClose: () => void;
}> = ({ model, bottomInset, onClose }) => (
  <>
    <View style={styles.header}>
      <View style={styles.heading}>
        <Text style={styles.title}>主持管理</Text>
        {model.status !== null && <Text style={styles.status}>{model.status}</Text>}
      </View>
      <Button
        variant="icon"
        size="sm"
        onPress={onClose}
        accessibilityLabel="关闭主持管理"
        buttonColor={colors.surface}
      >
        <Ionicons name="close" size={componentSizes.icon.md} color={colors.textSecondary} />
      </Button>
    </View>

    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator
    >
      <View style={styles.previewRow}>
        <Ionicons
          name="shield-checkmark-outline"
          size={componentSizes.icon.md}
          color={colors.primary}
        />
        <Text style={styles.preview}>{model.preview}</Text>
      </View>

      {model.sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.actionList}>
            {section.actions.map((action) => (
              <ManagementAction key={action.key} action={action} onClose={onClose} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  </>
);

const ManagementAction: React.FC<{
  readonly action: RoomHostManagementAction;
  readonly onClose: () => void;
}> = ({ action, onClose }) => {
  const iconColor = !action.isEnabled
    ? colors.textMuted
    : action.variant === 'primary' || action.variant === 'danger'
      ? colors.textInverse
      : colors.textSecondary;
  const visualProps = {
    variant: action.variant,
    size: 'md' as const,
    loading: action.isLoading,
    icon: <Ionicons name={action.icon} size={componentSizes.icon.sm} color={iconColor} />,
    testID: action.testID,
    style: styles.actionButton,
  };

  if (action.isEnabled) {
    return (
      <Button
        {...visualProps}
        onPress={() => {
          onClose();
          action.onPress();
        }}
      >
        {action.label}
      </Button>
    );
  }
  if (action.onDisabledPress === null) {
    return (
      <Button {...visualProps} disabled>
        {action.label}
      </Button>
    );
  }
  return (
    <Button {...visualProps} disabled onDisabledPress={action.onDisabledPress}>
      {action.label}
    </Button>
  );
};

const styles = StyleSheet.create({
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: withAlpha(colors.text, 0.45),
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    overflow: 'hidden',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: componentSizes.avatar.md,
    height: fixed.borderWidthHighlight,
    marginTop: spacing.small,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
  },
  inspector: {
    flex: 1,
    backgroundColor: colors.background,
    borderLeftWidth: fixed.borderWidth,
    borderLeftColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.medium,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
  },
  heading: {
    flex: 1,
    minWidth: 0,
    gap: spacing.micro,
  },
  title: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  status: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.large,
    paddingTop: spacing.medium,
    gap: spacing.large,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingBottom: spacing.medium,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
  },
  preview: {
    ...textStyles.bodySemibold,
    color: colors.text,
    flex: 1,
  },
  section: {
    gap: spacing.small,
  },
  sectionTitle: {
    ...textStyles.secondarySemibold,
    color: colors.textSecondary,
  },
  actionList: {
    gap: spacing.small,
  },
  actionButton: {
    alignSelf: 'stretch',
  },
});

export const RoomHostManagementPanel = memo(RoomHostManagementPanelComponent);
RoomHostManagementPanel.displayName = 'RoomHostManagementPanel';
