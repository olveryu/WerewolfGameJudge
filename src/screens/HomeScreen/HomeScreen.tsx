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
import { styles } from './HomeScreen.styles';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface MenuItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, title, subtitle, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
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

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, signInAnonymously, signUpWithEmail, signInWithEmail, signOut, loading: authLoading, error: authError } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [lastRoomNumber, setLastRoomNumber] = useState<string | null>(null);
  
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
  
  // Get user display name - use registered name if available, otherwise generate one
  const userName = useMemo(() => {
    if (user) {
      // Use the registered display name if available
      if (user.displayName) {
        return user.displayName;
      }
      // Fallback: generate a random name based on user ID
      const adjectives = ['快乐', '勇敢', '聪明', '神秘', '可爱', '酷炫', '狡猾', '正义'];
      const nouns = ['小狼', '村民', '猎人', '女巫', '守卫', '预言家', '骑士', '法官'];
      const hash = user.uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const idx = hash % adjectives.length;
      const idx2 = (hash + 3) % nouns.length;
      return adjectives[idx] + nouns[idx2];
    }
    return '';
  }, [user]);

  const requireAuth = useCallback((action: () => void) => {
    if (!user) {
      showAlert('需要登录', '请先登录后继续', [
        { text: '取消', style: 'cancel' },
        { text: '登录', onPress: () => setShowLoginModal(true) },
      ]);
      return;
    }
    action();
  }, [user]);

  const handleLogin = useCallback(async () => {
    try {
      await signInAnonymously();
      setShowLoginModal(false);
      setShowEmailForm(false);
    } catch {
      showAlert('登录失败', '请稍后重试');
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
    } catch (e: any) {
      showAlert('错误', e.message);
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

  const handleJoinRoom = useCallback(() => {
    if (roomCode.length !== 4) {
      showAlert('错误', '请输入4位房间号');
      return;
    }
    setShowJoinModal(false);
    // Save as last room
    AsyncStorage.setItem('lastRoomNumber', roomCode);
    navigation.navigate('Room', { roomNumber: roomCode, isHost: false });
    setRoomCode('');
  }, [roomCode, navigation]);

  const handleReturnToLastGame = useCallback(() => {
    if (!lastRoomNumber) {
      showAlert('提示', '没有上局游戏记录');
      return;
    }
    navigation.navigate('Room', { roomNumber: lastRoomNumber, isHost: false });
  }, [lastRoomNumber, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🐺</Text>
          <Text style={styles.title}>狼人杀法官</Text>
          <Text style={styles.subtitle}>Werewolf Judge</Text>
        </View>

        {/* User Bar - shows login status or user info */}
        <TouchableOpacity
          style={styles.userBar}
          onPress={user ? () => signOut() : () => setShowLoginModal(true)}
          activeOpacity={0.8}
        >
          {user ? (
            <>
              <Avatar value={user.uid} size={36} avatarUrl={user.avatarUrl} />
              <Text style={styles.userNameText}>{userName}</Text>
            </>
          ) : (
            <>
              <Text style={styles.userAvatar}>👤</Text>
              <Text style={styles.userNameText}>点击登录</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Menu */}
        <View style={styles.menu}>
          <MenuItem
            icon="🚪"
            title="进入房间"
            subtitle="输入房间号进入游戏"
            onPress={() => requireAuth(() => setShowJoinModal(true))}
          />
          <MenuItem
            icon="➕"
            title="创建房间"
            subtitle="开始新的一局游戏"
            onPress={() => requireAuth(() => navigation.navigate('Config'))}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="↩️"
            title="返回上局"
            subtitle={lastRoomNumber ? `房间 ${lastRoomNumber}` : '没有上局记录'}
            onPress={() => requireAuth(handleReturnToLastGame)}
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
              // Email login/register form
              <>
                <Text style={styles.modalTitle}>{isSignUp ? '注册账号' : '邮箱登录'}</Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="邮箱"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                
                <TextInput
                  style={styles.input}
                  placeholder="密码"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                
                {isSignUp && (
                  <TextInput
                    style={styles.input}
                    placeholder="昵称（可选）"
                    placeholderTextColor={colors.textMuted}
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                )}
                
                {authError && (
                  <Text style={styles.errorText}>{authError}</Text>
                )}
                
                <TouchableOpacity 
                  style={[styles.primaryButton, authLoading && styles.buttonDisabled]} 
                  onPress={handleEmailAuth}
                  disabled={authLoading}
                >
                  <Text style={styles.primaryButtonText}>
                    {authLoading ? '处理中...' : (isSignUp ? '注册' : '登录')}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.linkButton}
                  onPress={() => setIsSignUp(!isSignUp)}
                >
                  <Text style={styles.linkButtonText}>
                    {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setShowEmailForm(false)}
                >
                  <Text style={styles.secondaryButtonText}>返回</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Login method selection
              <>
                <Text style={styles.modalTitle}>登录</Text>
                <Text style={styles.modalSubtitle}>选择登录方式继续</Text>
                
                <TouchableOpacity 
                  style={styles.primaryButton} 
                  onPress={() => setShowEmailForm(true)}
                >
                  <Text style={styles.primaryButtonText}>📧 邮箱登录/注册</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.outlineButton, authLoading && styles.buttonDisabled]} 
                  onPress={handleLogin}
                  disabled={authLoading}
                >
                  <Text style={styles.outlineButtonText}>
                    {authLoading ? '处理中...' : '👤 匿名登录'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={resetLoginModal}
                >
                  <Text style={styles.secondaryButtonText}>取消</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Join Room Modal */}
      <Modal visible={showJoinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>加入房间</Text>
            <Text style={styles.modalSubtitle}>输入4位房间号码</Text>
            
            <TextInput
              style={styles.codeInput}
              value={roomCode}
              onChangeText={setRoomCode}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={() => { setShowJoinModal(false); setRoomCode(''); }}
              >
                <Text style={styles.secondaryButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }]}
                onPress={handleJoinRoom}
              >
                <Text style={styles.primaryButtonText}>加入</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default HomeScreen;
