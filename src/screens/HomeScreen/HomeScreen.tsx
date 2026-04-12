/**
 * HomeScreen - 主页入口（登录、加入房间、创建房间）
 *
 * Apple HIG 风格布局：TopBar 品牌+头像 → Hero Card → Action Row →
 * RandomRoleCard → TipCards → Footer。
 * 性能优化：styles factory 集中创建一次，通过 props 传入子组件；handlers 用 useCallback 稳定化。
 * 负责编排子组件、调用 service/navigation/showAlert。
 * 不使用硬编码样式值，不使用 console.*。
 */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Faction,
  getAllRoleIds,
  getRoleSpec,
  isWolfRole,
} from '@werewolf/game-engine/models/roles';
import { randomIntInclusive } from '@werewolf/game-engine/utils/random';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { PageGuideModal } from '@/components/PageGuideModal';
import { PressableScale } from '@/components/PressableScale';
import { getDailyQuote } from '@/config/dailyQuotes';
import { HOME_GUIDE } from '@/config/guideContent';
import { type IoniconsName, UI_ICONS } from '@/config/iconTokens';
import { LAST_ROOM_NUMBER_KEY, type TipId, tipStorageKey } from '@/config/storageKeys';
import { APP_VERSION } from '@/config/version';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { usePageGuide } from '@/hooks/usePageGuide';
import { RootStackParamList } from '@/navigation/types';
import { fetchUserStats } from '@/services/feature/StatsService';
import { TESTIDS } from '@/testids';
import { componentSizes, layout, useTheme } from '@/theme';
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
  UserAvatar,
} from './components';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // Create styles once and pass to all sub-components
  const styles = useMemo(() => createHomeScreenStyles(colors, screenWidth), [colors, screenWidth]);

  const navigation = useNavigation<NavigationProp>();
  const { user, loading: authLoading } = useAuth();
  const homeGuide = usePageGuide('home');
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

  // User level for top bar display
  const [userLevel, setUserLevel] = useState<number | null>(null);

  // Load persisted tip dismissals from AsyncStorage
  useEffect(() => {
    const tipIds: TipId[] = ['share', 'login', 'upgrade', 'nickname', 'theme', 'bind-email'];
    const keys = tipIds.map(tipStorageKey);
    AsyncStorage.multiGet(keys)
      .then((results) => {
        const dismissed = new Set<string>();
        results.forEach(([key, value]) => {
          if (value === '1') {
            // Extract tipId from storage key
            const tipId = tipIds.find((id) => tipStorageKey(id) === key);
            if (tipId) dismissed.add(tipId);
          }
        });
        setDismissedTips(dismissed);
      })
      .catch((e: unknown) => {
        homeLog.warn('Failed to read tip dismissed state', e);
      })
      .finally(() => {
        setTipsLoaded(true);
      });
  }, []);

  // Reload dismissed tips when screen regains focus (after Settings reset)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const tipIds: TipId[] = ['share', 'login', 'upgrade', 'nickname', 'theme', 'bind-email'];
      const keys = tipIds.map(tipStorageKey);
      AsyncStorage.multiGet(keys)
        .then((results) => {
          const dismissed = new Set<string>();
          results.forEach(([key, value]) => {
            if (value === '1') {
              const tipId = tipIds.find((id) => tipStorageKey(id) === key);
              if (tipId) dismissed.add(tipId);
            }
          });
          setDismissedTips(dismissed);
        })
        .catch((e: unknown) => {
          homeLog.warn('Failed to reload tip dismissed state', e);
        });
    });
    return unsubscribe;
  }, [navigation]);

  // Fetch user level on mount and when screen regains focus
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setUserLevel(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      fetchUserStats()
        .then((stats) => {
          if (!cancelled) setUserLevel(stats.level);
        })
        .catch((e: unknown) => {
          homeLog.warn('Failed to fetch user stats', e);
        });
    };
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user, navigation]);

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
  // (room-not-found clears AsyncStorage, need to re-read on focus)
  useEffect(() => {
    const readLastRoom = () => {
      AsyncStorage.getItem(LAST_ROOM_NUMBER_KEY)
        .then((value) => {
          setLastRoomNumber(value);
        })
        .catch((e: unknown) => {
          homeLog.warn('Failed to read lastRoomNumber from AsyncStorage', e);
        });
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

    try {
      await AsyncStorage.setItem(LAST_ROOM_NUMBER_KEY, roomCode);
      setShowJoinModal(false);
      navigation.navigate('Room', { roomNumber: roomCode, isHost: false });
      setRoomCode('');
    } catch {
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
    navigation.navigate('Room', { roomNumber: lastRoomNumber, isHost: false });
  }, [lastRoomNumber, navigation]);

  const handleCancelJoin = useCallback(() => {
    setShowJoinModal(false);
    setRoomCode('');
    setJoinError(null);
    setIsJoining(false);
  }, []);

  const handleCreateRoom = useCallback(() => {
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
  }, [allRoleIds, randomRoleIndex, colors]);

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
    all.push({
      id: 'theme',
      icon: UI_ICONS.THEME,
      title: '试试切换主题',
      subtitle: '8 种主题风格可选',
      onPress: () => navigation.navigate('Settings'),
    });

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
    // Persist to AsyncStorage
    AsyncStorage.setItem(tipStorageKey(tipId as TipId), '1').catch((e: unknown) => {
      homeLog.warn('Failed to persist tip dismissal', e);
    });
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
              level={userLevel}
              onPress={handleNavigateSettings}
              styles={styles}
              colors={colors}
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
          <View style={styles.heroCardContent}>
            <Text style={styles.heroCardTitle}>{isCreating ? '创建中…' : '创建房间'}</Text>
            <Text style={styles.heroCardSubtitle}>开始一局新游戏</Text>
          </View>
          {isCreating ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <View style={styles.heroCardArrow}>
              <Ionicons
                name="chevron-forward"
                size={componentSizes.icon.lg}
                color={colors.textInverse}
              />
            </View>
          )}
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
              <Ionicons name="log-in-outline" size={componentSizes.icon.lg} color={colors.text} />
            </View>
            <Text style={styles.actionCardTitle}>{isJoining ? '进入中…' : '进入房间'}</Text>
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
                color={colors.text}
              />
            </View>
            <Text style={styles.actionCardTitle}>返回上局</Text>
            <Text style={styles.actionCardSubtitle}>
              {lastRoomNumber ? `房间 ${lastRoomNumber}` : '无记录'}
            </Text>
          </PressableScale>
        </View>

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
        onJoin={handleJoinRoom}
        onCancel={handleCancelJoin}
        styles={styles}
      />

      {/* Page Guide */}
      <PageGuideModal
        visible={homeGuide.visible}
        title={HOME_GUIDE.title}
        titleEmoji={HOME_GUIDE.titleEmoji}
        items={HOME_GUIDE.items}
        dontShowAgain={homeGuide.dontShowAgain}
        onToggleDontShowAgain={homeGuide.toggleDontShowAgain}
        onDismiss={homeGuide.dismiss}
      />
    </SafeAreaView>
  );
};
