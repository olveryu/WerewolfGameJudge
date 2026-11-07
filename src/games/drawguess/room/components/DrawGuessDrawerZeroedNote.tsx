/**
 * 结算提示：全员猜中导致画手本轮收入清零时，结算榜上方的一行说明。
 */

import { StyleSheet, Text } from 'react-native';

import { colors, textStyles } from '@/theme';

import {
  DRAWGUESS_DRAWER_ZEROED_DETAIL,
  DRAWGUESS_DRAWER_ZEROED_TITLE,
} from '../../model/drawGuessResults';

/** 结算榜上方的清零说明整句。 */
export const DRAWGUESS_DRAWER_ZEROED_NOTE = `${DRAWGUESS_DRAWER_ZEROED_TITLE}：${DRAWGUESS_DRAWER_ZEROED_DETAIL}`;

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
