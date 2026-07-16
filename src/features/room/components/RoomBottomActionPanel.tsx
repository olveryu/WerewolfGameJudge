/** Shared three-tier room action panel. Games provide only render-ready button models. */

import type React from 'react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';

import { Button } from '@/components/Button';
import type {
  RoomBottomActionModel,
  RoomBottomButton,
} from '@/features/room/model/RoomBottomActions';
import { TESTIDS } from '@/testids';

import type { BottomActionPanelStyles } from './styles';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface RoomBottomActionPanelProps {
  readonly model: RoomBottomActionModel;
  readonly styles: BottomActionPanelStyles;
  readonly bottomInset: number;
}

const RoomBottomActionPanelComponent: React.FC<RoomBottomActionPanelProps> = ({
  model,
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
    model.layout.primary.length > 0 ||
    model.layout.secondary.length > 0 ||
    model.layout.ghost.length > 0;
  if (!hasButtons && !model.message) return null;

  const containerStyle =
    bottomInset > 0 ? [styles.container, { paddingBottom: bottomInset }] : styles.container;

  return (
    <View style={containerStyle} testID={TESTIDS.bottomActionPanel}>
      {model.message && (
        <Animated.Text
          style={[
            styles.message,
            { opacity: messageFade, transform: [{ translateY: messageSlide }] },
          ]}
          testID={TESTIDS.actionMessage}
        >
          {model.message}
        </Animated.Text>
      )}

      {(model.layout.primary.length > 0 || model.layout.secondary.length > 0) && (
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
    </View>
  );
};

const LayoutButton: React.FC<{ readonly model: RoomBottomButton }> = ({ model }) => {
  const visualProps = {
    variant: model.variant,
    size: model.size,
    buttonColor: model.buttonColor,
    textColor: model.textColor,
    testID: model.testID,
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
