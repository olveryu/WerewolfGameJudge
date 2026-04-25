/**
 * UnlocksScreen cell components — grid cell + type-specific thumbnail renderers
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { type FrameId } from '@/components/avatarFrames';
import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import { NameStyleText } from '@/components/nameStyles';
import { RarityCellBg } from '@/components/RarityCellBg';
import { SEAT_FLAIRS } from '@/components/seatFlairs';
import { getAnimationOption } from '@/components/SettingsSheet/animationOptions';
import { getRarityCellConfig, getRarityCellStyle } from '@/config/rarityVisual';
import { borderRadius, colors, shadows, spacing, typography, withAlpha } from '@/theme';
import { AVATAR_KEYS, getAvatarThumbByIndex } from '@/utils/avatar';

import type { UnlockItem } from './useUnlocksScreenState';

const CELL_SIZE = 80;

const CHECK_BADGE_SIZE = 18;
const LOCK_BADGE_SIZE = 16;
const FLAIR_PREVIEW_SIZE = CELL_SIZE - spacing.small * 2;
const NAME_STYLE_PREVIEW_SIZE = CELL_SIZE - spacing.small * 2;
const EFFECT_PREVIEW_SIZE = CELL_SIZE - spacing.small * 2;

// ── Main cell ───────────────────────────────────────────────────────────────

export const UnlockCell = React.memo<{ item: UnlockItem }>(({ item }) => {
  const thumb =
    item.type === 'avatar' ? (
      <AvatarThumb id={item.id} unlocked={item.unlocked} />
    ) : item.type === 'frame' ? (
      <FrameThumb id={item.id} unlocked={item.unlocked} />
    ) : item.type === 'nameStyle' ? (
      <NameStyleThumb id={item.id} displayName={item.displayName} />
    ) : item.type === 'effect' ? (
      <EffectThumb id={item.id} unlocked={item.unlocked} />
    ) : (
      <FlairThumb id={item.id} unlocked={item.unlocked} />
    );

  // nameStyle cells: show styled effect name when unlocked, '???' when locked
  const label =
    item.type === 'nameStyle' && item.unlocked ? (
      <NameStyleText styleId={item.id} style={styles.cellName} numberOfLines={1}>
        {item.displayName}
      </NameStyleText>
    ) : (
      <Text style={[styles.cellName, !item.unlocked && styles.lockedText]} numberOfLines={1}>
        {item.unlocked ? item.displayName : '???'}
      </Text>
    );

  const rarityCfg = getRarityCellConfig(item.rarity);
  const rarityCellStyle = getRarityCellStyle(item.rarity);

  return (
    <View style={styles.cell}>
      <View
        style={[
          styles.imageWrapper,
          item.unlocked ? styles.unlockedBorder : styles.lockedBg,
          item.unlocked && rarityCellStyle,
        ]}
      >
        {item.unlocked && rarityCfg && (
          <RarityCellBg rarity={item.rarity} borderRadius={borderRadius.medium - 2} />
        )}
        {thumb}
        {/* Badge overlay */}
        {item.unlocked ? (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={12} color={colors.textInverse} />
          </View>
        ) : (
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={10} color={colors.textInverse} />
          </View>
        )}
      </View>
      {label}
    </View>
  );
});

UnlockCell.displayName = 'UnlockCell';

// ── Type-specific thumbnails ────────────────────────────────────────────────

const AvatarThumb = React.memo<{ id: string; unlocked: boolean }>(({ id, unlocked }) => {
  const avatarIndex = (AVATAR_KEYS as readonly string[]).indexOf(id);
  const thumbSource = avatarIndex >= 0 ? getAvatarThumbByIndex(avatarIndex) : undefined;

  if (thumbSource == null) return null;

  return (
    <Image
      source={thumbSource as ImageSourcePropType}
      style={[styles.avatarImage, !unlocked && styles.grayscale]}
      resizeMode="cover"
    />
  );
});

AvatarThumb.displayName = 'AvatarThumb';

const FrameThumb = React.memo<{ id: string; unlocked: boolean }>(({ id, unlocked }) => (
  <View style={!unlocked ? styles.grayscale : undefined}>
    <AvatarWithFrame
      value="preview"
      avatarUrl={null}
      frameId={id as FrameId}
      size={CELL_SIZE - spacing.small * 2}
    />
  </View>
));

FrameThumb.displayName = 'FrameThumb';

const FlairThumb = React.memo<{ id: string; unlocked: boolean }>(({ id, unlocked }) => {
  const flair = SEAT_FLAIRS.find((f) => f.id === id);
  if (!flair) return null;
  const Comp = flair.Component;
  return (
    <View
      style={[
        { width: FLAIR_PREVIEW_SIZE, height: FLAIR_PREVIEW_SIZE },
        !unlocked && styles.grayscale,
      ]}
    >
      <Comp size={FLAIR_PREVIEW_SIZE} borderRadius={borderRadius.medium} />
    </View>
  );
});

FlairThumb.displayName = 'FlairThumb';

const NameStyleThumb = React.memo<{ id: string; displayName: string }>(({ id, displayName }) => {
  return (
    <View
      style={[
        styles.nameStylePreview,
        { width: NAME_STYLE_PREVIEW_SIZE, height: NAME_STYLE_PREVIEW_SIZE },
      ]}
    >
      <NameStyleText styleId={id} style={styles.nameStylePreviewText}>
        {displayName}
      </NameStyleText>
    </View>
  );
});

NameStyleThumb.displayName = 'NameStyleThumb';

const EffectThumb = React.memo<{ id: string; unlocked: boolean }>(({ id, unlocked }) => {
  const opt = getAnimationOption(id);
  const iconName = (opt?.icon ?? 'help-outline') as React.ComponentProps<typeof Ionicons>['name'];
  return (
    <View
      style={[
        styles.effectPreview,
        { width: EFFECT_PREVIEW_SIZE, height: EFFECT_PREVIEW_SIZE },
        !unlocked && styles.grayscale,
      ]}
    >
      <Ionicons name={iconName} size={28} color={unlocked ? colors.text : colors.textMuted} />
    </View>
  );
});

EffectThumb.displayName = 'EffectThumb';

// ── Styles ──────────────────────────────────────────────────────────────────

const NUM_COLUMNS = 4;

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    alignItems: 'center',
    marginBottom: spacing.medium,
    maxWidth: `${100 / NUM_COLUMNS}%`,
  },
  imageWrapper: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: withAlpha(colors.border, 0),
  },
  unlockedBorder: {
    borderColor: colors.background,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  lockedBg: {
    backgroundColor: withAlpha(colors.border, 0.3),
    opacity: 0.5,
  },
  avatarImage: {
    width: CELL_SIZE - 4,
    height: CELL_SIZE - 4,
  },
  grayscale: {
    opacity: 0.4,
  },
  nameStylePreview: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
  },
  nameStylePreviewText: {
    fontSize: typography.caption,
    fontWeight: typography.weights.medium,
  },
  effectPreview: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: CHECK_BADGE_SIZE,
    height: CHECK_BADGE_SIZE,
    borderRadius: CHECK_BADGE_SIZE / 2,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: LOCK_BADGE_SIZE,
    height: LOCK_BADGE_SIZE,
    borderRadius: LOCK_BADGE_SIZE / 2,
    backgroundColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellName: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.caption,
    color: colors.text,
    marginTop: spacing.tight,
    textAlign: 'center',
  },
  lockedText: {
    color: colors.textMuted,
  },
});
