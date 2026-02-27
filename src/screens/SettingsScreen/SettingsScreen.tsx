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
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmailForm, LoginOptions } from '@/components/auth';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useAuthForm } from '@/hooks/useAuthForm';
import { RootStackParamList } from '@/navigation/types';
import { ThemeKey, typography, useTheme } from '@/theme';
import { showAlert } from '@/utils/alert';
import { getAvatarImage } from '@/utils/avatar';
import { getErrorMessage } from '@/utils/errorUtils';
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

  // Auth form state
  const [showAuthForm, setShowAuthForm] = useState(false);

  const handleAuthSuccess = useCallback(() => {
    setShowAuthForm(false);
  }, []);

  const {
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    isSignUp,
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
          await uploadAvatar(result.assets[0].uri);
          showAlert('头像已更新！');
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
  }, [uploadAvatar]);

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
      // AuthContext already reported to Sentry before re-throwing; avoid double-reporting
      const message = getErrorMessage(e);
      settingsLog.error('Update name failed:', message, e);
      showAlert('更新失败', message);
    }
  }, [editName, updateProfile]);

  const handleCancelAuthForm = useCallback(() => {
    setShowAuthForm(false);
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

          <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
            <Text style={styles.logoutBtnText}>登出</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (showAuthForm) {
      return (
        <EmailForm
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
          onToggleMode={toggleSignUp}
          onBack={handleCancelAuthForm}
          styles={styles}
          colors={colors}
        />
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
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>设置</Text>
        <View style={styles.placeholder} />
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
