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

import { LoginOptions } from '@/components/auth';
import { Button } from '@/components/Button';
import { PageGuideModal } from '@/components/PageGuideModal';
import { SETTINGS_GUIDE } from '@/config/guideContent';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useGameFacade } from '@/contexts/GameFacadeContext';
import { resetAllGuides, usePageGuide } from '@/hooks/usePageGuide';
import { RootStackParamList } from '@/navigation/types';
import { componentSizes, fixed, layout, ThemeKey, typography, useTheme } from '@/theme';
import { showAlert } from '@/utils/alert';
import { showConfirmAlert, showDestructiveAlert, showErrorAlert } from '@/utils/alertPresets';
import { getBuiltinAvatarImage, isBuiltinAvatarUrl } from '@/utils/avatar';
import { getErrorMessage, translateReasonCode } from '@/utils/errorUtils';
import { isExpectedAuthError, mapAuthError, settingsLog } from '@/utils/logger';

import {
  AboutSection,
  AvatarSection,
  ChangePasswordForm,
  createSettingsScreenStyles,
  NameSection,
  ThemeSelector,
} from './components';

export const SettingsScreen: React.FC = () => {
  const { colors, themeKey, setTheme, availableThemes } = useTheme();
  const insets = useSafeAreaInsets();
  // Create styles once and pass to all sub-components
  const styles = useMemo(() => createSettingsScreenStyles(colors), [colors]);
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
  const settingsGuide = usePageGuide('settings');

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

  // Edit profile state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  // Reset transient states when screen regains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsEditingName(false);
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

  const handleUpdateName = useCallback(async () => {
    if (!editName.trim()) {
      showAlert('请输入名字');
      return;
    }

    try {
      const trimmedName = editName.trim();
      await updateProfile({ displayName: trimmedName });
      setIsEditingName(false);
      showAlert('昵称已更新');

      // Sync to GameState (if in room & seated, silent failure is fine)
      facade
        .updatePlayerProfile(trimmedName, undefined)
        .catch((err: unknown) => settingsLog.warn('Name sync to GameState failed:', err));
    } catch (e: unknown) {
      // AuthContext already reported to Sentry before re-throwing; avoid double-reporting
      const message = getErrorMessage(e);
      settingsLog.error('Update name failed:', message, e);
      showErrorAlert('更新失败', message);
    }
  }, [editName, updateProfile, facade]);

  const handleStartEditName = useCallback(() => {
    setEditName(user?.displayName || '');
    setIsEditingName(true);
  }, [user?.displayName]);

  const handleCancelEditName = useCallback(() => {
    setIsEditingName(false);
  }, []);

  /** 匿名用户「绑定邮箱」：直接进入注册模式 */
  const handleShowUpgradeForm = useCallback(() => {
    navigation.navigate('AuthEmail', {
      mode: 'signUp',
      formTitle: '绑定邮箱',
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
      showDestructiveAlert('切换账号', '匿名数据将无法恢复，确定切换账号？', '确定', doSwitch);
    } else {
      doSwitch();
    }
  }, [user?.isAnonymous, facade, navigation, isInRoom, isSeated]);

  const handleThemeChange = useCallback(
    (key: string) => {
      setTheme(key as ThemeKey);
    },
    [setTheme],
  );

  const handleResetGuides = useCallback(() => {
    showConfirmAlert(
      '重置新手引导',
      '重置后，每个页面的新手引导将再次显示。',
      () => {
        resetAllGuides()
          .then(() => {
            showAlert('已重置', '引导将重新显示');
          })
          .catch((e: unknown) => {
            settingsLog.error('Reset guides failed:', e);
            showErrorAlert('重置失败', getErrorMessage(e));
          });
      },
      { confirmText: '确认重置' },
    );
  }, []);

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
      showAlert('登录成功');
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
                  isEditingName={isEditingName}
                  editName={editName}
                  onEditNameChange={setEditName}
                  onStartEdit={handleStartEditName}
                  onSave={handleUpdateName}
                  onCancel={handleCancelEditName}
                  styles={styles}
                  colors={colors}
                />
              </View>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>邮箱登录</Text>
              </View>
              {user?.email && <Text style={styles.accountValue}>{user.email}</Text>}
            </View>
          </View>

          {/* Zone 2: Dresser entry */}
          <TouchableOpacity
            style={styles.dresserEntry}
            onPress={handlePickAvatar}
            activeOpacity={fixed.activeOpacity}
          >
            <Text style={styles.dresserEntryText}>更换头像与头像框</Text>
            <Ionicons
              name="chevron-forward"
              size={componentSizes.icon.md}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {/* Zone 3: Account operations */}
          {showChangePassword ? (
            <ChangePasswordForm
              onSubmit={async (oldPw, newPw) => {
                await changePassword(oldPw, newPw);
                setShowChangePassword(false);
                showAlert('密码已修改');
              }}
              onCancel={() => setShowChangePassword(false)}
              styles={styles}
              colors={colors}
            />
          ) : (
            <Button
              variant="ghost"
              buttonColor={colors.background}
              textColor={colors.text}
              onPress={() => setShowChangePassword(true)}
              style={styles.logoutBtn}
            >
              修改密码
            </Button>
          )}

          {canSwitchAccount && !showChangePassword && (
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

          {!isInRoom && !showChangePassword && (
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
        onBrowseAvatars={handleBrowseAvatars}
        styles={styles}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={[styles.header, { paddingTop: insets.top + layout.headerPaddingV }]}>
        <Button variant="icon" onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </Button>
        <Text style={styles.headerTitle}>设置</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="person-outline" size={typography.body} color={colors.text} /> 账户
          </Text>
          {/* eslint-disable-next-line react-hooks/refs -- wasAuthenticatedRef is intentionally read during render to suppress auth UI flash during transient auth state */}
          {renderAuthSection()}
        </View>

        <ThemeSelector
          currentThemeKey={themeKey}
          availableThemes={availableThemes}
          onThemeChange={handleThemeChange}
          styles={styles}
        />

        <AboutSection styles={styles} />

        {/* Reset Guides */}
        <Button
          variant="ghost"
          buttonColor={colors.background}
          textColor={colors.textSecondary}
          onPress={handleResetGuides}
          style={styles.logoutBtn}
          icon={
            <Ionicons name="refresh-outline" size={typography.body} color={colors.textSecondary} />
          }
        >
          重置新手引导
        </Button>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Page Guide */}
      <PageGuideModal
        visible={settingsGuide.visible}
        title={SETTINGS_GUIDE.title}
        titleEmoji={SETTINGS_GUIDE.titleEmoji}
        items={SETTINGS_GUIDE.items}
        dontShowAgain={settingsGuide.dontShowAgain}
        onToggleDontShowAgain={settingsGuide.toggleDontShowAgain}
        onDismiss={settingsGuide.dismiss}
      />
    </SafeAreaView>
  );
};
