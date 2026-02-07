/**
 * SettingsScreen - App settings and account management
 *
 * Performance optimizations:
 * - Styles created once in parent and passed to all sub-components
 * - All sub-components memoized with custom arePropsEqual
 * - Handlers use useCallback to maintain stable references
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../hooks';
import { useTheme, ThemeKey } from '../../theme';
import { showAlert } from '../../utils/alert';
import { getAvatarImage } from '../../utils/avatar';
import {
  AvatarSection,
  NameSection,
  AuthForm,
  AuthOptions,
  ThemeSelector,
  createSettingsScreenStyles,
} from './components';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen: React.FC = () => {
  const { colors, themeKey, setTheme, availableThemes } = useTheme();
  // Create styles once and pass to all sub-components
  const styles = useMemo(() => createSettingsScreenStyles(colors), [colors]);

  const navigation = useNavigation();
  const {
    user,
    signOut,
    isAuthenticated,
    signInAnonymously,
    signUpWithEmail,
    signInWithEmail,
    updateProfile,
    uploadAvatar,
    error: authError,
    loading: authLoading,
  } = useAuth();

  // Auth form state
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Edit profile state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Reset transient states when screen regains focus
  useEffect(() => {
    const addListener = (
      navigation as unknown as { addListener?: (event: string, cb: () => void) => () => void }
    ).addListener;

    if (!addListener) {
      return;
    }

    const unsubscribe = addListener('focus', () => {
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
    navigation.goBack();
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
          await uploadAvatar(result.assets[0].uri);
          showAlert('头像已更新！');
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : '未知错误';
          showAlert('上传失败', message);
        } finally {
          setUploadingAvatar(false);
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误';
      showAlert('选择图片失败', message);
    }
  }, [uploadAvatar]);

  const handleEmailAuth = useCallback(async () => {
    if (!email || !password) {
      showAlert('请输入邮箱和密码');
      return;
    }

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, displayName || undefined);
        showAlert('注册成功！');
      } else {
        await signInWithEmail(email, password);
        showAlert('登录成功！');
      }
      setShowAuthForm(false);
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误';
      showAlert('错误', message);
    }
  }, [email, password, displayName, isSignUp, signUpWithEmail, signInWithEmail]);

  const handleUpdateName = useCallback(async () => {
    if (!editName.trim()) {
      showAlert('请输入名字');
      return;
    }

    try {
      await updateProfile({ displayName: editName.trim() });
      setIsEditingName(false);
      showAlert('名字已更新！');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误';
      showAlert('更新失败', message);
    }
  }, [editName, updateProfile]);

  const handleCancelAuthForm = useCallback(() => {
    setShowAuthForm(false);
    setEmail('');
    setPassword('');
    setDisplayName('');
  }, []);

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

  const handleToggleSignUp = useCallback(() => {
    setIsSignUp((prev) => !prev);
  }, []);

  const handleThemeChange = useCallback(
    (key: string) => {
      setTheme(key as ThemeKey);
    },
    [setTheme],
  );

  // ============================================
  // Render helpers
  // ============================================

  const renderAuthSection = () => {
    if (isAuthenticated) {
      return (
        <>
          <View style={styles.profileSection}>
            <AvatarSection
              isAnonymous={user?.isAnonymous ?? true}
              avatarSource={avatarSource}
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

          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>用户 ID</Text>
            <Text style={styles.accountValue}>{user?.uid.slice(0, 12)}...</Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
            <Text style={styles.logoutBtnText}>登出</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (showAuthForm) {
      return (
        <AuthForm
          isSignUp={isSignUp}
          email={email}
          password={password}
          displayName={displayName}
          authError={authError}
          authLoading={authLoading}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onDisplayNameChange={setDisplayName}
          onSubmit={handleEmailAuth}
          onToggleMode={handleToggleSignUp}
          onCancel={handleCancelAuthForm}
          styles={styles}
          colors={colors}
        />
      );
    }

    return (
      <AuthOptions
        authLoading={authLoading}
        onShowForm={handleShowAuthForm}
        onAnonymousLogin={signInAnonymously}
        styles={styles}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>设置</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 账户</Text>
          {renderAuthSection()}
        </View>

        <ThemeSelector
          currentThemeKey={themeKey}
          availableThemes={availableThemes}
          onThemeChange={handleThemeChange}
          styles={styles}
        />

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;
