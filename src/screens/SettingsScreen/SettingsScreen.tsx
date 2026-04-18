/**
 * SettingsScreen - 应用设置与账号管理
 *
 * 性能优化同 HomeScreen：styles factory + useCallback + memoized 子组件。
 * 负责编排子组件、调用 service/navigation/showAlert。
 * 不使用硬编码样式值，不使用 console.*。
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sentry from '@sentry/react-native';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { LoginOptions } from '@/components/auth';
import { Button } from '@/components/Button';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useGameFacade } from '@/contexts/GameFacadeContext';
import { useGachaStatusQuery } from '@/hooks/queries/useGachaQuery';
import { useUserStatsQuery } from '@/hooks/queries/useUserStatsQuery';
import { RootStackParamList } from '@/navigation/types';
import { colors, componentSizes, fixed, layout, typography } from '@/theme';
import { showPrompt } from '@/utils/alert';
import { showDestructiveAlert, showErrorAlert } from '@/utils/alertPresets';
import { getBuiltinAvatarImage, isBuiltinAvatarUrl } from '@/utils/avatar';
import { getErrorMessage, translateReasonCode } from '@/utils/errorUtils';
import { isExpectedAuthError, mapAuthError, settingsLog } from '@/utils/logger';
import { isMiniProgram } from '@/utils/miniProgram';

import {
  AboutSection,
  AvatarSection,
  ChangePasswordForm,
  createSettingsScreenStyles,
  GrowthSection,
  NameSection,
} from './components';

export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  // Create styles once and pass to all sub-components
  const styles = useMemo(() => createSettingsScreenStyles(colors), []);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Settings'>>();
  const {
    user,
    signOut,
    signInAnonymously,
    isAuthenticated,
    updateProfile,
    changePassword,
    loading: authLoading,
  } = useAuth();
  const facade = useGameFacade();

  // Room context: subscribe to facade state for reactive canSwitchAccount
  const subscribe = useCallback((cb: () => void) => facade.subscribe(cb), [facade]);
  const getSnapshot = useCallback(() => facade.getState(), [facade]);
  const gameState = useSyncExternalStore(subscribe, getSnapshot);
  const isInRoom = gameState !== null;
  const isSeated = facade.getMySeatNumber() !== null;
  // 角色分配后（Assigned/Ready/Ongoing/Ended）禁止切换账号/绑定邮箱
  const canSwitchAccount =
    !isInRoom ||
    gameState?.status === GameStatus.Unseated ||
    gameState?.status === GameStatus.Seated;

  const [showChangePassword, setShowChangePassword] = useState(false);

  // Growth system state (shared cache via TanStack Query)
  const { data: growthStats } = useUserStatsQuery();

  // Gacha ticket count for badge
  const { data: gachaStatus } = useGachaStatusQuery();
  const ticketCount = gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : 0;

  // Track anonymous→email upgrade: sync new displayName to GameState
  const wasAnonymousRef = useRef(user?.isAnonymous);
  // Suppress LoginOptions flash during transient auth state (e.g. updateUser → onAuthStateChange)
  const wasAuthenticatedRef = useRef(isAuthenticated);

  useEffect(() => {
    const isAnonymous = user?.isAnonymous;
    if (wasAnonymousRef.current && user && !isAnonymous) {
      // Just upgraded from anonymous → email; sync profile to GameState if in room
      settingsLog.info('Anonymous→email upgrade detected, syncing profile to GameState');
      facade
        .updatePlayerProfile(user.displayName ?? undefined, user.avatarUrl ?? undefined)
        .catch((err: unknown) => settingsLog.warn('Profile sync to GameState failed:', err));
    }
    wasAnonymousRef.current = isAnonymous;
    if (isAuthenticated) wasAuthenticatedRef.current = true;
  }, [user, facade, isAuthenticated]);

  // Reset transient states when screen regains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Reserved for future transient state resets
    });
    return unsubscribe;
  }, [navigation]);

  // Get avatar source (only for custom avatars; default handled by Avatar component)
  const avatarSource = useMemo(() => {
    if (user?.avatarUrl && !user?.isAnonymous) {
      if (isBuiltinAvatarUrl(user.avatarUrl)) {
        return getBuiltinAvatarImage(user.avatarUrl);
      }
      return { uri: user.avatarUrl };
    }
    return null; // default → AvatarSection uses Avatar component
  }, [user?.isAnonymous, user?.avatarUrl]);

  // ============================================
  // Stable callback handlers
  // ============================================

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  const handleSignOut = useCallback(async () => {
    wasAuthenticatedRef.current = false;
    await signOut();
  }, [signOut]);

  const handlePickAvatar = useCallback(() => {
    navigation.navigate('AvatarPicker');
  }, [navigation]);

  const handleNavigateUnlocks = useCallback(() => {
    navigation.navigate('Unlocks');
  }, [navigation]);

  const handleNavigateGacha = useCallback(() => {
    navigation.navigate('Gacha');
  }, [navigation]);

  const handleStartEditName = useCallback(() => {
    showPrompt('修改昵称', {
      placeholder: '输入名字',
      defaultValue: user?.displayName || '',
      onConfirm: async (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) {
          toast.warning('请输入名字');
          return;
        }
        try {
          await updateProfile({ displayName: trimmed });
          toast.success('昵称已更新');
          facade
            .updatePlayerProfile(trimmed, undefined)
            .catch((err: unknown) => settingsLog.warn('Name sync to GameState failed:', err));
        } catch (e: unknown) {
          const message = getErrorMessage(e);
          settingsLog.error('Update name failed:', message, e);
          showErrorAlert('更新失败', message);
        }
      },
    });
  }, [user?.displayName, updateProfile, facade]);

  /** 匿名用户「绑定邮箱」：直接进入注册模式 */
  const handleShowUpgradeForm = useCallback(() => {
    navigation.navigate('AuthEmail', {
      mode: 'signUp',
      formTitle: '绑定邮箱',
      showToggleMode: false,
      showSuccessOnLogin: true,
    });
  }, [navigation]);

  /** 微信用户「绑定已有账号」：输入已有邮箱+密码，服务端合并账号 */
  const handleBindExistingEmail = useCallback(() => {
    navigation.navigate('AuthEmail', {
      mode: 'signUp',
      formTitle: '绑定已有账号',
      showToggleMode: false,
      showSuccessOnLogin: true,
      hideDisplayName: true,
    });
  }, [navigation]);

  /** 微信用户「注册新邮箱」 */
  const handleBindNewEmail = useCallback(() => {
    navigation.navigate('AuthEmail', {
      mode: 'signUp',
      formTitle: '注册新邮箱',
      showToggleMode: false,
      showSuccessOnLogin: true,
    });
  }, [navigation]);

  /** 切换账号：先离座（如在房间内），弹登录表单，登录成功后替换本地 session */
  const handleSwitchAccount = useCallback(() => {
    const doSwitch = async () => {
      try {
        // If seated in a room, leave seat first (simplifies all edge cases)
        if (isInRoom && isSeated) {
          const result = await facade.leaveSeatWithAck();
          if (!result.success) {
            showErrorAlert('离座失败', translateReasonCode(result.reason));
            return;
          }
        }

        navigation.navigate('AuthEmail', {
          mode: 'signIn',
          signOutFirst: true,
          showSuccessOnLogin: true,
        });
      } catch (e: unknown) {
        const raw = e instanceof Error ? e.message : String(e);
        const message = mapAuthError(raw);
        if (isExpectedAuthError(raw)) {
          settingsLog.warn('Account switch expected error:', raw, e);
        } else {
          settingsLog.error('Account switch failed:', raw, e);
          Sentry.captureException(e);
        }
        showErrorAlert('切换失败', message);
      }
    };

    if (user?.isAnonymous) {
      showDestructiveAlert('切换账号', '匿名数据将无法恢复，确定切换账号？', '切换', doSwitch);
    } else {
      doSwitch();
    }
  }, [user?.isAnonymous, facade, navigation, isInRoom, isSeated]);

  // ============================================
  // Render helpers
  // ============================================

  const handleEmailSignUp = useCallback(() => {
    navigation.navigate('AuthEmail', { mode: 'signUp', navigateSettingsOnSignUp: true });
  }, [navigation]);

  const handleEmailSignIn = useCallback(() => {
    navigation.navigate('AuthEmail', { mode: 'signIn' });
  }, [navigation]);

  const handleAnonymousLogin = useCallback(async () => {
    try {
      await signInAnonymously();
      toast.success('登录成功');
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      settingsLog.warn('Anonymous login failed:', message);
      showErrorAlert('登录失败', message);
    }
  }, [signInAnonymously]);

  const handleBrowseAvatars = useCallback(() => {
    navigation.navigate('AvatarPicker');
  }, [navigation]);

  const renderAuthSection = () => {
    if (isAuthenticated) {
      // ── Anonymous user: avatar + teaser card + account operations ──
      if (user?.isAnonymous) {
        return (
          <>
            <AvatarSection
              isAnonymous
              uid={user?.uid ?? 'anonymous'}
              avatarSource={avatarSource}
              avatarUrl={user?.avatarUrl}
              avatarFrame={user?.avatarFrame}
              seatFlair={user?.seatFlair}
              uploadingAvatar={false}
              displayName={user?.displayName ?? null}
              onPickAvatar={handlePickAvatar}
              styles={styles}
              colors={colors}
            />

            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>状态</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>匿名登录</Text>
              </View>
            </View>

            {canSwitchAccount && (
              <Button
                variant="ghost"
                buttonColor={colors.background}
                textColor={colors.primary}
                onPress={handleShowUpgradeForm}
                style={styles.logoutBtn}
              >
                绑定邮箱
              </Button>
            )}

            {canSwitchAccount && (
              <Button
                variant="ghost"
                buttonColor={colors.background}
                textColor={colors.text}
                onPress={handleSwitchAccount}
                style={styles.logoutBtn}
              >
                切换账号
              </Button>
            )}

            {!isInRoom && (
              <Button
                variant="ghost"
                buttonColor={colors.background}
                textColor={colors.text}
                onPress={handleSignOut}
                style={styles.logoutBtn}
              >
                登出
              </Button>
            )}
          </>
        );
      }

      // ── Registered user: horizontal profile row + dresser entry + account info + operations ──
      return (
        <>
          {/* Zone 1: Identity — horizontal avatar + name/status/email */}
          <View style={styles.profileRow}>
            <AvatarSection
              isAnonymous={false}
              uid={user?.uid ?? 'anonymous'}
              avatarSource={avatarSource}
              avatarUrl={user?.avatarUrl}
              avatarFrame={user?.avatarFrame}
              seatFlair={user?.seatFlair}
              uploadingAvatar={false}
              displayName={user?.displayName ?? null}
              onPickAvatar={handlePickAvatar}
              styles={styles}
              colors={colors}
            />
            <View style={styles.profileRowRight}>
              <View style={styles.profileRowName}>
                <NameSection
                  isAnonymous={false}
                  displayName={user?.displayName ?? null}
                  nameStyle={user?.nameStyle}
                  onStartEdit={handleStartEditName}
                  styles={styles}
                />
                {growthStats && (
                  <View style={styles.levelPill}>
                    <Text style={styles.levelPillText}>Lv.{growthStats.level}</Text>
                  </View>
                )}
              </View>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{user?.email ? '邮箱登录' : '微信登录'}</Text>
              </View>
              {user?.email && <Text style={styles.accountValue}>{user.email}</Text>}
            </View>
          </View>

          {/* Growth — full width below profile row */}
          {growthStats && (
            <GrowthSection
              stats={growthStats}
              styles={styles}
              onPressUnlocks={handleNavigateUnlocks}
            />
          )}

          {/* Zone 2: Dresser entry */}
          <TouchableOpacity
            style={styles.dresserEntry}
            onPress={handlePickAvatar}
            activeOpacity={fixed.activeOpacity}
          >
            <Text style={styles.dresserEntryText}>更换头像与装扮</Text>
            <Ionicons
              name="chevron-forward"
              size={componentSizes.icon.md}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {/* Zone 2b: Gacha entry */}
          <TouchableOpacity
            style={styles.dresserEntry}
            onPress={handleNavigateGacha}
            activeOpacity={fixed.activeOpacity}
          >
            <View style={styles.dresserEntryRight}>
              <Ionicons name="gift-outline" size={componentSizes.icon.sm} color={colors.text} />
              <Text style={styles.dresserEntryText}>扭蛋抽奖</Text>
            </View>
            <View style={styles.dresserEntryRight}>
              {ticketCount > 0 && (
                <View style={styles.dresserEntryBadge}>
                  <Text style={styles.dresserEntryBadgeText}>
                    {ticketCount > 99 ? '99+' : ticketCount}
                  </Text>
                </View>
              )}
              <Ionicons
                name="chevron-forward"
                size={componentSizes.icon.md}
                color={colors.textMuted}
              />
            </View>
          </TouchableOpacity>

          {/* Zone 3: Account operations */}
          {canSwitchAccount && !user?.email && isMiniProgram() && (
            <>
              <TouchableOpacity
                style={styles.dresserEntry}
                activeOpacity={fixed.activeOpacity}
                onPress={handleBindExistingEmail}
              >
                <View style={styles.dresserEntryContent}>
                  <Text style={styles.dresserEntryText}>绑定已有账号</Text>
                  <Text style={styles.dresserEntryDesc}>
                    输入之前注册的邮箱和密码，恢复昵称、头像等数据
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={componentSizes.icon.md}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dresserEntry}
                activeOpacity={fixed.activeOpacity}
                onPress={handleBindNewEmail}
              >
                <View style={styles.dresserEntryContent}>
                  <Text style={styles.dresserEntryText}>注册新邮箱</Text>
                  <Text style={styles.dresserEntryDesc}>绑定后可在网页端登录，数据不丢失</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={componentSizes.icon.md}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </>
          )}
          {canSwitchAccount && !user?.email && !isMiniProgram() && (
            <Button
              variant="ghost"
              buttonColor={colors.background}
              textColor={colors.primary}
              onPress={handleShowUpgradeForm}
              style={styles.logoutBtn}
            >
              绑定邮箱
            </Button>
          )}

          {user?.email && showChangePassword ? (
            <ChangePasswordForm
              onSubmit={async (oldPw, newPw) => {
                await changePassword(oldPw, newPw);
                setShowChangePassword(false);
                toast.success('密码已修改');
              }}
              onCancel={() => setShowChangePassword(false)}
              styles={styles}
              colors={colors}
            />
          ) : user?.email ? (
            <Button
              variant="ghost"
              buttonColor={colors.background}
              textColor={colors.text}
              onPress={() => setShowChangePassword(true)}
              style={styles.logoutBtn}
            >
              修改密码
            </Button>
          ) : null}

          {canSwitchAccount && !showChangePassword && !isMiniProgram() && (
            <Button
              variant="ghost"
              buttonColor={colors.background}
              textColor={colors.text}
              onPress={handleSwitchAccount}
              style={styles.logoutBtn}
            >
              切换账号
            </Button>
          )}

          {!isInRoom && !showChangePassword && !isMiniProgram() && (
            <Button
              variant="ghost"
              buttonColor={colors.background}
              textColor={colors.error}
              onPress={handleSignOut}
              style={styles.logoutBtn}
            >
              登出
            </Button>
          )}
        </>
      );
    }

    // Suppress LoginOptions during auth initialization or transient auth state flashes
    // (e.g. auth SDK glitch, or initial session restore)
    if (wasAuthenticatedRef.current || authLoading) {
      return null;
    }

    return (
      <LoginOptions
        authLoading={authLoading}
        onEmailSignUp={handleEmailSignUp}
        onEmailSignIn={handleEmailSignIn}
        onAnonymousLogin={handleAnonymousLogin}
        hideAnonymous={isMiniProgram()}
        onBrowseAvatars={handleBrowseAvatars}
        styles={styles}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={[styles.header, { paddingTop: insets.top + layout.headerPaddingV }]}>
        <Button variant="icon" onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </Button>
        <Text style={styles.headerTitle}>设置</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          insets.bottom > 0 && { paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="person-outline" size={typography.body} color={colors.text} /> 账户
          </Text>
          {/* eslint-disable-next-line react-hooks/refs -- wasAuthenticatedRef is intentionally read during render to suppress auth UI flash during transient auth state */}
          {renderAuthSection()}
        </View>

        <AboutSection styles={styles} />
      </ScrollView>
    </SafeAreaView>
  );
};
