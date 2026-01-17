import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../hooks/useAuth';
import { showAlert } from '../../utils/alert';
import { colors, spacing } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Avatar from '../../components/Avatar';
import { NumPad } from '../../components/NumPad';
import { styles } from './HomeScreen.styles';
import { homeLog } from '../../utils/logger';
import { TESTIDS } from '../../testids';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// ============================================
// Sub-components
// ============================================

interface MenuItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  testID?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, title, subtitle, onPress, testID }) => (
  <TouchableOpacity testID={testID} style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.menuIcon}>
      <Text style={styles.menuIconText}>{icon}</Text>
    </View>
    <View style={styles.menuContent}>
      <Text style={styles.menuTitle}>{title}</Text>
      {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
    </View>
    <Text style={styles.menuArrow}>›</Text>
  </TouchableOpacity>
);

interface EmailFormProps {
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
  onBack: () => void;
}

const EmailForm: React.FC<EmailFormProps> = ({
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
  onBack,
}) => {
  const getButtonText = () => {
    if (authLoading) return '处理中...';
    return isSignUp ? '注册' : '登录';
  };

  return (
    <>
      <Text style={styles.modalTitle}>{isSignUp ? '注册账号' : '邮箱登录'}</Text>

      <TextInput
        style={styles.input}
        placeholder="邮箱"
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="密码"
        placeholderTextColor={colors.textMuted}
        value={password}
        onChangeText={onPasswordChange}
        secureTextEntry
      />

      {isSignUp && (
        <TextInput
          style={styles.input}
          placeholder="昵称（可选）"
          placeholderTextColor={colors.textMuted}
          value={displayName}
          onChangeText={onDisplayNameChange}
        />
      )}

      {authError && <Text style={styles.errorText}>{authError}</Text>}

      <TouchableOpacity
        style={[styles.primaryButton, authLoading && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={authLoading}
      >
        <Text style={styles.primaryButtonText}>{getButtonText()}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={onToggleMode}>
        <Text style={styles.linkButtonText}>
          {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>返回</Text>
      </TouchableOpacity>
    </>
  );
};

interface LoginOptionsProps {
  authLoading: boolean;
  onEmailLogin: () => void;
  onAnonymousLogin: () => void;
  onCancel: () => void;
}

const LoginOptions: React.FC<LoginOptionsProps> = ({
  authLoading,
  onEmailLogin,
  onAnonymousLogin,
  onCancel,
}) => (
  <>
    <Text style={styles.modalTitle}>登录</Text>
    <Text style={styles.modalSubtitle}>选择登录方式继续</Text>

    <TouchableOpacity style={styles.primaryButton} onPress={onEmailLogin}>
      <Text style={styles.primaryButtonText}>📧 邮箱登录/注册</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.outlineButton, authLoading && styles.buttonDisabled]}
      onPress={onAnonymousLogin}
      disabled={authLoading}
      testID={TESTIDS.homeAnonLoginButton}
    >
      <Text style={styles.outlineButtonText}>{authLoading ? '处理中...' : '👤 匿名登录'}</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
      <Text style={styles.secondaryButtonText}>取消</Text>
    </TouchableOpacity>
  </>
);

interface JoinRoomModalProps {
  visible: boolean;
  roomCode: string;
  isLoading: boolean;
  errorMessage: string | null;
  onRoomCodeChange: (text: string) => void;
  onJoin: () => void;
  onCancel: () => void;
}

const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  visible,
  roomCode,
  isLoading,
  errorMessage,
  onRoomCodeChange,
  onJoin,
  onCancel,
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>加入房间</Text>
        <Text style={styles.modalSubtitle}>输入4位房间号码</Text>

        {/* Room code display */}
        <View style={styles.codeDisplay}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.codeDigitBox}>
              <Text style={styles.codeDigitText}>{roomCode[i] || ''}</Text>
            </View>
          ))}
        </View>

        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        {/* NumPad */}
        <NumPad value={roomCode} onValueChange={onRoomCodeChange} maxLength={4} disabled={isLoading} />

        <View style={styles.modalButtons}>
          <TouchableOpacity
            style={[styles.secondaryButton, { flex: 1 }, isLoading && styles.buttonDisabled]}
            onPress={onCancel}
            disabled={isLoading}
          >
            <Text style={styles.secondaryButtonText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 1 }, isLoading && styles.buttonDisabled]}
            onPress={onJoin}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>{isLoading ? '加入中...' : '加入'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ============================================
// Main Component
// ============================================

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {
    user,
    signInAnonymously,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    loading: authLoading,
    error: authError,
  } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [lastRoomNumber, setLastRoomNumber] = useState<string | null>(null);

  // Loading states for actions
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Prevent transient UI states (e.g. "创建中...") from getting stuck if we navigate away
  // and then come back via back actions (common during e2e recovery flows).
  useEffect(() => {
    const addListener = (
      navigation as unknown as { addListener?: (event: string, cb: () => void) => () => void }
    ).addListener;

    if (!addListener) {
      // Jest tests may mock navigation without addListener; don't crash.
      return;
    }

    const unsubscribe = addListener('focus', () => {
      setIsCreating(false);
      setIsJoining(false);
    });
    return unsubscribe;
  }, [navigation]);

  // Email auth form state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Load last room number
  useEffect(() => {
    AsyncStorage.getItem('lastRoomNumber').then((value) => {
      if (value) setLastRoomNumber(value);
    });
  }, []);

  // Get user display name
  const userName = useMemo(() => {
    if (!user) return '';
    // Anonymous users should show "匿名用户"
    if (user.isAnonymous) return '匿名用户';
    if (user.displayName) return user.displayName;

    // Fallback for logged-in users without displayName: use email prefix
    if (user.email) {
      return user.email.split('@')[0];
    }
    return '用户';
  }, [user]);

  const requireAuth = useCallback(
    (action: () => void) => {
      if (!user) {
        showAlert('需要登录', '请先登录后继续', [
          { text: '登录', onPress: () => setShowLoginModal(true) },
          { text: '取消', style: 'cancel' },
        ]);
        return;
      }
      action();
    },
    [user],
  );

  const handleAnonymousLogin = useCallback(async () => {
    try {
      await signInAnonymously();
      setShowLoginModal(false);
      setShowEmailForm(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      homeLog.error(' Error:', e);
      showAlert('登录失败', message || '请稍后重试');
    }
  }, [signInAnonymously]);

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
      }
      setShowLoginModal(false);
      setShowEmailForm(false);
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误';
      showAlert('错误', message);
    }
  }, [email, password, displayName, isSignUp, signUpWithEmail, signInWithEmail]);

  const resetLoginModal = useCallback(() => {
    setShowLoginModal(false);
    setShowEmailForm(false);
    setEmail('');
    setPassword('');
    setDisplayName('');
    setIsSignUp(false);
  }, []);

  const handleJoinRoom = useCallback(async () => {
    if (roomCode.length !== 4) {
      setJoinError('请输入4位房间号');
      return;
    }

    setJoinError(null);
    setIsJoining(true);

    try {
      // Set timeout for slow network
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 10000);
      });

      // Navigate with timeout protection
      await Promise.race([
        (async () => {
          await AsyncStorage.setItem('lastRoomNumber', roomCode);
          setShowJoinModal(false);
          navigation.navigate('Room', { roomNumber: roomCode, isHost: false });
          setRoomCode('');
        })(),
        timeoutPromise,
      ]);
    } catch (e) {
      if (e instanceof Error && e.message === 'timeout') {
        setJoinError('网络较慢，请重试');
      } else {
        setJoinError('加入失败，请重试');
      }
    } finally {
      setIsJoining(false);
    }
  }, [roomCode, navigation]);

  const handleReturnToLastGame = useCallback(() => {
    if (!lastRoomNumber) {
      showAlert('提示', '没有上局游戏记录');
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
    // Navigation happens immediately, HomeScreen will blur/unmount
    navigation.navigate('Config');
    // No need to reset - component will unmount or blur
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} testID={TESTIDS.homeScreenRoot}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🐺</Text>
          <Text style={styles.title}>狼人杀法官</Text>
          <Text style={styles.subtitle}>Werewolf Judge</Text>
        </View>

        {/* User Bar */}
        <TouchableOpacity
          style={styles.userBar}
          testID={TESTIDS.homeUserBar}
          onPress={() => {
            if (user) {
              // Show user menu with logout option
              showAlert(userName, user.isAnonymous ? '匿名登录用户' : user.email || '已登录', [
                {
                  text: '退出登录',
                  style: 'destructive',
                  onPress: () => {
                    signOut();
                  },
                },
                { text: '取消', style: 'cancel' },
              ]);
            } else {
              setShowLoginModal(true);
            }
          }}
          activeOpacity={0.8}
        >
          {!user && (
            <>
              <Text style={styles.userAvatar}>👤</Text>
              <Text style={styles.userNameText} testID={TESTIDS.homeLoginButton}>
                点击登录
              </Text>
            </>
          )}
          {user && user.isAnonymous && (
            <>
              <Text style={styles.userAvatar}>👤</Text>
              <Text style={styles.userNameText} testID={TESTIDS.homeUserName}>
                {userName}
              </Text>
            </>
          )}
          {user && !user.isAnonymous && (
            <>
              <Avatar value={user.uid} size={36} avatarUrl={user.avatarUrl} />
              <Text style={styles.userNameText} testID={TESTIDS.homeUserName}>
                {userName}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Menu */}
        <View style={styles.menu}>
          <MenuItem
            icon="🚪"
            title={isJoining ? '进入中...' : '进入房间'}
            subtitle="输入房间号进入游戏"
            onPress={() => requireAuth(() => setShowJoinModal(true))}
            testID={TESTIDS.homeEnterRoomButton}
          />
          <MenuItem
            icon="➕"
            title={isCreating ? '创建中...' : '创建房间'}
            subtitle="开始新的一局游戏"
            onPress={() => requireAuth(handleCreateRoom)}
            testID={TESTIDS.homeCreateRoomButton}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="↩️"
            title="返回上局"
            subtitle={lastRoomNumber ? `房间 ${lastRoomNumber}` : '没有上局记录'}
            onPress={() => requireAuth(handleReturnToLastGame)}
            testID={TESTIDS.homeReturnLastGameButton}
          />
          <MenuItem
            icon="⚙️"
            title="设置"
            subtitle="应用偏好设置"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Login Modal */}
      <Modal visible={showLoginModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {showEmailForm ? (
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
                onToggleMode={() => setIsSignUp(!isSignUp)}
                onBack={() => setShowEmailForm(false)}
              />
            ) : (
              <LoginOptions
                authLoading={authLoading}
                onEmailLogin={() => setShowEmailForm(true)}
                onAnonymousLogin={handleAnonymousLogin}
                onCancel={resetLoginModal}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Join Room Modal */}
      <JoinRoomModal
        visible={showJoinModal}
        roomCode={roomCode}
        isLoading={isJoining}
        errorMessage={joinError}
        onRoomCodeChange={setRoomCode}
        onJoin={handleJoinRoom}
        onCancel={handleCancelJoin}
      />
    </SafeAreaView>
  );
};

export default HomeScreen;
