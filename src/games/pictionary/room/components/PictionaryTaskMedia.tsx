/**
 * Fit a canonical 4:3 drawing into the remaining task area.
 *
 * Pictionary-owned media fitting moved out of PictionaryTaskFrame when
 * the frame skeleton moved to the shared RoomTaskFrame. The 4:3 fit
 * rule stays with this game.
 */

import type React from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

/** Centers a 4:3 child inside the measured task area without cropping. */
export const PictionaryTaskMedia: React.FC<{ readonly children: React.ReactNode }> = ({
  children,
}) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const width = Math.min(size.width, (size.height * 4) / 3);
  return (
    <View
      style={styles.media}
      onLayout={({ nativeEvent }) =>
        setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })
      }
    >
      <View style={{ width, height: (width * 3) / 4 }}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  media: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
