/**
 * One Pictionary gallery entry: meta row (kind + position), the drawing image
 * or text card, the missed state, and the author row. Game content — it
 * stays in Pictionary and is passed to the shared GalleryAlbumStage as its
 * renderEntry.
 *
 * Moved verbatim from GalleryEntryView in PictionaryGalleryStage.tsx.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type {
  PictionaryEntry,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { roomSurfaceStyles } from '@/features/room/components/RoomSurface.styles';
import {
  getPictionarySeatDisplayName,
  PICTIONARY_MISSED_ENTRY_TEXT,
} from '@/games/pictionary/model/pictionarySelectors';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

import { PictionaryDrawingImage } from './PictionaryDrawingImage';

interface PictionaryGalleryEntryViewProps {
  readonly state: PictionaryState;
  readonly entry: PictionaryEntry;
  readonly entryIndex: number;
}

export const PictionaryGalleryEntryView: React.FC<PictionaryGalleryEntryViewProps> = ({
  state,
  entry,
  entryIndex,
}) => (
  <View style={styles.revealSection} testID={TESTIDS.pictionaryGalleryEntry}>
    <View style={styles.revealMeta}>
      <Text style={styles.entryKind}>
        {entry.kind === 'drawing' ? '画作' : entry.kind === 'text' ? '文字' : '未完成'}
      </Text>
      <Text style={styles.entryPosition}>
        第 {entryIndex + 1} / {state.stepIndex + 1} 棒
      </Text>
    </View>
    {entry.kind === 'drawing' ? (
      <PictionaryDrawingImage
        roomCode={state.roomCode}
        entryId={entry.id}
        accessibilityLabel={`${getPictionarySeatDisplayName(state, entry.authorSeat)} 的画作`}
        controlledSeat={null}
      />
    ) : entry.kind === 'text' ? (
      <View style={styles.textReveal}>
        <Ionicons name="chatbox-ellipses-outline" size={30} color={colors.primary} />
        <Text style={styles.revealText}>{entry.text}</Text>
      </View>
    ) : (
      <View style={styles.missedReveal}>
        <Ionicons name="close-circle-outline" size={36} color={colors.textMuted} />
        <Text style={styles.missedTitle}>{PICTIONARY_MISSED_ENTRY_TEXT}</Text>
        <Text style={styles.missedDescription}>
          原本需要{entry.expectedKind === 'drawing' ? '画一幅画' : '写下猜测'}
        </Text>
      </View>
    )}
    <View style={styles.authorRow}>
      <Ionicons
        name={entry.kind === 'drawing' ? 'brush-outline' : 'person-outline'}
        size={17}
        color={colors.textSecondary}
      />
      <Text style={styles.authorText}>{getPictionarySeatDisplayName(state, entry.authorSeat)}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  revealSection: {
    gap: spacing.small,
    paddingTop: spacing.medium,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.borderLight,
  },
  revealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  entryKind: { ...textStyles.bodySemibold, flex: 1, color: colors.primary },
  entryPosition: { ...textStyles.caption, color: colors.textSecondary },
  textReveal: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.medium,
    padding: spacing.large,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
  },
  revealText: { ...textStyles.titleBold, color: colors.text, textAlign: 'center' },
  missedReveal: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
  },
  missedTitle: roomSurfaceStyles.title,
  missedDescription: { ...textStyles.secondary, color: colors.textSecondary },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.tight },
  authorText: { ...textStyles.secondary, color: colors.textSecondary, flex: 1, minWidth: 0 },
});
