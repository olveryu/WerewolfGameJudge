import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  ImageSourcePropType,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../hooks';
import { useTheme, spacing, borderRadius, typography, shadows, ThemeColors } from '../../theme';
import { showAlert } from '../../utils/alert';
import { getAvatarImage } from '../../utils/avatar';

// ============================================
// Styles factory
// ============================================
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.medium,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backBtnText: {
      fontSize: 20,
      color: colors.text,
    },
    title: {
      flex: 1,
      fontSize: typography.subtitle,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    placeholder: {
      width: 40,
    },
    scrollView: {
      flex: 1,
      padding: spacing.medium,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.medium,
      marginBottom: spacing.medium,
      ...shadows.sm,
    },
    cardTitle: {
      fontSize: typography.body,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.medium,
    },
    accountRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    accountLabel: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
    },
    accountValue: {
      fontSize: typography.secondary,
      color: colors.text,
      fontFamily: 'monospace',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.success + '20',
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.full,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
      marginRight: spacing.tight,
    },
    statusText: {
      fontSize: typography.caption,
      color: colors.success,
    },
    logoutBtn: {
      marginTop: spacing.medium,
      padding: spacing.medium,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      alignItems: 'center',
    },
    logoutBtnText: {
      fontSize: typography.secondary,
      color: colors.error,
      fontWeight: '500',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    infoLabel: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
    },
    infoValue: {
      fontSize: typography.secondary,
      color: colors.text,
    },
    // Profile section
    profileSection: {
      alignItems: 'center',
      paddingVertical: spacing.medium,
      marginBottom: spacing.medium,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 12,
      marginBottom: spacing.small,
      overflow: 'hidden',
    },
    avatarPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.small,
    },
    avatarPlaceholderIcon: {
      fontSize: 40,
    },
    avatarEditBadge: {
      position: 'absolute',
      bottom: spacing.small,
      right: 0,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    avatarEditIcon: {
      fontSize: 12,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    userName: {
      fontSize: typography.subtitle,
      fontWeight: '600',
      color: colors.text,
    },
    editIcon: {
      fontSize: 14,
    },
    editNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    nameInput: {
      flex: 1,
      height: 40,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.small,
      fontSize: typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderRadius: borderRadius.medium,
    },
    saveBtnText: {
      color: colors.textInverse,
      fontSize: typography.secondary,
      fontWeight: '500',
    },
    cancelBtn: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.small,
    },
    cancelBtnText: {
      color: colors.textSecondary,
      fontSize: typography.secondary,
    },
    // Auth form
    authForm: {
      paddingVertical: spacing.medium,
    },
    authTitle: {
      fontSize: typography.subtitle,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.large,
    },
    input: {
      height: 48,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.medium,
      fontSize: typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.medium,
    },
    errorText: {
      color: colors.error,
      fontSize: typography.secondary,
      textAlign: 'center',
      marginBottom: spacing.medium,
    },
    authBtn: {
      backgroundColor: colors.primary,
      height: 48,
      borderRadius: borderRadius.medium,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.medium,
    },
    authBtnDisabled: {
      opacity: 0.6,
    },
    authBtnText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: '600',
    },
    switchAuthBtn: {
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    switchAuthText: {
      color: colors.primary,
      fontSize: typography.secondary,
    },
    cancelAuthBtn: {
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    cancelAuthText: {
      color: colors.textSecondary,
      fontSize: typography.secondary,
    },
    // Auth options
    authOptions: {
      gap: spacing.medium,
      paddingVertical: spacing.medium,
    },
    authOptionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      height: 48,
      borderRadius: borderRadius.medium,
      gap: spacing.small,
    },
    authOptionBtnSecondary: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    authOptionIcon: {
      fontSize: 20,
    },
    authOptionText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: '500',
    },
    authOptionTextSecondary: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '500',
    },
    // Theme section
    themeSection: {
      paddingVertical: spacing.small,
    },
    themeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    themeLabel: {
      fontSize: typography.body,
      color: colors.text,
    },
    themeValue: {
      fontSize: typography.secondary,
      color: colors.primary,
      fontWeight: '500',
    },
    themeOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
      marginTop: spacing.small,
    },
    themeOption: {
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    themeOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '20',
    },
    themeOptionText: {
      fontSize: typography.secondary,
      color: colors.text,
    },
    themeOptionTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
  });

// ============================================
// Sub-components
// ============================================

interface AvatarSectionProps {
  isAnonymous: boolean;
  avatarSource: ImageSourcePropType;
  uploadingAvatar: boolean;
  onPickAvatar: () => void;
  colors: ThemeColors;
}

const AvatarSection: React.FC<AvatarSectionProps> = ({
  isAnonymous,
  avatarSource,
  uploadingAvatar,
  onPickAvatar,
  colors,
}) => {
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isAnonymous) {
    return (
      <View style={styles.avatarPlaceholder}>
        <Text style={styles.avatarPlaceholderIcon}>👤</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={onPickAvatar} disabled={uploadingAvatar}>
      {uploadingAvatar ? (
        <View style={styles.avatarPlaceholder}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View>
          <Image source={avatarSource} style={styles.avatar} resizeMode="cover" />
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditIcon}>📷</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

interface NameSectionProps {
  isAnonymous: boolean;
  displayName: string | null;
  isEditingName: boolean;
  editName: string;
  onEditNameChange: (text: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  colors: ThemeColors;
}

const NameSection: React.FC<NameSectionProps> = ({
  isAnonymous,
  displayName,
  isEditingName,
  editName,
  onEditNameChange,
  onStartEdit,
  onSave,
  onCancel,
  colors,
}) => {
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isAnonymous) {
    return <Text style={styles.userName}>匿名用户</Text>;
  }

  if (isEditingName) {
    return (
      <View style={styles.editNameRow}>
        <TextInput
          style={styles.nameInput}
          value={editName}
          onChangeText={onEditNameChange}
          placeholder="输入名字"
          placeholderTextColor={colors.textSecondary}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
          <Text style={styles.saveBtnText}>保存</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>取消</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.nameRow} onPress={onStartEdit}>
      <Text style={styles.userName}>{displayName || '点击设置名字'}</Text>
      <Text style={styles.editIcon}>✏️</Text>
    </TouchableOpacity>
  );
};

interface AuthFormProps {
  isSignUp: boolean;
  email: string;
  password: string;
  displayName: string;
  authError: string | null;
  authLoading: boolean;
  onEmailChange: (text: string) => void;
  onPasswordChange: (text: string) => void;
  onDisplayNameChange: (text: string) => void;
  onSubmit: () => void;
  onToggleMode: () => void;
  onCancel: () => void;
  colors: ThemeColors;
}

const AuthForm: React.FC<AuthFormProps> = ({
  isSignUp,
  email,
  password,
  displayName,
  authError,
  authLoading,
  onEmailChange,
  onPasswordChange,
  onDisplayNameChange,
  onSubmit,
  onToggleMode,
  onCancel,
  colors,
}) => {
  const styles = useMemo(() => createStyles(colors), [colors]);

  const getButtonText = () => {
    if (authLoading) return '处理中...';
    return isSignUp ? '注册' : '登录';
  };

  return (
    <View style={styles.authForm}>
      <Text style={styles.authTitle}>{isSignUp ? '注册账号' : '邮箱登录'}</Text>

      <TextInput
        style={styles.input}
        placeholder="邮箱"
        placeholderTextColor={colors.textSecondary}
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="密码"
        placeholderTextColor={colors.textSecondary}
        value={password}
        onChangeText={onPasswordChange}
        secureTextEntry
      />

      {isSignUp && (
        <TextInput
          style={styles.input}
          placeholder="昵称（可选）"
          placeholderTextColor={colors.textSecondary}
          value={displayName}
          onChangeText={onDisplayNameChange}
        />
      )}

      {authError && <Text style={styles.errorText}>{authError}</Text>}

      <TouchableOpacity
        style={[styles.authBtn, authLoading && styles.authBtnDisabled]}
        onPress={onSubmit}
        disabled={authLoading}
      >
        <Text style={styles.authBtnText}>{getButtonText()}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.switchAuthBtn} onPress={onToggleMode}>
        <Text style={styles.switchAuthText}>
          {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelAuthBtn} onPress={onCancel}>
        <Text style={styles.cancelAuthText}>取消</Text>
      </TouchableOpacity>
    </View>
  );
};

interface AuthOptionsProps {
  authLoading: boolean;
  onShowForm: () => void;
  onAnonymousLogin: () => void;
  colors: ThemeColors;
}

const AuthOptions: React.FC<AuthOptionsProps> = ({
  authLoading,
  onShowForm,
  onAnonymousLogin,
  colors,
}) => {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.authOptions}>
      <TouchableOpacity style={styles.authOptionBtn} onPress={onShowForm}>
        <Text style={styles.authOptionIcon}>📧</Text>
        <Text style={styles.authOptionText}>邮箱登录/注册</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.authOptionBtn, styles.authOptionBtnSecondary]}
        onPress={onAnonymousLogin}
        disabled={authLoading}
      >
        <Text style={styles.authOptionIcon}>👤</Text>
        <Text style={styles.authOptionTextSecondary}>{authLoading ? '处理中...' : '匿名登录'}</Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================
// Main Component
// ============================================

const SettingsScreen: React.FC = () => {
  const { colors, themeKey, setTheme, availableThemes } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const getAvatarSource = () => {
    if (user?.isAnonymous) {
      // Anonymous users show emoji avatar in AvatarSection, this won't be used
      return getAvatarImage('anonymous');
    }
    if (user?.avatarUrl) {
      return { uri: user.avatarUrl };
    }
    return getAvatarImage(user?.uid || user?.displayName || 'anonymous');
  };
  const avatarSource = getAvatarSource();

  const handlePickAvatar = async () => {
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
  };

  const handleEmailAuth = async () => {
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
  };

  const handleUpdateName = async () => {
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
  };

  const handleCancelAuthForm = () => {
    setShowAuthForm(false);
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  const handleStartEditName = () => {
    setEditName(user?.displayName || '');
    setIsEditingName(true);
  };

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
              onCancel={() => setIsEditingName(false)}
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
          onToggleMode={() => setIsSignUp(!isSignUp)}
          onCancel={handleCancelAuthForm}
          colors={colors}
        />
      );
    }

    return (
      <AuthOptions
        authLoading={authLoading}
        onShowForm={() => setShowAuthForm(true)}
        onAnonymousLogin={signInAnonymously}
        colors={colors}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>设置</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 账户</Text>
          {renderAuthSection()}
        </View>

        {/* Theme selector */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>主题</Text>
          <View style={styles.themeOptions}>
            {availableThemes.map((theme) => (
              <TouchableOpacity
                key={theme.key}
                style={[styles.themeOption, themeKey === theme.key && styles.themeOptionActive]}
                onPress={() => setTheme(theme.key)}
              >
                <Text
                  style={[
                    styles.themeOptionText,
                    themeKey === theme.key && styles.themeOptionTextActive,
                  ]}
                >
                  {theme.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;
