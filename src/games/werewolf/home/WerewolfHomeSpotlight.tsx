/** Werewolf random-role spotlight contributed to the product Home screen. */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Faction,
  getAllRoleIds,
  getRoleSpec,
  isWolfRole,
  type RoleId,
} from '@werewolf/game-engine/games/werewolf/public';
import { randomIntInclusive } from '@werewolf/game-engine/platform/random';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { getRoleAvatar } from '@/games/werewolf/assets/roleAvatars';
import type { RootStackParamList } from '@/navigation/types';
import {
  borderRadius,
  colors,
  componentSizes,
  createSharedStyles,
  spacing,
  textStyles,
  typography,
  withAlpha,
} from '@/theme';

const FLIP_DURATION = 600;
const AUTO_FLIP_DELAY = 400;
const ROLE_IDS = getAllRoleIds();

if (ROLE_IDS.length === 0) {
  throw new Error('[FAIL-FAST] Werewolf Home spotlight requires at least one role');
}

function getRoleAt(index: number): RoleId {
  const roleId = ROLE_IDS[index % ROLE_IDS.length];
  if (roleId === undefined) {
    throw new Error(`[FAIL-FAST] Missing Werewolf Home role at index ${index}`);
  }
  return roleId;
}

function getFactionPresentation(roleId: RoleId) {
  const role = getRoleSpec(roleId);
  if (isWolfRole(roleId)) return { color: colors.wolf, label: '狼人' };
  if (role.faction === Faction.God) return { color: colors.god, label: '神职' };
  if (role.faction === Faction.Special) return { color: colors.third, label: '第三方' };
  return { color: colors.villager, label: '村民' };
}

export const WerewolfHomeSpotlight = memo(() => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Home'>>();
  const [roleIndex, setRoleIndex] = useState(() => randomIntInclusive(0, ROLE_IDS.length - 1));
  const rotation = useSharedValue(0);
  const isFlipping = useRef(false);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roleId = getRoleAt(roleIndex);

  const role = getRoleSpec(roleId);
  const faction = getFactionPresentation(roleId);
  const avatar = getRoleAvatar(roleId);

  useEffect(() => {
    rotation.value = withDelay(AUTO_FLIP_DELAY, withTiming(180, { duration: FLIP_DURATION }));
    return () => {
      if (swapTimer.current !== null) clearTimeout(swapTimer.current);
      if (revealTimer.current !== null) clearTimeout(revealTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only Reanimated SharedValue
  }, []);

  const refreshRole = useCallback(() => {
    setRoleIndex((previous) => {
      let next = previous;
      while (next === previous && ROLE_IDS.length > 1) {
        next = randomIntInclusive(0, ROLE_IDS.length - 1);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    if (isFlipping.current) return;
    isFlipping.current = true;
    rotation.value = withTiming(0, { duration: FLIP_DURATION / 2 });

    swapTimer.current = setTimeout(() => {
      refreshRole();
      revealTimer.current = setTimeout(() => {
        rotation.value = withTiming(180, { duration: FLIP_DURATION / 2 }, () => {
          isFlipping.current = false;
        });
      }, 50);
    }, FLIP_DURATION / 2);
  }, [refreshRole, rotation]);

  const handleDetail = useCallback(() => {
    navigation.navigate('GameGuide', { gameType: 'werewolf', roleId });
  }, [navigation, roleId]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${interpolate(rotation.value, [0, 180], [180, 360])}deg` },
    ],
    backfaceVisibility: 'hidden',
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${interpolate(rotation.value, [0, 180], [0, 180])}deg` },
    ],
    backfaceVisibility: 'hidden',
  }));

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.card, styles.cardAbsolute, backStyle]}>
        <View style={styles.backContent}>
          <Text style={styles.backEmoji}>🐺</Text>
          <Text style={styles.backText}>猜猜今天是谁？</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.card, frontStyle]}>
        <View style={styles.frontRow}>
          <Image source={avatar} style={styles.avatar} resizeMode="cover" />
          <View style={styles.frontInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{role.displayName}</Text>
              <View style={[styles.badge, { backgroundColor: withAlpha(faction.color, 0.15) }]}>
                <Text style={[styles.badgeText, { color: faction.color }]}>{faction.label}</Text>
              </View>
            </View>
            <Text style={styles.description} numberOfLines={2}>
              {role.description}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <PressableScale onPress={handleRefresh} style={styles.actionButton}>
            <Ionicons name="refresh" size={componentSizes.icon.sm} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>换一个</Text>
          </PressableScale>
          <PressableScale onPress={handleDetail} style={styles.actionButton}>
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>详情</Text>
            <Ionicons
              name="chevron-forward"
              size={componentSizes.icon.sm}
              color={colors.textSecondary}
            />
          </PressableScale>
        </View>
      </Animated.View>
    </View>
  );
});

WerewolfHomeSpotlight.displayName = 'WerewolfHomeSpotlight';

const shared = createSharedStyles(colors);
const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.screenH,
    marginBottom: spacing.small,
    height: componentSizes.avatar.xl + spacing.xlarge + spacing.medium,
  },
  card: {
    ...shared.cardBase,
    borderLeftWidth: 3,
    borderLeftColor: colors.god,
  },
  cardAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.small,
  },
  backEmoji: {
    fontSize: typography.display,
  },
  backText: {
    ...textStyles.bodySemibold,
    color: colors.textSecondary,
  },
  frontRow: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  avatar: {
    width: componentSizes.avatar.lg,
    height: componentSizes.avatar.lg,
    borderRadius: borderRadius.medium,
  },
  frontInfo: {
    flex: 1,
    gap: spacing.tight,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  name: {
    ...textStyles.bodySemibold,
    color: colors.text,
  },
  badge: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
    borderRadius: borderRadius.small,
  },
  badgeText: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    fontWeight: typography.weights.medium,
  },
  description: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.small,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    paddingVertical: spacing.tight,
  },
  actionText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.medium,
  },
});
