/**
 * HomeScreen - 主页入口（登录、加入房间、创建房间）
 *
 * Apple HIG 风格布局：TopBar 品牌+头像 → Hero Card → Action Row →
 * RandomRoleCard → TipCards → Footer。
 * 性能优化：styles factory 集中创建一次，通过 props 传入子组件；handlers 用 useCallback 稳定化。
 * 负责编排子组件、调用 service/navigation/showAlert。
 * 不使用硬编码样式值，不使用 console.*。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Faction,
  getAllRoleIds,
  getRoleSpec,
  isWolfRole,
} from '@werewolf/game-engine/models/roles';
import { randomIntInclusive } from '@werewolf/game-engine/utils/random';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { UserAvatar } from '@/components/UserAvatar';
import { getDailyQuote } from '@/config/dailyQuotes';
import { type IoniconsName, UI_ICONS } from '@/config/iconTokens';
import { LAST_ROOM_NUMBER_KEY, type TipId, tipStorageKey } from '@/config/storageKeys';
import { APP_VERSION } from '@/config/version';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useAutoClaimDailyReward, useGachaStatusQuery } from '@/hooks/queries/useGachaQuery';
import { storage } from '@/lib/storage';
import { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, layout } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';
import { AVATAR_IMAGES, AVATAR_KEYS } from '@/utils/avatar';
import { homeLog } from '@/utils/logger';
import { isMiniProgram } from '@/utils/miniProgram';

import {
  createHomeScreenStyles,
  InstallMenuItem,
  JoinRoomModal,
  RandomRoleCard,
  TipCard,
} from './components';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // Create styles once and pass to all sub-components
  const styles = useMemo(() => createHomeScreenStyles(colors, screenWidth), [screenWidth]);

  const navigation = useNavigation<NavigationProp>();
  const { user, loading: authLoading } = useAuth();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [lastRoomNumber, setLastRoomNumber] = useState<string | null>(null);
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());
  const [_tipsLoaded, setTipsLoaded] = useState(false);

  // Loading states for actions
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const pendingActionRef = useRef<(() => void) | null>(null);

  // Ticket count for top bar badge (shared cache via TanStack Query)
  const { data: gachaStatus } = useGachaStatusQuery();
  const ticketCount = gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : null;

  // Auto-claim daily login reward (fires once per session when status loads)
  useAutoClaimDailyReward();

  // Load persisted tip dismissals (synchronous MMKV)
  const readDismissedTips = useCallback(() => {
    const tipIds: TipId[] = ['share', 'login', 'upgrade', 'nickname', 'bind-email'];
    const dismissed = new Set<string>();
    for (const id of tipIds) {
      if (storage.getString(tipStorageKey(id)) === '1') dismissed.add(id);
    }
    return dismissed;
  }, []);

  useEffect(() => {
    setDismissedTips(readDismissedTips());
    setTipsLoaded(true);
  }, [readDismissedTips]);

  // Reload dismissed tips when screen regains focus (after Settings reset)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setDismissedTips(readDismissedTips());
    });
    return unsubscribe;
  }, [navigation, readDismissedTips]);

  // Prevent transient UI states from getting stuck if we navigate away.
  // Also clear stale pending auth action if user didn't complete login before leaving.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsCreating(false);
      setIsJoining(false);
      if (!user) {
        pendingActionRef.current = null;
      }
    });
    return unsubscribe;
  }, [navigation, user]);

  // When user state changes from null to non-null, run pending action (after auth modal)
  const prevUserRef = useRef(user);
  useEffect(() => {
    if (!prevUserRef.current && user) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      if (action) action();
    }
    prevUserRef.current = user;
  }, [user]);

  // Load last room number on mount and when returning to screen
  // (room-not-found clears MMKV, need to re-read on focus)
  useEffect(() => {
    const readLastRoom = () => {
      setLastRoomNumber(storage.getString(LAST_ROOM_NUMBER_KEY) ?? null);
    };
    readLastRoom();
    const unsubscribeFocus = navigation.addListener('focus', readLastRoom);
    return unsubscribeFocus;
  }, [user, navigation]);

  // Get user display name
  const userName = useMemo(() => {
    if (!user) return '';
    if (user.isAnonymous) return '匿名用户';
    if (user.displayName) return user.displayName;
    if (user.email) {
      return user.email.split('@')[0];
    }
    return '用户';
  }, [user]);

  const requireAuth = useCallback(
    (action: () => void) => {
      if (!user) {
        pendingActionRef.current = action;
        navigation.navigate('AuthLogin', { loginTitle: '登录', loginSubtitle: '选择登录方式继续' });
        return;
      }
      action();
    },
    [user, navigation],
  );

  const handleJoinRoom = useCallback(async () => {
    if (roomCode.length !== 4) {
      setJoinError('请输入4位房间号');
      return;
    }

    setJoinError(null);
    setIsJoining(true);
    homeLog.info('Join room', { roomCode });

    try {
      storage.set(LAST_ROOM_NUMBER_KEY, roomCode);
      setShowJoinModal(false);
      navigation.navigate('Room', { roomNumber: roomCode, isHost: false });
      setRoomCode('');
    } catch {
      homeLog.warn('Join failed');
      setJoinError('加入失败，请重试');
    } finally {
      setIsJoining(false);
    }
  }, [roomCode, navigation]);

  const handleReturnToLastGame = useCallback(() => {
    if (!lastRoomNumber) {
      showErrorAlert('无记录', '没有上局游戏记录');
      return;
    }
    homeLog.info('Return to last game', { roomNumber: lastRoomNumber });
    navigation.navigate('Room', { roomNumber: lastRoomNumber, isHost: false });
  }, [lastRoomNumber, navigation]);

  const handleCancelJoin = useCallback(() => {
    setShowJoinModal(false);
    setRoomCode('');
    setJoinError(null);
    setIsJoining(false);
  }, []);

  const handleCreateRoom = useCallback(() => {
    homeLog.info('Create room');
    setIsCreating(true);
    navigation.navigate('BoardPicker');
  }, [navigation]);

  const handleShowJoinModal = useCallback(() => {
    setShowJoinModal(true);
  }, []);

  const handleNavigateSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const handleNavigateEncyclopedia = useCallback(() => {
    navigation.navigate('Encyclopedia');
  }, [navigation]);

  const handleNavigateGacha = useCallback(() => {
    navigation.navigate('Gacha');
  }, [navigation]);

  // ============================================
  // Random Role Card state (F8)
  // ============================================

  const allRoleIds = useMemo(() => getAllRoleIds(), []);
  const [randomRoleIndex, setRandomRoleIndex] = useState(() =>
    randomIntInclusive(0, getAllRoleIds().length - 1),
  );

  const handleRefreshRole = useCallback(() => {
    setRandomRoleIndex((prev) => {
      let next: number;
      do {
        next = randomIntInclusive(0, allRoleIds.length - 1);
      } while (next === prev && allRoleIds.length > 1);
      return next;
    });
  }, [allRoleIds.length]);

  const randomRoleData = useMemo(() => {
    const roleId = allRoleIds[randomRoleIndex % allRoleIds.length];
    const spec = getRoleSpec(roleId);
    // Map faction to color + label
    let factionColor = colors.villager;
    let factionLabel = '村民';
    if (isWolfRole(roleId)) {
      factionColor = colors.wolf;
      factionLabel = '狼人';
    } else if (spec.faction === Faction.God) {
      factionColor = colors.god;
      factionLabel = '神职';
    } else if (spec.faction === Faction.Special) {
      factionColor = colors.third;
      factionLabel = '第三方';
    }
    // Avatar image: AVATAR_KEYS matches RoleId names, use indexOf for exact match
    const avatarKeyIdx = AVATAR_KEYS.indexOf(roleId);
    const avatarImage = avatarKeyIdx >= 0 ? AVATAR_IMAGES[avatarKeyIdx] : AVATAR_IMAGES[0];
    return {
      roleId,
      displayName: spec.displayName,
      description: spec.description,
      factionColor,
      factionLabel,
      avatarImage,
    };
  }, [allRoleIds, randomRoleIndex]);

  const handleRoleDetail = useCallback(() => {
    navigation.navigate('Encyclopedia', { roleId: randomRoleData.roleId });
  }, [navigation, randomRoleData.roleId]);

  // ============================================
  // Memoized menu item handlers (stable references)
  // Use ref pattern so MenuItem can be memoized without comparing onPress,
  // but still call the latest handler that captures current user state.
  // ============================================

  const handleEnterRoomPressRef = useRef(() => {
    requireAuth(handleShowJoinModal);
  });
  useLayoutEffect(() => {
    handleEnterRoomPressRef.current = () => {
      requireAuth(handleShowJoinModal);
    };
  });
  const handleEnterRoomPress = useCallback(() => {
    handleEnterRoomPressRef.current();
  }, []);

  const handleCreateRoomPressRef = useRef(() => {
    requireAuth(handleCreateRoom);
  });
  useLayoutEffect(() => {
    handleCreateRoomPressRef.current = () => {
      requireAuth(handleCreateRoom);
    };
  });
  const handleCreateRoomPress = useCallback(() => {
    handleCreateRoomPressRef.current();
  }, []);

  const handleReturnLastGamePressRef = useRef(() => {
    requireAuth(handleReturnToLastGame);
  });
  useLayoutEffect(() => {
    handleReturnLastGamePressRef.current = () => {
      requireAuth(handleReturnToLastGame);
    };
  });
  const handleReturnLastGamePress = useCallback(() => {
    handleReturnLastGamePressRef.current();
  }, []);

  // ============================================
  // Contextual tip card (session-only dismiss)
  // ============================================

  /** Build list of applicable tips based on user state, filtering out dismissed ones. */
  const activeTips = useMemo(() => {
    const all: {
      id: string;
      icon: IoniconsName;
      title: string;
      subtitle: string;
      onPress?: () => void;
      dismissable?: boolean;
    }[] = [];

    // Priority tips for unauthenticated / anonymous users first
    if (!user) {
      all.push({
        id: 'login',
        icon: UI_ICONS.USER,
        title: '登录后解锁全部功能',
        subtitle: '创建房间、设置昵称头像需要登录',
        onPress: () => navigation.navigate('AuthLogin'),
      });
    }
    if (user?.isAnonymous) {
      all.push({
        id: 'upgrade',
        icon: UI_ICONS.EMAIL,
        title: '升级为邮箱账户',
        subtitle: '绑定邮箱后可设置昵称和头像',
        onPress: () => navigation.navigate('Settings'),
      });
    }

    // WeChat user without email — prompt to bind
    if (isMiniProgram() && user && !user.isAnonymous && !user.email) {
      all.push({
        id: 'bind-email',
        icon: UI_ICONS.EMAIL,
        title: '绑定邮箱',
        subtitle: '绑定后可在网页端登录，数据不丢失',
        onPress: () => navigation.navigate('Settings'),
      });
    }

    // Share tip
    all.push({
      id: 'share',
      icon: UI_ICONS.SHARE,
      title: '邀请朋友？试试分享二维码',
      subtitle: '在房间内点击「分享房间」生成二维码',
    });

    // Feature discovery tips for authenticated users
    if (user && !user.isAnonymous) {
      all.push({
        id: 'nickname',
        icon: UI_ICONS.EDIT,
        title: '个性化你的昵称和头像',
        subtitle: '让队友在房间里认出你',
        onPress: () => navigation.navigate('Settings'),
      });
    }
    // Daily quote (always visible, not dismissable)
    all.push({
      id: 'daily-quote',
      icon: UI_ICONS.BOT,
      title: '每日一句',
      subtitle: getDailyQuote(),
      dismissable: false,
    });

    return all.filter((tip) => tip.dismissable === false || !dismissedTips.has(tip.id)).slice(0, 3);
  }, [dismissedTips, user, navigation]);

  const handleDismissTip = useCallback((tipId: string) => {
    setDismissedTips((prev) => new Set(prev).add(tipId));
    storage.set(tipStorageKey(tipId as TipId), '1');
  }, []);

  return (
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID={TESTIDS.homeScreenRoot}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          insets.bottom > 0 && { paddingBottom: insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Bar ─────────────────────────────────── */}
        <View style={[styles.topBar, { paddingTop: insets.top + layout.headerPaddingV }]}>
          <View style={styles.topBarBrand}>
            <Text style={styles.topBarTitle}>狼人kill电子裁判</Text>
          </View>
          <View style={styles.topBarActions}>
            <Button
              variant="icon"
              onPress={handleNavigateEncyclopedia}
              testID={TESTIDS.homeEncyclopediaButton}
              accessibilityLabel="角色图鉴"
            >
              <Ionicons
                name="book-outline"
                size={componentSizes.icon.md}
                color={colors.textSecondary}
              />
            </Button>

            <UserAvatar
              user={user}
              ticketCount={ticketCount}
              onPress={handleNavigateSettings}
              testID={TESTIDS.homeSettingsButton}
            />
          </View>
        </View>

        {user && (
          <Text style={styles.userNameHidden} testID={TESTIDS.homeUserName}>
            {userName}
          </Text>
        )}

        {/* ── Hero Card — Create Room ─────────────────── */}
        <PressableScale
          onPress={handleCreateRoomPress}
          disabled={authLoading}
          style={styles.heroCard}
          testID={TESTIDS.homeCreateRoomButton}
          haptic
        >
          <LinearGradient
            colors={[colors.primaryLight, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCardGradient}
          >
            <View style={styles.heroCardContent}>
              <Text style={styles.heroCardTitle}>{isCreating ? '创建中' : '创建房间'}</Text>
              <Text style={styles.heroCardSubtitle}>开始一局新游戏</Text>
            </View>
            {isCreating ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <View style={styles.heroCardArrow}>
                <Ionicons
                  name="chevron-forward"
                  size={componentSizes.icon.lg}
                  color={colors.textInverse}
                />
              </View>
            )}
          </LinearGradient>
        </PressableScale>

        {/* ── Action Row — Enter Room + Return to Last Game ── */}
        <View style={styles.actionRow}>
          <PressableScale
            onPress={handleEnterRoomPress}
            disabled={authLoading}
            style={[styles.actionCard, authLoading && styles.actionCardDisabled]}
            testID={TESTIDS.homeEnterRoomButton}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons
                name="log-in-outline"
                size={componentSizes.icon.lg}
                color={colors.primary}
              />
            </View>
            <Text style={styles.actionCardTitle}>{isJoining ? '进入中' : '进入房间'}</Text>
            <Text style={styles.actionCardSubtitle}>输入房间号</Text>
          </PressableScale>
          <PressableScale
            onPress={handleReturnLastGamePress}
            disabled={authLoading}
            style={[styles.actionCard, authLoading && styles.actionCardDisabled]}
            testID={TESTIDS.homeReturnLastGameButton}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons
                name="arrow-undo-outline"
                size={componentSizes.icon.lg}
                color={colors.primary}
              />
            </View>
            <Text style={styles.actionCardTitle}>返回上局</Text>
            <Text style={styles.actionCardSubtitle}>
              {lastRoomNumber ? `房间 ${lastRoomNumber}` : '无记录'}
            </Text>
          </PressableScale>
        </View>

        {/* ── Gacha Entry ─────────────────────────── */}
        <PressableScale onPress={handleNavigateGacha} style={styles.gachaCard} haptic>
          <Text style={styles.gachaCardEmoji}>🎰</Text>
          <View style={styles.gachaCardText}>
            <Text style={styles.gachaCardTitle}>扭蛋抽奖</Text>
            <Text style={styles.gachaCardSubtitle}>用抽奖券解锁头像、头像框、装饰</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </PressableScale>

        {/* ── Random Role Card (F8) ───────────────── */}
        <RandomRoleCard
          roleId={randomRoleData.roleId}
          displayName={randomRoleData.displayName}
          description={randomRoleData.description}
          factionColor={randomRoleData.factionColor}
          factionLabel={randomRoleData.factionLabel}
          avatarImage={randomRoleData.avatarImage}
          onRefresh={handleRefreshRole}
          onDetail={handleRoleDetail}
          styles={styles}
          colors={colors}
        />

        {/* ── Contextual Tips ────────────────────────── */}
        {activeTips.map((tip) => (
          <TipCard
            key={tip.id}
            tipId={tip.id}
            icon={tip.icon}
            title={tip.title}
            subtitle={tip.subtitle}
            onPress={tip.onPress}
            onDismiss={tip.dismissable !== false ? handleDismissTip : undefined}
            styles={styles}
            colors={colors}
            testID={TESTIDS.homeTipCard}
          />
        ))}

        {/* Footer with author and version */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{APP_VERSION} · 作者：严振宇</Text>
          <InstallMenuItem styles={styles} colors={colors} />
        </View>
      </ScrollView>

      {/* Join Room Modal */}
      <JoinRoomModal
        visible={showJoinModal}
        roomCode={roomCode}
        isLoading={isJoining}
        errorMessage={joinError}
        onRoomCodeChange={setRoomCode}
        onJoin={() => {
          void handleJoinRoom();
        }}
        onCancel={handleCancelJoin}
        styles={styles}
      />
    </SafeAreaView>
  );
};
