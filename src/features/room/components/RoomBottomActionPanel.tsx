/** Shared three-tier room action panel. Games provide only render-ready button models. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import type {
  RoomBottomActionModel,
  RoomBottomButton,
  RoomBottomDockModel,
  RoomBottomInfoModel,
  RoomBottomToolButton,
} from '@/features/room/model/RoomBottomActions';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import { colors, componentSizes } from '@/theme';

import type { BottomActionPanelStyles } from './styles';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface RoomBottomActionPanelProps {
  readonly model: RoomBottomActionModel;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly onOpenHostManagement: () => void;
  readonly styles: BottomActionPanelStyles;
  readonly bottomInset: number;
}

const RoomBottomActionPanelComponent: React.FC<RoomBottomActionPanelProps> = ({
  model,
  hostManagement,
  onOpenHostManagement,
  styles,
  bottomInset,
}) => {
  const messageFade = useMemo(() => new Animated.Value(1), []);
  const messageSlide = useMemo(() => new Animated.Value(0), []);
  const previousMessage = useRef(model.message);

  useEffect(() => {
    if (previousMessage.current !== model.message && model.message && USE_NATIVE_DRIVER) {
      messageFade.setValue(0);
      messageSlide.setValue(4);
      Animated.parallel([
        Animated.timing(messageFade, {
          toValue: 1,
          duration: 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(messageSlide, {
          toValue: 0,
          duration: 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
    previousMessage.current = model.message;
  }, [model.message, messageFade, messageSlide]);

  const hasButtons =
    hostManagement !== null ||
    model.kind === 'dock' ||
    (model.kind === 'info'
      ? model.actions.length > 0
      : model.layout.primary.length > 0 ||
        model.layout.secondary.length > 0 ||
        model.layout.ghost.length > 0);
  const message = model.message;
  const hasMessage = message !== null && message.length > 0;
  if (!hasButtons && !hasMessage) return null;

  const containerStyle = [
    styles.container,
    model.kind === 'dock' && styles.dockContainer,
    bottomInset > 0 && { paddingBottom: bottomInset },
  ];

  return (
    <View style={containerStyle} testID={TESTIDS.bottomActionPanel}>
      {hasMessage && (
        <Animated.Text
          style={[
            styles.message,
            { opacity: messageFade, transform: [{ translateY: messageSlide }] },
          ]}
          testID={TESTIDS.actionMessage}
        >
          {message}
        </Animated.Text>
      )}

      {model.kind === 'dock' ? (
        <DockActions
          model={model}
          hostManagement={hostManagement}
          onOpenHostManagement={onOpenHostManagement}
          styles={styles}
        />
      ) : model.kind === 'info' ? (
        <InfoActions
          model={model}
          hostManagement={hostManagement}
          onOpenHostManagement={onOpenHostManagement}
          styles={styles}
        />
      ) : (
        <StackedActions
          model={model}
          hostManagement={hostManagement}
          onOpenHostManagement={onOpenHostManagement}
          styles={styles}
        />
      )}
    </View>
  );
};

const DockActions: React.FC<{
  readonly model: RoomBottomDockModel;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly onOpenHostManagement: () => void;
  readonly styles: BottomActionPanelStyles;
}> = ({ model, hostManagement, onOpenHostManagement, styles }) => {
  const dockRow = (
    <View style={styles.dockRow}>
      <DockTool model={model.leading} styles={styles} />
      <View style={styles.dockCenter}>
        <LayoutButton model={model.primary} style={styles.dockPrimary} />
      </View>
      {hostManagement === null && <DockTool model={model.trailing} styles={styles} />}
    </View>
  );
  if (hostManagement === null) return dockRow;
  return (
    <View style={styles.compactManagementStack}>
      {dockRow}
      <HostManagementEntry model={hostManagement} onPress={onOpenHostManagement} styles={styles} />
    </View>
  );
};

const StackedActions: React.FC<{
  readonly model: Extract<RoomBottomActionModel, { readonly kind: 'stacked' }>;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly onOpenHostManagement: () => void;
  readonly styles: BottomActionPanelStyles;
}> = ({ model, hostManagement, onOpenHostManagement, styles }) => {
  const hasPlayerActions = model.layout.primary.length > 0 || model.layout.secondary.length > 0;
  return (
    <View style={styles.compactManagementStack}>
      {hasPlayerActions && (
        <View style={styles.buttonRow}>
          {model.layout.primary.map((button) => (
            <LayoutButton key={button.key} model={button} />
          ))}
          {model.layout.secondary.map((button) => (
            <LayoutButton key={button.key} model={button} />
          ))}
        </View>
      )}

      {model.layout.ghost.length > 0 && (
        <View style={styles.ghostRow}>
          {model.layout.ghost.map((button) => (
            <LayoutButton key={button.key} model={button} />
          ))}
        </View>
      )}

      {hostManagement !== null && (
        <HostManagementEntry
          model={hostManagement}
          onPress={onOpenHostManagement}
          styles={styles}
        />
      )}
    </View>
  );
};

const InfoActions: React.FC<{
  readonly model: RoomBottomInfoModel;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly onOpenHostManagement: () => void;
  readonly styles: BottomActionPanelStyles;
}> = ({ model, hostManagement, onOpenHostManagement, styles }) => (
  <View style={styles.compactManagementStack}>
    {model.actions.length > 0 && (
      <View style={styles.infoRow}>
        {model.actions.map((action) => (
          <View key={action.key} style={styles.infoAction}>
            <LayoutButton model={action} />
          </View>
        ))}
      </View>
    )}
    {hostManagement !== null && (
      <HostManagementEntry model={hostManagement} onPress={onOpenHostManagement} styles={styles} />
    )}
  </View>
);

const HostManagementEntry: React.FC<{
  readonly model: RoomHostManagementModel;
  readonly onPress: () => void;
  readonly styles: BottomActionPanelStyles;
}> = ({ model, onPress, styles }) => (
  <Button
    variant="secondary"
    size="md"
    onPress={onPress}
    testID={TESTIDS.roomHostManagementButton}
    accessibilityLabel={`主持管理，${model.preview}`}
    style={styles.hostManagementEntry}
  >
    <View style={styles.hostManagementContent}>
      <View style={styles.hostManagementTitleRow}>
        <Ionicons
          name="shield-checkmark-outline"
          size={componentSizes.icon.sm}
          color={colors.textSecondary}
        />
        <Text style={styles.hostManagementTitle} numberOfLines={1}>
          主持管理
        </Text>
      </View>
      <View style={styles.hostManagementPreviewRow}>
        <Text style={styles.hostManagementPreview} numberOfLines={1}>
          {model.preview}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={componentSizes.icon.sm}
          color={colors.textSecondary}
        />
      </View>
    </View>
  </Button>
);

const DockTool: React.FC<{
  readonly model: RoomBottomToolButton | null;
  readonly styles: BottomActionPanelStyles;
}> = ({ model, styles }) => {
  if (model === null) return null;

  const iconColor = model.tone === 'danger' ? colors.error : colors.textSecondary;
  const buttonProps = {
    variant: 'secondary' as const,
    size: 'lg' as const,
    testID: model.testID,
    accessibilityLabel: model.label,
    textColor: iconColor,
  };

  return (
    <View style={styles.toolSlot}>
      {model.isEnabled ? (
        <Button {...buttonProps} onPress={model.onPress}>
          {model.label}
        </Button>
      ) : model.onDisabledPress === null ? (
        <Button {...buttonProps} disabled>
          {model.label}
        </Button>
      ) : (
        <Button {...buttonProps} disabled onDisabledPress={model.onDisabledPress}>
          {model.label}
        </Button>
      )}
    </View>
  );
};

const LayoutButton: React.FC<{
  readonly model: RoomBottomButton;
  readonly style?: BottomActionPanelStyles['dockPrimary'];
}> = ({ model, style }) => {
  const visualProps = {
    variant: model.variant,
    size: model.size,
    loading: model.isLoading,
    buttonColor: model.buttonColor,
    textColor: model.textColor,
    testID: model.testID,
    style,
  } as const;

  if (model.isEnabled) {
    return (
      <Button {...visualProps} onPress={model.onPress}>
        {model.label}
      </Button>
    );
  }

  if (model.onDisabledPress === null) {
    return (
      <Button {...visualProps} disabled>
        {model.label}
      </Button>
    );
  }

  return (
    <Button {...visualProps} disabled onDisabledPress={model.onDisabledPress}>
      {model.label}
    </Button>
  );
};

export const RoomBottomActionPanel = memo(RoomBottomActionPanelComponent);
RoomBottomActionPanel.displayName = 'RoomBottomActionPanel';
