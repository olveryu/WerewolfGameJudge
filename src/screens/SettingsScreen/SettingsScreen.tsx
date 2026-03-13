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
import * as ImagePicker from 'expo-image-picker';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmailForm, LoginOptions } from '@/components/auth';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useGameFacade } from '@/contexts/GameFacadeContext';
import { useAuthForm } from '@/hooks/useAuthForm';
import { RootStackParamList } from '@/navigation/types';
import { componentSizes, ThemeKey, typography, useTheme } from '@/theme';
import { CANCEL_BUTTON, showAlert } from '@/utils/alert';
import { getAvatarImage } from '@/utils/avatar';
import { getErrorMessage, translateReasonCode } from '@/utils/errorUtils';
import { settingsLog } from '@/utils/logger';

import {
  AboutSection,
  AvatarSection,
  createSettingsScreenStyles,
  NameSection,
  ThemeSelector,
} from './components';

export const SettingsScreen: React.FC = () => {
  const { colors, themeKey, setTheme, availableThemes } = useTheme();
  // Create styles once and pass to all sub-components
  const styles = useMemo(() => createSettingsScreenStyles(colors), [colors]);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Settings'>>();
  const {
    user,
    signOut,
    isAuthenticated,
    updateProfile,
    uploadAvatar,
    error: authError,
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

  // Auth form state
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  // Track anonymous→email upgrade: sync new displayName to GameState
  const wasAnonymousRef = useRef(user?.isAnonymous);
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
  }, [user, facade]);

  const handleAuthSuccess = useCallback(() => {
    setShowAuthForm(false);
    setIsSwitchingAccount(false);
  }, []);

  const {
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    isSignUp,
    setIsSignUp,
    handleEmailAuth,
    handleAnonymousLogin,
    resetForm,
    toggleSignUp,
  } = useAuthForm({ onSuccess: handleAuthSuccess, logger: settingsLog, showSuccessOnLogin: true });

  // Edit profile state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Reset transient states when screen regains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setUploadingAvatar(false);
      setIsEditingName(false);
    });
    return unsubscribe;
  }, [navigation]);

  // Get avatar source
  const avatarSource = useMemo(() => {
    if (user?.isAnonymous) {
      return getAvatarImage('anonymous');
    }
    if (user?.avatarUrl) {
      return { uri: user.avatarUrl };
    }
    return getAvatarImage(user?.uid || user?.displayName || 'anonymous');
  }, [user?.isAnonymous, user?.avatarUrl, user?.uid, user?.displayName]);

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

  const handlePickAvatar = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('需要相册权限才能选择头像');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingAvatar(true);
        try {
          const url = await uploadAvatar(result.assets[0].uri);
          showAlert('头像已更新');

          // Sync to GameState (if in room & seated, silent failure is fine)
          facade
            .updatePlayerProfile(undefined, url)
            .catch((err: unknown) => settingsLog.warn('Avatar sync to GameState failed:', err));
        } catch (e: unknown) {
          // AuthContext already reported to Sentry before re-throwing; avoid double-reporting
          const message = getErrorMessage(e);
          settingsLog.error('Avatar upload failed:', message, e);
          showAlert('上传失败', message);
        } finally {
          setUploadingAvatar(false);
        }
      }
    } catch (e: unknown) {
      // Image picker permission denied / user cancel — expected, no Sentry
      const message = getErrorMessage(e);
      settingsLog.warn('Image picker failed:', message, e);
      showAlert('选择图片失败', message);
    }
  }, [uploadAvatar, facade]);

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
      showAlert('更新失败', message);
    }
  }, [editName, updateProfile, facade]);

  const handleCancelAuthForm = useCallback(() => {
    setShowAuthForm(false);
    setIsSwitchingAccount(false);
    resetForm();
  }, [resetForm]);

  const handleStartEditName = useCallback(() => {
    setEditName(user?.displayName || '');
    setIsEditingName(true);
  }, [user?.displayName]);

  const handleCancelEditName = useCallback(() => {
    setIsEditingName(false);
  }, []);

  const handleShowAuthForm = useCallback(() => {
    setShowAuthForm(true);
  }, []);

  /** 匿名用户「绑定邮箱」：直接进入注册模式 */
  const handleShowUpgradeForm = useCallback(() => {
    setIsSignUp(true);
    setShowAuthForm(true);
  }, [setIsSignUp]);

  /** 切换账号：先离座（如在房间内），弹登录表单，登录成功后旧 session 由 Supabase 原子替换 */
  const handleSwitchAccount = useCallback(() => {
    const doSwitch = async () => {
      try {
        // If seated in a room, leave seat first (simplifies all edge cases)
        if (isInRoom && isSeated) {
          const result = await facade.leaveSeatWithAck();
          if (!result.success) {
            showAlert('离座失败', translateReasonCode(result.reason));
            return;
          }
        }

        setIsSwitchingAccount(true);
        setShowAuthForm(true);
        setIsSignUp(false);
      } catch (e: unknown) {
        const message = getErrorMessage(e);
        settingsLog.error('Account switch failed:', message, e);
        Sentry.captureException(e);
        setShowAuthForm(false);
        setIsSwitchingAccount(false);
        showAlert('切换失败', message);
      }
    };

    if (user?.isAnonymous) {
      showAlert('切换账号', '匿名数据将无法恢复，确定切换账号？', [
        CANCEL_BUTTON,
        { text: '确定', style: 'destructive', onPress: doSwitch },
      ]);
    } else {
      doSwitch();
    }
  }, [user?.isAnonymous, facade, setIsSignUp, isInRoom, isSeated]);

  /**
   * 切换账号模式下的表单提交：先 signOut 再走正常 auth 流程。
   * signInWithPassword 可原子替换 session，但 signUp 在匿名用户下会触发 identity linking，
   * 所以统一先 signOut 确保语义正确。
   */
  const handleSwitchAuthSubmit = useCallback(async () => {
    try {
      await signOut();
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      settingsLog.error('Sign-out before switch failed:', message, e);
      Sentry.captureException(e);
      showAlert('切换失败', message);
      return;
    }
    await handleEmailAuth();
  }, [signOut, handleEmailAuth]);

  const handleThemeChange = useCallback(
    (key: string) => {
      setTheme(key as ThemeKey);
    },
    [setTheme],
  );

  // ============================================
  // Render helpers
  // ============================================

  // Whether form should show a custom title
  const isUpgradeFlow = isAuthenticated && user?.isAnonymous && showAuthForm && !isSwitchingAccount;

  const renderAuthSection = () => {
    // EmailForm takes priority — both anonymous-upgrade and unauthenticated flows
    if (showAuthForm) {
      return (
        <EmailForm
          formTitle={isUpgradeFlow ? '绑定邮箱' : undefined}
          isSignUp={isSignUp}
          email={email}
          password={password}
          displayName={displayName}
          authError={authError}
          authLoading={authLoading}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onDisplayNameChange={setDisplayName}
          onSubmit={isSwitchingAccount ? handleSwitchAuthSubmit : handleEmailAuth}
          onToggleMode={isUpgradeFlow ? undefined : toggleSignUp}
          onBack={handleCancelAuthForm}
          styles={styles}
          colors={colors}
        />
      );
    }

    if (isAuthenticated) {
      return (
        <>
          <View style={styles.profileSection}>
            <AvatarSection
              isAnonymous={user?.isAnonymous ?? true}
              avatarSource={avatarSource}
              isRemote={!!user?.avatarUrl && !user?.isAnonymous}
              uploadingAvatar={uploadingAvatar}
              onPickAvatar={handlePickAvatar}
              styles={styles}
              colors={colors}
            />
            <NameSection
              isAnonymous={user?.isAnonymous ?? true}
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

          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>状态</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{user?.isAnonymous ? '匿名登录' : '邮箱登录'}</Text>
            </View>
          </View>

          {user?.email && (
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>邮箱</Text>
              <Text style={styles.accountValue}>{user.email}</Text>
            </View>
          )}

          {user?.isAnonymous && canSwitchAccount && (
            <TouchableOpacity style={styles.logoutBtn} onPress={handleShowUpgradeForm}>
              <Text style={styles.logoutBtnText}>绑定邮箱</Text>
            </TouchableOpacity>
          )}

          {canSwitchAccount && (
            <TouchableOpacity style={styles.logoutBtn} onPress={handleSwitchAccount}>
              <Text style={styles.logoutBtnText}>切换账号</Text>
            </TouchableOpacity>
          )}

          {!isInRoom && (
            <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
              <Text style={styles.logoutBtnText}>登出</Text>
            </TouchableOpacity>
          )}
        </>
      );
    }

    return (
      <LoginOptions
        authLoading={authLoading}
        onEmailLogin={handleShowAuthForm}
        onAnonymousLogin={handleAnonymousLogin}
        styles={styles}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>设置</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Ionicons name="person-outline" size={typography.body} color={colors.text} /> 账户
          </Text>
          {renderAuthSection()}
        </View>

        <ThemeSelector
          currentThemeKey={themeKey}
          availableThemes={availableThemes}
          onThemeChange={handleThemeChange}
          styles={styles}
        />

        <AboutSection styles={styles} />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};
