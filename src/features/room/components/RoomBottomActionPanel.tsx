/** Shared three-tier room action panel. Games provide only render-ready button models. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import type { RoomHostConsolePrimary } from '@/features/room/model/resolveHostConsolePrimary';
import { resolveHostConsolePrimary } from '@/features/room/model/resolveHostConsolePrimary';
import type {
  RoomBottomActionModel,
  RoomBottomButton,
  RoomBottomDockModel,
  RoomBottomInfoModel,
  RoomBottomToolButton,
} from '@/features/room/model/RoomBottomActions';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import { HOST_MANAGEMENT_LABEL } from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import { colors, componentSizes } from '@/theme';

import { DisabledReasonCaption } from './DisabledReasonCaption';
import { RoomProgressIndicator } from './RoomProgressIndicator';
import type { BottomActionPanelStyles, RoomProgressIndicatorStyles } from './styles';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface RoomBottomActionPanelProps {
  readonly model: RoomBottomActionModel;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly onOpenHostManagement: () => void;
  readonly styles: BottomActionPanelStyles;
  readonly progressStyles: RoomProgressIndicatorStyles;
  readonly bottomInset: number;
}

const RoomBottomActionPanelComponent: React.FC<RoomBottomActionPanelProps> = ({
  model,
  hostManagement,
  onOpenHostManagement,
  styles,
  progressStyles,
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
  if (!hasButtons && !hasMessage && model.progress === null) return null;

  const containerStyle = [
    styles.container,
    model.kind === 'dock' && styles.dockContainer,
    bottomInset > 0 && { paddingBottom: bottomInset },
  ];

  return (
    <View style={containerStyle} testID={TESTIDS.bottomActionPanel}>
      {model.progress !== null && (
        <View style={styles.progressRow}>
          <RoomProgressIndicator
            currentStep={model.progress.current}
            totalSteps={model.progress.total}
            currentLabel={model.progress.label}
            styles={progressStyles}
          />
        </View>
      )}

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
  const shouldStackTools =
    hostManagement === null && model.leading !== null && model.trailing !== null;
  const dockContent = shouldStackTools ? (
    <View style={styles.compactManagementStack}>
      <LayoutButton model={model.primary} style={styles.dockPrimary} />
      <View style={styles.dockToolRow}>
        <DockTool model={model.leading} isExpanded styles={styles} />
        <DockTool model={model.trailing} isExpanded styles={styles} />
      </View>
    </View>
  ) : (
    <View style={styles.dockRow}>
      <DockTool model={model.leading} isExpanded={false} styles={styles} />
      <View style={styles.dockCenter}>
        <LayoutButton model={model.primary} style={styles.dockPrimary} />
      </View>
      {hostManagement === null && (
        <DockTool model={model.trailing} isExpanded={false} styles={styles} />
      )}
    </View>
  );
  if (hostManagement === null) return dockContent;
  return (
    <View style={styles.compactManagementStack}>
      {dockContent}
      <HostManagementBlock
        model={hostManagement}
        onOpenHostManagement={onOpenHostManagement}
        styles={styles}
      />
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
        <HostManagementBlock
          model={hostManagement}
          onOpenHostManagement={onOpenHostManagement}
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
      <HostManagementBlock
        model={hostManagement}
        onOpenHostManagement={onOpenHostManagement}
        styles={styles}
      />
    )}
  </View>
);

const HostManagementBlock: React.FC<{
  readonly model: RoomHostManagementModel;
  readonly onOpenHostManagement: () => void;
  readonly styles: BottomActionPanelStyles;
}> = ({ model, onOpenHostManagement, styles }) => {
  const primary = resolveHostConsolePrimary(model);
  return (
    <View style={styles.compactManagementStack}>
      {primary !== null && <HostConsolePrimary primary={primary} styles={styles} />}
      <HostManagementEntry model={model} onPress={onOpenHostManagement} styles={styles} />
    </View>
  );
};

const HostConsolePrimary: React.FC<{
  readonly primary: RoomHostConsolePrimary;
  readonly styles: BottomActionPanelStyles;
}> = ({ primary, styles }) => {
  if (primary.kind === 'ready') {
    return (
      <Button
        variant="primary"
        size="md"
        onPress={primary.onPress}
        testID={TESTIDS.roomNextStepButton}
        accessibilityLabel={`下一步：${primary.label}`}
        style={styles.nextStepReady}
      >
        <View style={styles.nextStepContent}>
          <Text style={styles.nextStepReadyLabel} numberOfLines={1}>
            {`下一步：${primary.label}`}
          </Text>
          <Ionicons name="arrow-forward" size={componentSizes.icon.sm} color={colors.textInverse} />
        </View>
      </Button>
    );
  }
  const { reason, remedy } = primary;
  return (
    <View style={styles.nextStepBlocked}>
      <View style={styles.nextStepBlockedText}>
        <Text style={styles.nextStepBlockedLabel}>{primary.label}</Text>
        <Text style={styles.nextStepBlockedReason}>{reason}</Text>
      </View>
      {remedy !== null && (
        <Button
          variant="primary"
          size="sm"
          onPress={remedy.onPress}
          testID={TESTIDS.roomNextStepRemedyButton}
        >
          {remedy.label}
        </Button>
      )}
    </View>
  );
};

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
    accessibilityLabel={HOST_MANAGEMENT_LABEL}
    style={styles.hostManagementEntry}
  >
    <View style={styles.hostManagementContent}>
      <View style={styles.hostManagementTitleRow}>
        <Ionicons
          name="shield-checkmark-outline"
          size={componentSizes.icon.sm}
          color={colors.textInverse}
        />
        <Text style={styles.hostManagementTitle} numberOfLines={1}>
          {HOST_MANAGEMENT_LABEL}
        </Text>
      </View>
      <View style={styles.hostManagementExpandRow}>
        {model.hasPendingAction === true && (
          <Text style={styles.hostManagementPending} numberOfLines={1}>
            待处理
          </Text>
        )}
        <Text style={styles.hostManagementExpandLabel} numberOfLines={1}>
          全部操作
        </Text>
        <Ionicons name="chevron-forward" size={componentSizes.icon.sm} color={colors.textInverse} />
      </View>
    </View>
  </Button>
);

const DockTool: React.FC<{
  readonly model: RoomBottomToolButton | null;
  readonly isExpanded: boolean;
  readonly styles: BottomActionPanelStyles;
}> = ({ model, isExpanded, styles }) => {
  if (model === null) return null;

  const iconColor = model.tone === 'danger' ? colors.error : colors.textSecondary;
  const buttonProps = {
    variant: 'secondary' as const,
    size: 'lg' as const,
    testID: model.testID,
    accessibilityLabel: model.label,
    textColor: iconColor,
    style: isExpanded ? styles.dockPrimary : undefined,
  };

  const button = model.isEnabled ? (
    <Button {...buttonProps} onPress={model.onPress}>
      {model.label}
    </Button>
  ) : (
    <Button {...buttonProps} disabled>
      {model.label}
    </Button>
  );

  return (
    <View style={isExpanded ? styles.dockExpandedToolSlot : styles.toolSlot}>
      {button}
      {!model.isEnabled && model.disabledReason !== null && model.disabledReason.length > 0 && (
        <DisabledReasonCaption reason={model.disabledReason} />
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

  const button = (
    <Button {...visualProps} disabled>
      {model.label}
    </Button>
  );

  if (model.disabledReason === null || model.disabledReason.length === 0) return button;
  return (
    <View>
      {button}
      <DisabledReasonCaption reason={model.disabledReason} />
    </View>
  );
};

export const RoomBottomActionPanel = memo(RoomBottomActionPanelComponent);
RoomBottomActionPanel.displayName = 'RoomBottomActionPanel';
