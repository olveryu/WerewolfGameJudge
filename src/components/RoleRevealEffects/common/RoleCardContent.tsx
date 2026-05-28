/**
 * RoleCardContent - Role card content area (no Modal wrapper).
 *
 * The single source of truth for all role card UI.
 * Reused by RoleCardSimple (static modal) and all animation effect components.
 * Long descriptions automatically scale down to fit within the card.
 * Renders the role card content UI; extends the bottom button area via children slot. No service imports, no business logic.
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import {
  getRoleDisplayAs,
  getRoleSpec,
  getRoleStructuredDescription,
  isWolfRole,
} from '@werewolf/game-engine/models/roles';
import { Faction } from '@werewolf/game-engine/models/roles/spec/types';
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

import { RoleDescriptionView } from '@/components/RoleDescriptionView';
import { getFactionName } from '@/components/roleDisplayUtils';
import { WolfCrackBackground } from '@/components/RoleRevealEffects/common/effects/WolfRevealEffect';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import { borderRadius, colors, fixed, spacing, type ThemeColors, typography } from '@/theme';
import { getRoleBadge } from '@/utils/roleBadges';

const AE = CONFIG.alignmentEffects;

/** White text color for badges/overlays on colored backgrounds */
const BADGE_TEXT_WHITE = '#fff';

// Faction color (from theme tokens)
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
   * When true, skips displayAs mapping and shows the role's real identity.
   * Used for judge-perspective ability previews (role config chips). Defaults to false (players see the disguised identity when flipping).
   */
  showRealIdentity?: boolean;
  /**
   * Dual-seer index (1 or 2), derived from seerLabelMap.
   * When present, the role name displays as "X号预言家". Only used in seer+mirrorSeer coexistence configs.
   */
  seerLabel?: number;
  /**
   * Animation reveal mode. When true, the card uses a dark faction background + light text, matching the HTML demo visual.
   * Only passed as true in the 6 animation components of RoleRevealAnimator;
   * RoleCardSimple (static card + "我知道了" button) does not pass this prop, keeping the default white background.
   */
  revealMode?: boolean;
  /**
   * Reveal-mode 3-stop gradient background color (from AlignmentTheme.revealGradient).
   * Matches the HTML demo v2 `linear-gradient(160deg, edge, center, edge)` pattern.
   * Only applied when revealMode=true.
   */
  revealGradient?: readonly [string, string, string];
  /**
   * Reveal-mode border opacity (matching the HTML demo semi-transparent border).
   * Only applied when revealMode=true. Defaults to 0.5.
   */
  revealBorderOpacity?: number;
  /**
   * Triggers entrance animations (emoji pop, role name/description slide-in, wolf tremor).
   *
   * Three-state semantics:
   * - `undefined` (not passed) — content is immediately visible, no entrance animation (ScratchReveal peek-hole card).
   * - `false` — content is **hidden**, waiting to be triggered (the card face before flip, preventing content flash during flip).
   * - `true` — plays entrance animation from hidden state (set after card flip completes).
   *
   * Independent of revealMode: revealMode controls visual style; animateEntrance controls entrance animation lifecycle.
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
  const styles = useMemo(() => createStyles(colors, width, height), [width, height]);

  const spec = getRoleSpec(roleId);

  // Roles with displayAs (e.g. mirrorSeer): players see the appearance of the target role
  // showRealIdentity=true skips the disguise, used for judge-perspective ability previews
  const displayRoleId = showRealIdentity ? roleId : (getRoleDisplayAs(roleId) ?? roleId);
  const displaySpec = displayRoleId !== roleId ? getRoleSpec(displayRoleId) : spec;
  const baseRoleName = displaySpec?.displayName || roleId;
  const roleName = seerLabel != null ? `${seerLabel}号${baseRoleName}` : baseRoleName;
  const description = displaySpec?.description || '无技能描述';
  const structuredDescription = getRoleStructuredDescription(displayRoleId);
  const badgeSource = getRoleBadge(displayRoleId);
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

      {/* Wolf crack layer — between gradient bg and role image for depth */}
      {revealMode && isWolf && animateEntrance && (
        <WolfCrackBackground
          cardWidth={width}
          cardHeight={height}
          animate
          primaryColor={factionColor}
        />
      )}

      {/* Faction badge — only in normal (non-reveal) mode */}
      {!revealMode && (
        <View style={[styles.factionBadge, { backgroundColor: factionColor }]}>
          <Text style={styles.factionText}>{factionName}</Text>
        </View>
      )}

      {revealMode ? (
        <Animated.Image
          source={badgeSource}
          resizeMode="contain"
          style={[styles.roleIconImage, styles.roleIconRevealImage, emojiAnimStyle]}
        />
      ) : (
        <Image
          source={badgeSource}
          resizeMode="contain"
          style={styles.roleIconImage}
          testID="role-badge"
        />
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
          <RoleDescriptionView
            structuredDescription={structuredDescription}
            descriptionFallback={description}
            factionColor={factionColor}
          />
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
      ...StyleSheet.absoluteFill,
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
    roleIconImage: {
      width: Math.round(width * 0.38),
      height: Math.round(width * 0.38),
      marginTop: spacing.xlarge,
      marginBottom: spacing.small,
    },
    /** Reveal mode: badge centered, sized larger since no skill description (matches card vertical center layout) */
    roleIconRevealImage: {
      width: Math.round(width * 0.7),
      height: Math.round(width * 0.7),
      marginTop: 0,
      marginBottom: Math.round(width * 0.04),
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
    childrenSlot: {
      marginTop: 'auto',
      alignItems: 'center',
    },
    transparentBg: {
      backgroundColor: 'transparent',
    },
  });
}
