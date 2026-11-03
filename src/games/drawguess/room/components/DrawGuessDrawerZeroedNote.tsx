/**
 * 结算提示：全员猜中导致画手本轮收入清零时，结算榜上方的一行说明。
 */

import { StyleSheet, Text } from 'react-native';

import { colors, textStyles } from '@/theme';

export const DRAWGUESS_DRAWER_ZEROED_NOTE = '全员猜中：画得太简单了，画手本轮 0 分';

export function DrawGuessDrawerZeroedNote({ visible }: { readonly visible: boolean }) {
  if (!visible) return null;
  return (
    <Text
      style={styles.note}
      accessibilityLabel={DRAWGUESS_DRAWER_ZEROED_NOTE}
      testID="drawguess-drawer-zeroed-note"
    >
      {DRAWGUESS_DRAWER_ZEROED_NOTE}
    </Text>
  );
}

const styles = StyleSheet.create({
  note: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
});
