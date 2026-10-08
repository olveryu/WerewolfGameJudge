/**
 * RoleCardContent - 游戏无关的角色卡内容区（无 Modal 包装）。
 *
 * 从狼人杀 RoleCardContent 逐行移植，仅替换数据源：
 * - roleId → role: RevealRoleData（调用方预处理 displayAs/seerLabel）
 * - getRoleSpec/getRoleAvatar/getFactionName → role 对象的字段
 * - getFactionColor(roleId) → getRevealFactionColor(alignment)
 * - RoleDescriptionView → StructuredDescriptionView
 * - WolfCrackBackground → CrackBackground（通用）
 *
 * 两种模式：
 * - 静态模式（revealMode=false）：surface 纯色背景 + 阵营色边框 + 徽章 + 38% 立绘 + 阵营色角色名 + 分隔线 + 结构化描述
 * - 揭示模式（revealMode=true）：深色阵营渐变背景 + 大立绘（70%）+ 英文副标题 + 入场动画 + 可选裂纹背景
 *
 * 无立绘时显示阵营色占位（角色名首字）。
 */
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { borderRadius, colors, fixed, spacing, type ThemeColors, typography } from '@/theme';

import type { RevealAlignment, RevealRoleData } from '../model/RevealRoleData';
import { CrackBackground } from './RoleRevealEffects/common/CrackBackground';
import { StructuredDescriptionView } from './StructuredDescriptionView';

/** White text color for badges/overlays on colored backgrounds */
const BADGE_TEXT_WHITE = colors.textInverse;

// ─── Reveal animation timing (from CONFIG.alignmentEffects, game-agnostic) ───
const EMOJI_POP_DELAY = 350;
const EMOJI_POP_DURATION = 600;
const NAME_SLIDE_DELAY = 500;
const NAME_SLIDE_DURATION = 500;
const DESC_SLIDE_DELAY = 600;
const DESC_SLIDE_DURATION = 500;
const WOLF_SHAKE_DELAY = 350;
const WOLF_SHAKE_DURATION = 500;

/**
 * 阵营色（从 theme tokens）。
 * 对应原版 getFactionColor：wolf→红，god→蓝，third→特殊色，villager→绿。
 */
export function getRevealFactionColor(alignment: RevealAlignment, theme: ThemeColors): string {
  switch (alignment) {
    case 'wolf':
      return theme.wolf;
    case 'god':
      return theme.god;
    case 'third':
      return theme.third;
    case 'villager':
      return theme.villager;
  }
}

interface RoleCardContentProps {
  /** 游戏无关的角色数据（调用方已处理 displayAs/seerLabel） */
  readonly role: RevealRoleData;
  /** Card width */
  readonly width?: number;
  /** Card height */
  readonly height?: number;
  /** Additional style */
  readonly style?: ViewStyle;
  /** Test ID */
  readonly testID?: string;
  /** Optional bottom slot (e.g. confirm button) rendered below description */
  readonly children?: React.ReactNode;
  /**
   * 揭示模式。true 时卡牌用深色阵营渐变背景 + 大立绘 + 英文副标题（无描述区）。
   * 仅动画特效使用；静态卡（RoleCardSimple）保持 false。
   */
  readonly revealMode?: boolean;
  /**
   * 揭示模式三色渐变背景（从 AlignmentTheme.revealGradient）。
   * 仅 revealMode=true 时生效。
   */
  readonly revealGradient?: readonly [string, string, string];
  /**
   * 揭示模式边框透明度。仅 revealMode=true 时生效。缺省 0.5。
   */
  readonly revealBorderOpacity?: number;
  /**
   * 入场动画三态：
   * - undefined（不传）：内容直接可见，无动画（ScratchReveal  peek 模式）
   * - false：内容隐藏，等待触发（翻牌前的卡面，防止闪现）
   * - true：从隐藏状态播放入场动画
   */
  readonly animateEntrance?: boolean;
  /**
   * 是否启用裂纹背景（狼人杀 true，阿瓦隆 false）。
   * 仅 revealMode=true 且 alignment='wolf' 且 animateEntrance 时生效。
   */
  readonly enableCrackEffect?: boolean;
}

export const RoleCardContent: React.FC<RoleCardContentProps> = ({
  role,
  width = 280,
  height = 392,
  style,
  testID,
  children,
  revealMode = false,
  revealGradient,
  revealBorderOpacity = 0.5,
  animateEntrance,
  enableCrackEffect = false,
}) => {
  const styles = useMemo(() => createStyles(colors, width, height), [width, height]);

  const factionColor = getRevealFactionColor(role.alignment, colors);
  const factionName = role.factionName ?? '';
  const isWolf = role.alignment === 'wolf';
  // 英文副标题：role.id 转大写（如 "SEER"）
  const roleSub = role.id.toUpperCase();
  // 揭示模式：半透明边框
  const borderColor = revealMode
    ? `${factionColor}${Math.round(revealBorderOpacity * 255)
        .toString(16)
        .padStart(2, '0')}`
    : factionColor;

  const descriptionFields = Array.isArray(role.description) ? role.description : undefined;
  const descriptionFallback =
    typeof role.description === 'string' ? role.description : '无技能描述';

  // ── Reveal entrance animations ──
  const willAnimate = animateEntrance != null;
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

    const popEasing = Easing.bezier(0.34, 1.56, 0.64, 1);
    if (isWolf) {
      emojiScale.value = 0.2;
      emojiRotate.value = -10;
      emojiScale.value = withDelay(
        EMOJI_POP_DELAY,
        withSequence(
          withTiming(1.3, { duration: EMOJI_POP_DURATION * 0.5, easing: popEasing }),
          withTiming(0.95, {
            duration: EMOJI_POP_DURATION * 0.2,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(1, { duration: EMOJI_POP_DURATION * 0.3, easing: Easing.out(Easing.quad) }),
        ),
      );
      emojiRotate.value = withDelay(
        EMOJI_POP_DELAY,
        withSequence(
          withTiming(3, { duration: EMOJI_POP_DURATION * 0.5, easing: popEasing }),
          withTiming(-1, { duration: EMOJI_POP_DURATION * 0.2 }),
          withTiming(0, { duration: EMOJI_POP_DURATION * 0.3 }),
        ),
      );
    } else {
      emojiScale.value = 0.3;
      emojiScale.value = withDelay(
        EMOJI_POP_DELAY,
        withSequence(
          withTiming(1.2, { duration: EMOJI_POP_DURATION * 0.6, easing: popEasing }),
          withTiming(1, { duration: EMOJI_POP_DURATION * 0.4, easing: Easing.out(Easing.quad) }),
        ),
      );
    }

    nameOpacity.value = withDelay(
      NAME_SLIDE_DELAY,
      withTiming(1, { duration: NAME_SLIDE_DURATION, easing: Easing.out(Easing.quad) }),
    );
    nameTranslateY.value = withDelay(
      NAME_SLIDE_DELAY,
      withTiming(0, { duration: NAME_SLIDE_DURATION, easing: Easing.out(Easing.quad) }),
    );

    descOpacity.value = withDelay(
      DESC_SLIDE_DELAY,
      withTiming(1, { duration: DESC_SLIDE_DURATION, easing: Easing.out(Easing.quad) }),
    );
    descTranslateY.value = withDelay(
      DESC_SLIDE_DELAY,
      withTiming(0, { duration: DESC_SLIDE_DURATION, easing: Easing.out(Easing.quad) }),
    );

    if (isWolf) {
      const shakeDur = WOLF_SHAKE_DURATION / 6;
      shakeTranslateX.value = withDelay(
        WOLF_SHAKE_DELAY,
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
        WOLF_SHAKE_DELAY,
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

  // 立绘渲染（静态/揭示共用）
  const renderImage = () => {
    if (role.image != null) {
      if (revealMode) {
        return (
          <Animated.Image
            source={role.image}
            resizeMode="contain"
            style={[styles.roleIconImage, styles.roleIconRevealImage, emojiAnimStyle]}
          />
        );
      }
      return (
        <Image
          source={role.image}
          resizeMode="contain"
          style={styles.roleIconImage}
          testID="role-badge"
        />
      );
    }
    // 无立绘占位
    const placeholderStyle = revealMode
      ? [styles.roleIconImage, styles.roleIconRevealImage, styles.roleIconPlaceholder]
      : [styles.roleIconImage, styles.roleIconPlaceholder];
    return (
      <View style={[...placeholderStyle, { backgroundColor: factionColor }]} testID="role-badge">
        <Text style={styles.roleIconPlaceholderText}>{role.name.charAt(0)}</Text>
      </View>
    );
  };

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.card,
        { borderColor },
        revealGradient != null && styles.transparentBg,
        revealMode && styles.cardRevealCenter,
        style,
        revealMode && cardShakeStyle,
      ]}
    >
      {/* 揭示模式渐变背景 */}
      {revealMode && revealGradient != null && (
        <LinearGradient
          colors={[...revealGradient]}
          locations={[0, 0.5, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.revealGradientBg}
        />
      )}

      {/* 裂纹背景 — 渐变与立绘之间 */}
      {revealMode && isWolf && animateEntrance != null && enableCrackEffect && (
        <CrackBackground
          cardWidth={width}
          cardHeight={height}
          animate={animateEntrance}
          primaryColor={factionColor}
        />
      )}

      {/* 阵营徽章 — 仅静态模式 */}
      {!revealMode && factionName.length > 0 && (
        <View style={[styles.factionBadge, { backgroundColor: factionColor }]}>
          <Text style={styles.factionText}>{factionName}</Text>
        </View>
      )}

      {renderImage()}

      {revealMode ? (
        <Animated.Text
          style={[styles.roleName, styles.roleNameReveal, { color: factionColor }, nameAnimStyle]}
        >
          {role.name}
        </Animated.Text>
      ) : (
        <Text style={[styles.roleName, { color: factionColor }]}>{role.name}</Text>
      )}

      {revealMode ? (
        <Animated.Text style={[styles.roleSub, { color: factionColor }, descAnimStyle]}>
          {roleSub}
        </Animated.Text>
      ) : (
        <>
          <View style={styles.divider} />
          <StructuredDescriptionView
            fields={descriptionFields}
            descriptionFallback={descriptionFallback}
            factionColor={factionColor}
          />
        </>
      )}
      {children != null && <View style={styles.childrenSlot}>{children}</View>}
    </Animated.View>
  );
};

function createStyles(colors: ThemeColors, width: number, height: number) {
  const iconSize = Math.round(width * 0.38);
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
      ...StyleSheet.absoluteFill,
      borderRadius: borderRadius.xlarge - fixed.borderWidthHighlight,
    },
    transparentBg: {
      backgroundColor: 'transparent',
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
      fontWeight: typography.weights.semibold,
    },
    roleIconImage: {
      width: iconSize,
      height: iconSize,
      marginTop: spacing.xlarge,
      marginBottom: spacing.small,
    },
    roleIconRevealImage: {
      width: Math.round(width * 0.7),
      height: Math.round(width * 0.7),
      marginTop: 0,
      marginBottom: Math.round(width * 0.04),
    },
    roleIconPlaceholder: {
      borderRadius: borderRadius.large,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roleIconPlaceholderText: {
      color: BADGE_TEXT_WHITE,
      fontSize: Math.round(iconSize * 0.4),
      fontWeight: typography.weights.bold,
    },
    roleName: {
      fontSize: typography.heading,
      fontWeight: typography.weights.bold,
    },
    roleNameReveal: {
      fontSize: Math.round(width * 0.114),
      fontWeight: typography.weights.bold,
      letterSpacing: Math.round(width * 0.014),
    },
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
    childrenSlot: {
      marginTop: 'auto',
      alignItems: 'center',
    },
  });
}
