/**
 * AvatarWithFrame — 头像 + 可选装饰框包装组件
 *
 * `size` 始终表示 avatar 尺寸。无 frame 时行为完全等同 Avatar。
 * 有 frame 时，frame SVG 按 viewBox "-8 -8 116 116" 渲染——
 * SVG 实际尺寸略大于 avatar，通过负偏移精确对齐：viewBox 坐标
 * 0-100 的主边框恰好覆盖 avatar 边缘，-8~0 / 100~108 的装饰
 * 向外溢出。不依赖 overflow:visible 的 SVG 行为。
 * Memoized 以避免不必要重渲染。不 import service，不含业务逻辑。
 */
import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { getFrameById } from '@/components/avatarFrames';
import { borderRadius as themeBorderRadius } from '@/theme';

/**
 * Frame SVG viewBox = "-8 -8 116 116" → 8 units padding each side.
 * SVG element is sized to (size * 116/100), offset by -(size * 8/100)
 * so viewBox coords 0-100 map pixel-perfectly to the avatar bounds.
 */
const VB_PAD = 8;
const VB_TOTAL = 100 + VB_PAD * 2; // 116

interface AvatarWithFrameProps {
  value: string;
  /** Avatar 尺寸（px）。有无 frame 含义不变。 */
  size: number;
  avatarUrl?: string | null;
  roomId?: string;
  avatarIndex?: number;
  borderRadius?: number;
  /** 头像框 ID。null / undefined = 无框。 */
  frameId?: string | null;
}

const AvatarWithFrameComponent: React.FC<AvatarWithFrameProps> = ({
  size,
  frameId,
  value,
  avatarUrl,
  roomId,
  avatarIndex,
  borderRadius,
}) => {
  const frameConfig = useMemo(() => getFrameById(frameId as string), [frameId]);

  if (!frameConfig) {
    return (
      <Avatar
        value={value}
        size={size}
        avatarUrl={avatarUrl}
        roomId={roomId}
        avatarIndex={avatarIndex}
        borderRadius={borderRadius}
      />
    );
  }

  const innerRadius = borderRadius ?? themeBorderRadius.medium;
  const { Component: FrameComponent } = frameConfig;
  const svgSize = (size * VB_TOTAL) / 100;
  const svgOffset = (-size * VB_PAD) / 100;
  const rxVB = (innerRadius * 100) / size;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Avatar
        value={value}
        size={size}
        avatarUrl={avatarUrl}
        roomId={roomId}
        avatarIndex={avatarIndex}
        borderRadius={innerRadius}
      />
      <View style={[styles.frameOverlay, { left: svgOffset, top: svgOffset }]} pointerEvents="none">
        <FrameComponent size={svgSize} rx={rxVB} />
      </View>
    </View>
  );
};

export const AvatarWithFrame = memo(AvatarWithFrameComponent);

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
  frameOverlay: {
    position: 'absolute',
    overflow: 'visible',
  },
});
