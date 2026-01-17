import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../hooks';
import { colors } from '../../constants/theme';
import { styles } from './SettingsScreen.styles';
import { showAlert } from '../../utils/alert';
import { getAvatarImage } from '../../utils/avatar';

// ============================================
// Sub-components to reduce cognitive complexity
// ============================================

interface AvatarSectionProps {
  isAnonymous: boolean;
  avatarSource: ImageSourcePropType;
  uploadingAvatar: boolean;
  onPickAvatar: () => void;
}

const AvatarSection: React.FC<AvatarSectionProps> = ({
  isAnonymous,
  avatarSource,
  uploadingAvatar,
  onPickAvatar,
}) => {
  if (isAnonymous) {
    return <Image source={avatarSource} style={styles.avatar} />;
  }

  return (
    <TouchableOpacity onPress={onPickAvatar} disabled={uploadingAvatar}>
      {uploadingAvatar ? (
        <View style={styles.avatarPlaceholder}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View>
          <Image source={avatarSource} style={styles.avatar} />
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
}) => {
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
}) => {
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
}

const AuthOptions: React.FC<AuthOptionsProps> = ({ authLoading, onShowForm, onAnonymousLogin }) => (
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

// ============================================
// Main Component
// ============================================

const SettingsScreen: React.FC = () => {
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

  // Reset transient states when screen regains focus (e.g. after back navigation)
  useEffect(() => {
    const addListener = (
      navigation as unknown as { addListener?: (event: string, cb: () => void) => () => void }
    ).addListener;

    if (!addListener) {
      // Jest tests may mock navigation without addListener; don't crash.
      return;
    }

    const unsubscribe = addListener('focus', () => {
      setUploadingAvatar(false);
      setIsEditingName(false);
    });
    return unsubscribe;
  }, [navigation]);

  // Get avatar source - anonymous users get default, logged-in users get their avatar
  const getAvatarSource = () => {
    // Anonymous users get default app icon
    if (user?.isAnonymous) {
      return require('../../../assets/icon.png');
    }
    // Logged-in users with custom avatar
    if (user?.avatarUrl) {
      return { uri: user.avatarUrl };
    }
    // Logged-in users without avatar - generate based on uid
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
        />
      );
    }

    return (
      <AuthOptions
        authLoading={authLoading}
        onShowForm={() => setShowAuthForm(true)}
        onAnonymousLogin={signInAnonymously}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>ℹ️ 系统信息</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>版本</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;
