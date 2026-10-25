/** Shared three-tier room action panel. Games provide only render-ready button models. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { Fragment, memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import type { RoomHostConsolePrimary } from '@/features/room/model/resolveHostConsolePrimary';
import { resolveHostConsolePrimary } from '@/features/room/model/resolveHostConsolePrimary';
import type {
  RoomBottomActionModel,
  RoomBottomButton,
  RoomBottomDockModel,
  RoomBottomToolButton,
  RoomPanelStep,
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
  /** Short viewport (e.g. on-screen keyboard open): status rows use slim spacing. */
  readonly isCompactHeight?: boolean;
}

const RoomBottomActionPanelComponent: React.FC<RoomBottomActionPanelProps> = ({
  model,
  hostManagement,
  onOpenHostManagement,
  styles,
  progressStyles,
  bottomInset,
  isCompactHeight,
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
    (model.kind === 'dock'
      ? model.primary !== null || model.leading !== null || model.trailing !== null
      : model.layout.primary.length > 0 ||
        model.layout.secondary.length > 0 ||
        model.layout.ghost.length > 0);
  const message = model.message;
  const steps = model.kind === 'stacked' ? (model.steps ?? null) : null;
  const hint = model.kind === 'stacked' ? (model.hint ?? null) : null;
  const hasMessage = steps === null && message !== null && message.length > 0;
  if (!hasButtons && !hasMessage && steps === null && model.progress === null) return null;

  const isCompact = isCompactHeight === true;
  const containerStyle = [
    styles.container,
    isCompact && styles.compactContainer,
    model.kind === 'dock' && styles.dockContainer,
    bottomInset > 0 && { paddingBottom: bottomInset },
  ];

  return (
    <View style={containerStyle} testID={TESTIDS.bottomActionPanel}>
      {model.progress !== null && (
        <View style={isCompact ? styles.progressRowCompact : styles.progressRow}>
          <RoomProgressIndicator
            currentStep={model.progress.current}
            totalSteps={model.progress.total}
            currentLabel={model.progress.label}
            styles={progressStyles}
            isCompact={isCompact}
          />
        </View>
      )}

      {steps !== null ? (
        <PanelStepsRow steps={steps} styles={styles} isCompact={isCompact} />
      ) : (
        hasMessage && (
          <Animated.Text
            style={[
              styles.message,
              isCompact && styles.messageCompact,
              { opacity: messageFade, transform: [{ translateY: messageSlide }] },
            ]}
            testID={TESTIDS.actionMessage}
          >
            {message}
          </Animated.Text>
        )
      )}

      {hint !== null && hint.length > 0 && (
        <Text style={[styles.hint, isCompact && styles.hintCompact]}>{hint}</Text>
      )}

      {model.kind === 'dock' ? (
        <DockActions
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

/**
 * Guided step flow rendered in the panel's message row. Completed
 * steps show a check; the current step is highlighted; only steps
 * carrying an onPress (completed / current) respond to taps.
 */
const PanelStepsRow: React.FC<{
  readonly steps: readonly RoomPanelStep[];
  readonly styles: BottomActionPanelStyles;
  readonly isCompact: boolean;
}> = ({ steps, styles, isCompact }) => (
  <View style={[styles.stepsRow, isCompact && styles.stepsRowCompact]}>
    {steps.map((step, index) => (
      <Fragment key={step.key}>
        {index > 0 && <Text style={styles.stepSeparator}>→</Text>}
        <Pressable
          style={styles.stepItem}
          onPress={step.onPress}
          disabled={step.onPress === undefined}
          accessibilityRole="button"
          accessibilityLabel={step.label}
        >
          {step.state === 'complete' && (
            <Ionicons
              name="checkmark-circle"
              size={componentSizes.icon.sm}
              color={colors.success}
            />
          )}
          <Text
            style={
              step.state === 'complete'
                ? styles.stepLabelComplete
                : step.state === 'current'
                  ? styles.stepLabelCurrent
                  : styles.stepLabelUpcoming
            }
          >
            {step.label}
          </Text>
        </Pressable>
      </Fragment>
    ))}
  </View>
);

const DockActions: React.FC<{
  readonly model: RoomBottomDockModel;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly onOpenHostManagement: () => void;
  readonly styles: BottomActionPanelStyles;
}> = ({ model, hostManagement, onOpenHostManagement, styles }) => {
  const hasPrimaryAction =
    model.primary !== null &&
    model.primary.variant === 'primary' &&
    (model.primary.isEnabled || model.primary.isLoading === true);
  return (
    <View style={styles.compactManagementStack}>
      {model.primary !== null && (
        <LayoutButton model={model.primary} style={styles.dockPrimary} styles={styles} />
      )}
      {(model.leading !== null || (hostManagement === null && model.trailing !== null)) && (
        <View style={styles.dockToolRow}>
          <DockTool model={model.leading} styles={styles} />
          {hostManagement === null && <DockTool model={model.trailing} styles={styles} />}
        </View>
      )}
      {hostManagement !== null && (
        <HostManagementBlock
          model={hostManagement}
          hasPrimaryAction={hasPrimaryAction}
          onOpenHostManagement={onOpenHostManagement}
          styles={styles}
        />
      )}
    </View>
  );
};

const StackedActions: React.FC<{
  readonly model: Extract<RoomBottomActionModel, { readonly kind: 'stacked' }>;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly onOpenHostManagement: () => void;
  readonly styles: BottomActionPanelStyles;
}> = ({ model, hostManagement, onOpenHostManagement, styles }) => {
  const hasPrimaryAction = model.layout.primary.some(
    (button) => button.variant === 'primary' && (button.isEnabled || button.isLoading === true),
  );
  return (
    <View style={styles.compactManagementStack}>
      {model.layout.primary.length > 0 && (
        <View style={styles.buttonRow}>
          {model.layout.primary.map((button) => (
            <LayoutButton key={button.key} model={button} styles={styles} />
          ))}
        </View>
      )}

      {model.layout.secondary.length > 0 && (
        <View style={styles.secondaryRow}>
          {model.layout.secondary.map((button) => (
            <LayoutButton
              key={button.key}
              model={button}
              style={styles.secondaryButton}
              styles={styles}
            />
          ))}
        </View>
      )}

      {model.layout.ghost.length > 0 && (
        <View style={styles.ghostRow}>
          {model.layout.ghost.map((button) => (
            <LayoutButton key={button.key} model={button} styles={styles} />
          ))}
        </View>
      )}

      {hostManagement !== null && (
        <HostManagementBlock
          model={hostManagement}
          hasPrimaryAction={hasPrimaryAction}
          onOpenHostManagement={onOpenHostManagement}
          styles={styles}
        />
      )}
    </View>
  );
};

const HostManagementBlock: React.FC<{
  readonly model: RoomHostManagementModel;
  readonly hasPrimaryAction: boolean;
  readonly onOpenHostManagement: () => void;
  readonly styles: BottomActionPanelStyles;
}> = ({ model, hasPrimaryAction, onOpenHostManagement, styles }) => {
  const primary = resolveHostConsolePrimary(model);
  return (
    <View style={styles.hostManagementBlock}>
      {primary !== null && (
        <HostConsolePrimary primary={primary} hasPrimaryAction={hasPrimaryAction} styles={styles} />
      )}
      <HostManagementEntry model={model} onPress={onOpenHostManagement} styles={styles} />
    </View>
  );
};

const HostConsolePrimary: React.FC<{
  readonly primary: RoomHostConsolePrimary;
  readonly hasPrimaryAction: boolean;
  readonly styles: BottomActionPanelStyles;
}> = ({ primary, hasPrimaryAction, styles }) => {
  if (primary.kind === 'ready') {
    return (
      <Button
        variant={hasPrimaryAction ? 'secondary' : 'primary'}
        size="md"
        onPress={primary.onPress}
        testID={TESTIDS.roomNextStepButton}
        accessibilityLabel={primary.label}
        style={[styles.nextStepReady, hasPrimaryAction && styles.secondaryAction]}
        icon={
          <Ionicons
            name="arrow-forward"
            size={componentSizes.icon.sm}
            color={hasPrimaryAction ? colors.text : colors.textInverse}
          />
        }
      >
        {primary.label}
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
          variant="secondary"
          size="md"
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
          color={colors.textSecondary}
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

  const iconColor = !model.isEnabled
    ? colors.textMuted
    : model.tone === 'danger'
      ? colors.error
      : colors.textSecondary;
  const buttonProps = {
    variant: 'secondary' as const,
    size: 'md' as const,
    testID: model.testID,
    accessibilityLabel: model.label,
    textColor: iconColor,
    style: [styles.dockPrimary, styles.secondaryAction],
    icon:
      model.icon === undefined ? undefined : (
        <Ionicons name={model.icon} size={componentSizes.icon.sm} color={iconColor} />
      ),
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
    <View style={styles.dockExpandedToolSlot}>
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
  readonly styles: BottomActionPanelStyles;
}> = ({ model, style, styles }) => {
  const iconColor = !model.isEnabled
    ? colors.textMuted
    : (model.textColor ??
      (model.variant === 'primary' || model.variant === 'danger'
        ? colors.textInverse
        : colors.textSecondary));
  const visualProps = {
    variant: model.variant,
    size: model.size,
    loading: model.isLoading,
    buttonColor: model.buttonColor,
    textColor: model.textColor,
    testID: model.testID,
    accessibilityLabel: model.label,
    icon:
      model.icon === undefined ? undefined : (
        <Ionicons name={model.icon} size={componentSizes.icon.sm} color={iconColor} />
      ),
    style: [styles.actionButton, model.variant === 'secondary' && styles.secondaryAction, style],
  };

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
    <View style={style}>
      {button}
      <DisabledReasonCaption reason={model.disabledReason} />
    </View>
  );
};

export const RoomBottomActionPanel = memo(RoomBottomActionPanelComponent);
RoomBottomActionPanel.displayName = 'RoomBottomActionPanel';
