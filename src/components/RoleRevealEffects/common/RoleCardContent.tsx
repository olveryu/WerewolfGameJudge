/**
 * RoleCardContent - 角色卡片内容区域（无 Modal 包裹）
 *
 * 所有角色卡片 UI 的唯一 source of truth。
 * RoleCardSimple（静态模态框）和各动画效果组件均复用此组件。
 * 长描述自动缩小字号以完整显示在卡片内。
 * 渲染角色卡片内容 UI，通过 children 插槽扩展底部按钮。不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import {
  getRoleDisplayAs,
  getRoleEmoji,
  getRoleSpec,
  isWolfRole,
} from '@werewolf/game-engine/models/roles';
import { Faction } from '@werewolf/game-engine/models/roles/spec/types';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { getFactionName } from '@/components/roleDisplayUtils';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import { borderRadius, fixed, spacing, type ThemeColors, typography, useColors } from '@/theme';

const AE = CONFIG.alignmentEffects;

/** White text color for badges/overlays on colored backgrounds */
const BADGE_TEXT_WHITE = '#fff';

// 阵营颜色（从主题 token 取色）
const getFactionColor = (roleId: RoleId, colors: ThemeColors): string => {
  if (isWolfRole(roleId)) return colors.wolf;
  const spec = getRoleSpec(roleId);
  if (spec?.faction === Faction.God) return colors.god;
  if (spec?.faction === Faction.Special) return colors.third;
  return colors.villager;
};

interface RoleCardContentProps {
  /** Role ID to display */
  roleId: RoleId;
  /** Card width */
  width?: number;
  /** Card height */
  height?: number;
  /** Additional style */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
  /** Optional bottom slot (e.g. confirm button) rendered below description */
  children?: React.ReactNode;
  /**
   * 为 true 时跳过 displayAs 映射，显示角色真实身份。
   * 用于裁判视角的技能预览（板子配置 chip）。默认 false（玩家翻牌看伪装身份）。
   */
  showRealIdentity?: boolean;
  /**
   * 双预言家编号（1 或 2），由 seerLabelMap 派生。
   * 存在时角色名显示为 "X号预言家"。仅 seer+mirrorSeer 共存板子使用。
   */
  seerLabel?: number;
  /**
   * 动画揭牌模式。为 true 时卡片使用暗色阵营背景 + 亮色文字，匹配 HTML demo 视觉。
   * 仅在 RoleRevealAnimator 的 6 个动画组件中传入 true；
   * RoleCardSimple（静态卡片 + "我知道了"按钮）不传此 prop，保持默认白底。
   */
  revealMode?: boolean;
  /**
   * Reveal-mode 3-stop 渐变背景色（来自 AlignmentTheme.revealGradient）。
   * 匹配 HTML demo v2 的 `linear-gradient(160deg, edge, center, edge)` 模式。
   * 仅在 revealMode=true 时生效。
   */
  revealGradient?: readonly [string, string, string];
  /**
   * Reveal-mode 边框透明度（匹配 HTML demo 半透明边框）。
   * 仅在 revealMode=true 时生效。默认 0.5。
   */
  revealBorderOpacity?: number;
  /**
   * 触发入场动画（emoji 弹出、角色名/描述滑入、狼人震颤）。
   *
   * 三态语义：
   * - `undefined`（不传）— 内容立即可见，无入场动画（ScratchReveal 透视孔卡片）。
   * - `false` — 内容**隐藏**，等待触发（卡片翻转前的正面，防止翻转时内容闪现）。
   * - `true` — 从隐藏态播放入场动画（卡片翻转完成后设置）。
   *
   * 与 revealMode 独立：revealMode 控制视觉样式，animateEntrance 控制入场动画生命周期。
   */
  animateEntrance?: boolean;
}

export const RoleCardContent: React.FC<RoleCardContentProps> = ({
  roleId,
  width = 280,
  height = 392,
  style,
  testID,
  children,
  showRealIdentity = false,
  seerLabel,
  revealMode = false,
  revealGradient,
  revealBorderOpacity = 0.5,
  animateEntrance,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors, width, height), [colors, width, height]);

  const spec = getRoleSpec(roleId);

  // mirrorSeer 等有 displayAs 字段的角色：玩家看到的是目标角色的外观
  // showRealIdentity=true 时跳过伪装，用于裁判视角的技能预览
  const displayRoleId = showRealIdentity ? roleId : (getRoleDisplayAs(roleId) ?? roleId);
  const displaySpec = displayRoleId !== roleId ? getRoleSpec(displayRoleId) : spec;
  const baseRoleName = displaySpec?.displayName || roleId;
  const roleName = seerLabel != null ? `${seerLabel}号${baseRoleName}` : baseRoleName;
  const description = displaySpec?.description || '无技能描述';
  const icon = getRoleEmoji(displayRoleId);
  // English subtitle for reveal mode: convert camelCase roleId to UPPERCASE
  const roleSub = displayRoleId.toUpperCase();
  const factionColor = getFactionColor(displayRoleId, colors);
  const factionName = getFactionName(displayRoleId);
  const isWolf = isWolfRole(displayRoleId);
  // Reveal mode: semi-transparent border matching HTML demo (e.g. rgba(180,0,0,0.5))
  const borderColor = revealMode
    ? `${factionColor}${Math.round(revealBorderOpacity * 255)
        .toString(16)
        .padStart(2, '0')}`
    : factionColor;

  // ── Reveal entrance animations ──
  // Three-state semantics for animateEntrance:
  //   undefined → static visible (ScratchReveal peek-through, no animation)
  //   false     → hidden, waiting for trigger (flip card front before reveal)
  //   true      → play entrance animation from hidden → visible
  // When animateEntrance is a boolean (false or true), content starts hidden
  // to prevent the flash where content is visible before the animation fires.
  const willAnimate = animateEntrance != null; // boolean → hide initially
  const emojiScale = useSharedValue(willAnimate ? 0 : 1);
  const emojiRotate = useSharedValue(0);
  const nameOpacity = useSharedValue(willAnimate ? 0 : 1);
  const nameTranslateY = useSharedValue(willAnimate ? 10 : 0);
  const descOpacity = useSharedValue(willAnimate ? 0 : 1);
  const descTranslateY = useSharedValue(willAnimate ? 10 : 0);
  const shakeTranslateX = useSharedValue(0);
  const shakeRotate = useSharedValue(0);

  useEffect(() => {
    if (!animateEntrance) return;

    // Values already start hidden (scale=0, opacity=0, translateY=10),
    // so no snap needed — just kick off the animation.

    // Emoji pop — wolf uses emojiPopWolf (with rotation), others use emojiPop
    const popEasing = Easing.bezier(0.34, 1.56, 0.64, 1);
    if (isWolf) {
      // HTML: scale 0.2+rotate(-10) → 1.3+rotate(3) → 0.95+rotate(-1) → 1+rotate(0)
      emojiScale.value = 0.2;
      emojiRotate.value = -10;
      emojiScale.value = withDelay(
        AE.emojiPopDelay,
        withSequence(
          withTiming(1.3, { duration: AE.emojiPopDuration * 0.5, easing: popEasing }),
          withTiming(0.95, {
            duration: AE.emojiPopDuration * 0.2,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(1, { duration: AE.emojiPopDuration * 0.3, easing: Easing.out(Easing.quad) }),
        ),
      );
      emojiRotate.value = withDelay(
        AE.emojiPopDelay,
        withSequence(
          withTiming(3, { duration: AE.emojiPopDuration * 0.5, easing: popEasing }),
          withTiming(-1, { duration: AE.emojiPopDuration * 0.2 }),
          withTiming(0, { duration: AE.emojiPopDuration * 0.3 }),
        ),
      );
    } else {
      // HTML: scale 0.3 → 1.2 → 1
      emojiScale.value = 0.3;
      emojiScale.value = withDelay(
        AE.emojiPopDelay,
        withSequence(
          withTiming(1.2, { duration: AE.emojiPopDuration * 0.6, easing: popEasing }),
          withTiming(1, { duration: AE.emojiPopDuration * 0.4, easing: Easing.out(Easing.quad) }),
        ),
      );
    }

    // Name slide-up (matches HTML @keyframes nameSlideUp delay 0.5s)
    nameOpacity.value = withDelay(
      AE.nameSlideDelay,
      withTiming(1, { duration: AE.nameSlideDuration, easing: Easing.out(Easing.quad) }),
    );
    nameTranslateY.value = withDelay(
      AE.nameSlideDelay,
      withTiming(0, { duration: AE.nameSlideDuration, easing: Easing.out(Easing.quad) }),
    );

    // Description slide-up (matches HTML delay 0.6s)
    descOpacity.value = withDelay(
      AE.descSlideDelay,
      withTiming(1, { duration: AE.descSlideDuration, easing: Easing.out(Easing.quad) }),
    );
    descTranslateY.value = withDelay(
      AE.descSlideDelay,
      withTiming(0, { duration: AE.descSlideDuration, easing: Easing.out(Easing.quad) }),
    );

    // Wolf shake (matches HTML @keyframes wolfShake ±4px + ±1° rotation)
    if (isWolf) {
      const shakeDur = AE.wolfShakeDuration / 6;
      shakeTranslateX.value = withDelay(
        AE.wolfShakeDelay,
        withSequence(
          withTiming(-4, { duration: shakeDur }),
          withTiming(4, { duration: shakeDur }),
          withTiming(-3, { duration: shakeDur }),
          withTiming(2, { duration: shakeDur }),
          withTiming(-1, { duration: shakeDur }),
          withTiming(0, { duration: shakeDur }),
        ),
      );
      shakeRotate.value = withDelay(
        AE.wolfShakeDelay,
        withSequence(
          withTiming(-1, { duration: shakeDur }),
          withTiming(1, { duration: shakeDur }),
          withTiming(-0.5, { duration: shakeDur }),
          withTiming(0.5, { duration: shakeDur }),
          withTiming(0, { duration: shakeDur * 2 }),
        ),
      );
    }
  }, [
    animateEntrance,
    isWolf,
    emojiScale,
    emojiRotate,
    nameOpacity,
    nameTranslateY,
    descOpacity,
    descTranslateY,
    shakeTranslateX,
    shakeRotate,
  ]);

  const emojiAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }, { rotate: `${emojiRotate.value}deg` }],
  }));

  const nameAnimStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameTranslateY.value }],
  }));

  const descAnimStyle = useAnimatedStyle(() => ({
    opacity: descOpacity.value,
    transform: [{ translateY: descTranslateY.value }],
  }));

  const cardShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeTranslateX.value }, { rotate: `${shakeRotate.value}deg` }],
  }));

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.card,
        { borderColor },
        // Set transparent bg when gradient is rendered; solid bg otherwise
        revealGradient != null && styles.transparentBg,
        // Reveal mode: vertically center emoji+name+sub (matches HTML demo flex center layout)
        revealMode && styles.cardRevealCenter,
        style,
        // Wolf shake applied to the whole card (matches HTML wolfShake on .card-inner)
        revealMode && cardShakeStyle,
      ]}
    >
      {/* Reveal-mode gradient background (matches HTML demo linear-gradient 160deg) */}
      {revealMode && revealGradient != null && (
        <LinearGradient
          colors={[...revealGradient]}
          locations={[0, 0.5, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.revealGradientBg}
        />
      )}

      {/* Faction badge — only in normal (non-reveal) mode */}
      {!revealMode && (
        <View style={[styles.factionBadge, { backgroundColor: factionColor }]}>
          <Text style={styles.factionText}>{factionName}</Text>
        </View>
      )}

      {revealMode ? (
        <Animated.Text style={[styles.roleIcon, styles.roleIconReveal, emojiAnimStyle]}>
          {icon}
        </Animated.Text>
      ) : (
        <Text style={styles.roleIcon}>{icon}</Text>
      )}

      {revealMode ? (
        <Animated.Text
          style={[styles.roleName, styles.roleNameReveal, { color: factionColor }, nameAnimStyle]}
        >
          {roleName}
        </Animated.Text>
      ) : (
        <Text style={[styles.roleName, { color: factionColor }]}>{roleName}</Text>
      )}

      {/* English subtitle — only in reveal mode (matches HTML .role-sub) */}
      {revealMode ? (
        <Animated.Text style={[styles.roleSub, { color: factionColor }, descAnimStyle]}>
          {roleSub}
        </Animated.Text>
      ) : (
        /* Normal mode: divider + skill description */
        <>
          <View style={styles.divider} />
          <Text style={styles.skillTitle}>技能介绍</Text>
          <Text style={styles.description}>{description}</Text>
        </>
      )}
      {children && <View style={styles.childrenSlot}>{children}</View>}
    </Animated.View>
  );
};

/** @internal Exported for RoleCardSimple to access faction color */
export { getFactionColor };

function createStyles(colors: ThemeColors, width: number, height: number) {
  return StyleSheet.create({
    card: {
      width,
      height,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xlarge,
      borderWidth: fixed.borderWidthHighlight,
      padding: spacing.large,
      alignItems: 'center',
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
    },
    cardRevealCenter: {
      justifyContent: 'center',
      paddingTop: 0,
    },
    revealGradientBg: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: borderRadius.xlarge - fixed.borderWidthHighlight, // Inside border
    },
    factionBadge: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingVertical: spacing.tight,
      borderTopLeftRadius: borderRadius.xlarge - fixed.borderWidthHighlight,
      borderTopRightRadius: borderRadius.xlarge - fixed.borderWidthHighlight,
      alignItems: 'center',
    },
    factionText: {
      color: BADGE_TEXT_WHITE,
      fontSize: typography.secondary,
      fontWeight: '600',
    },
    roleIcon: {
      fontSize: 64,
      marginTop: spacing.xlarge + spacing.medium,
      marginBottom: spacing.medium,
    },
    /** Reveal mode: emoji centered, drop-shadow (matches HTML .role-emoji 48px on 140px card → 0.343) */
    roleIconReveal: {
      fontSize: Math.round(width * 0.343),
      marginTop: 0,
      marginBottom: Math.round(width * 0.057),
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: Math.round(height * 0.02) },
      textShadowRadius: Math.round(height * 0.04),
    },
    roleName: {
      fontSize: typography.heading,
      fontWeight: '700',
    },
    /** Reveal mode: bolder, letter-spaced (matches HTML .role-name 16px/800/2px on 140px card) */
    roleNameReveal: {
      fontSize: Math.round(width * 0.114),
      fontWeight: '800',
      letterSpacing: Math.round(width * 0.014),
    },
    /** English subtitle under role name in reveal mode (matches HTML .role-sub 10px on 140px card) */
    roleSub: {
      fontSize: Math.round(width * 0.071),
      marginTop: Math.round(width * 0.029),
      opacity: 0.5,
      letterSpacing: Math.max(1, Math.round(width * 0.007)),
      fontWeight: typography.weights.semibold,
    },
    divider: {
      width: '80%',
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.medium,
    },
    skillTitle: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      marginBottom: spacing.tight,
    },
    description: {
      fontSize: typography.body,
      color: colors.text,
      textAlign: 'center',
      lineHeight: typography.body * 1.5,
      paddingHorizontal: spacing.small,
    },
    childrenSlot: {
      marginTop: 'auto',
      alignItems: 'center',
    },
    transparentBg: {
      backgroundColor: 'transparent',
    },
  });
}
