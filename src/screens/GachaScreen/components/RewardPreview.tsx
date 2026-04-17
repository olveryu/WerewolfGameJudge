/**
 * RewardPreview — 奖励实际视觉预览 + 中文显示名
 *
 * 按 rewardType 渲染：
 * - avatar: 512px 缩略图
 * - frame: AvatarWithFrame（默认狼人头像 + 框）
 * - seatFlair: 默认头像 + 粒子动画叠加
 * - nameStyle: NameStyleText 实际效果
 *
 * 复用 UnlocksScreen 的渲染模式。
 */
import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';
import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';

import { type FrameId, getFrameById } from '@/components/avatarFrames';
import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import { getNameStyleById, NameStyleText } from '@/components/nameStyles';
import { getFlairById } from '@/components/seatFlairs';
import { borderRadius, colors } from '@/theme';
import { AVATAR_KEYS, getAvatarThumbByIndex } from '@/utils/avatar';
import { getAvatarIcon } from '@/utils/defaultAvatarIcons';

/** wolf-paw icon（预览底图，与 AvatarPickerScreen 默认头像一致） */
const WOLF_PAW = getAvatarIcon('preview');

// ─── Display name resolver ──────────────────────────────────────────────

export function getRewardDisplayName(rewardType: string, rewardId: string): string {
  switch (rewardType) {
    case 'avatar':
      return getRoleDisplayName(rewardId) ?? rewardId;
    case 'frame':
      return getFrameById(rewardId)?.name ?? rewardId;
    case 'seatFlair':
      return getFlairById(rewardId)?.name ?? rewardId;
    case 'nameStyle':
      return getNameStyleById(rewardId)?.name ?? rewardId;
    default:
      return rewardId;
  }
}

// ─── Visual preview component ───────────────────────────────────────────

interface RewardPreviewProps {
  rewardType: string;
  rewardId: string;
  size: number;
}

export const RewardPreview = React.memo<RewardPreviewProps>(({ rewardType, rewardId, size }) => {
  switch (rewardType) {
    case 'avatar':
      return <AvatarPreview id={rewardId} size={size} />;
    case 'frame':
      return <FramePreview id={rewardId} size={size} />;
    case 'seatFlair':
      return <FlairPreview id={rewardId} size={size} />;
    case 'nameStyle':
      return <NameStylePreview id={rewardId} size={size} />;
    default:
      return null;
  }
});

RewardPreview.displayName = 'RewardPreview';

// ─── Per-type previews ──────────────────────────────────────────────────

function AvatarPreview({ id, size }: { id: string; size: number }) {
  const avatarIndex = (AVATAR_KEYS as readonly string[]).indexOf(id);
  const thumbSource = avatarIndex >= 0 ? getAvatarThumbByIndex(avatarIndex) : undefined;
  if (thumbSource == null) return null;

  return (
    <Image
      source={thumbSource as ImageSourcePropType}
      style={{ width: size, height: size, borderRadius: borderRadius.medium }}
      resizeMode="cover"
    />
  );
}

function FramePreview({ id, size }: { id: string; size: number }) {
  return <AvatarWithFrame value="preview" frameId={id as FrameId} size={size} />;
}

function FlairPreview({ id, size }: { id: string; size: number }) {
  const flair = getFlairById(id);
  if (!flair) return null;
  const Comp = flair.Component;
  return (
    <View style={[styles.flairContainer, { width: size, height: size }]}>
      <View style={styles.flairAvatarWrap}>
        <Image
          source={WOLF_PAW.image}
          style={styles.flairPawIcon}
          tintColor={WOLF_PAW.color}
          resizeMode="contain"
        />
      </View>
      <Comp size={size} borderRadius={borderRadius.medium} />
    </View>
  );
}

function NameStylePreview({ id, size }: { id: string; size: number }) {
  const config = getNameStyleById(id);
  const displayName = config?.name ?? id;
  return (
    <View style={[styles.nameStyleContainer, { width: size, height: size }]}>
      <NameStyleText styleId={id} style={styles.nameStyleText}>
        {displayName}
      </NameStyleText>
    </View>
  );
}

const styles = StyleSheet.create({
  flairContainer: {
    overflow: 'hidden',
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
  },
  flairAvatarWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flairPawIcon: {
    width: '60%',
    height: '60%',
  },
  nameStyleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
  },
  nameStyleText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
