import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../hooks';
import { colors } from '../../constants/theme';
import { styles } from './SettingsScreen.styles';
import { showAlert } from '../../utils/alert';
import { getDefaultAvatarUrl } from '../../utils/avatar';

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

  // Get avatar URL - use uploaded one or generate from DiceBear
  const avatarUrl = user?.avatarUrl || getDefaultAvatarUrl(user?.uid, user?.displayName || undefined);

  const handlePickAvatar = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('需要相册权限才能选择头像');
        return;
      }

      // Launch image picker
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
        } catch (e: any) {
          showAlert('上传失败', e.message);
        } finally {
          setUploadingAvatar(false);
        }
      }
    } catch (e: any) {
      showAlert('选择图片失败', e.message);
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
    } catch (e: any) {
      showAlert('错误', e.message);
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
    } catch (e: any) {
      showAlert('更新失败', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>设置</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 账户</Text>
          
          {isAuthenticated ? (
            <>
              {/* User avatar and name */}
              <View style={styles.profileSection}>
                {!user?.isAnonymous ? (
                  <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar}>
                    {uploadingAvatar ? (
                      <View style={styles.avatarPlaceholder}>
                        <ActivityIndicator color={colors.primary} />
                      </View>
                    ) : (
                      <View>
                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                        <View style={styles.avatarEditBadge}>
                          <Text style={styles.avatarEditIcon}>📷</Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                )}
                
                {/* Display name for all users */}
                {!user?.isAnonymous ? (
                  // Editable name for non-anonymous users
                  isEditingName ? (
                    <View style={styles.editNameRow}>
                      <TextInput
                        style={styles.nameInput}
                        value={editName}
                        onChangeText={setEditName}
                        placeholder="输入名字"
                        placeholderTextColor={colors.textSecondary}
                      />
                      <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateName}>
                        <Text style={styles.saveBtnText}>保存</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.cancelBtn} 
                        onPress={() => setIsEditingName(false)}
                      >
                        <Text style={styles.cancelBtnText}>取消</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.nameRow}
                      onPress={() => {
                        setEditName(user?.displayName || '');
                        setIsEditingName(true);
                      }}
                    >
                      <Text style={styles.userName}>
                        {user?.displayName || '点击设置名字'}
                      </Text>
                      <Text style={styles.editIcon}>✏️</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  // Read-only name for anonymous users
                  <Text style={styles.userName}>匿名用户</Text>
                )}
              </View>
              
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>状态</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>
                    {user?.isAnonymous ? '匿名登录' : '邮箱登录'}
                  </Text>
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
          ) : showAuthForm ? (
            // Email auth form
            <View style={styles.authForm}>
              <Text style={styles.authTitle}>{isSignUp ? '注册账号' : '邮箱登录'}</Text>
              
              <TextInput
                style={styles.input}
                placeholder="邮箱"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <TextInput
                style={styles.input}
                placeholder="密码"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              
              {isSignUp && (
                <TextInput
                  style={styles.input}
                  placeholder="昵称（可选）"
                  placeholderTextColor={colors.textSecondary}
                  value={displayName}
                  onChangeText={setDisplayName}
                />
              )}
              
              {authError && (
                <Text style={styles.errorText}>{authError}</Text>
              )}
              
              <TouchableOpacity 
                style={[styles.authBtn, authLoading && styles.authBtnDisabled]} 
                onPress={handleEmailAuth}
                disabled={authLoading}
              >
                <Text style={styles.authBtnText}>
                  {authLoading ? '处理中...' : (isSignUp ? '注册' : '登录')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.switchAuthBtn}
                onPress={() => setIsSignUp(!isSignUp)}
              >
                <Text style={styles.switchAuthText}>
                  {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelAuthBtn}
                onPress={() => {
                  setShowAuthForm(false);
                  setEmail('');
                  setPassword('');
                  setDisplayName('');
                }}
              >
                <Text style={styles.cancelAuthText}>取消</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Not logged in
            <View style={styles.authOptions}>
              <TouchableOpacity 
                style={styles.authOptionBtn}
                onPress={() => setShowAuthForm(true)}
              >
                <Text style={styles.authOptionIcon}>📧</Text>
                <Text style={styles.authOptionText}>邮箱登录/注册</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.authOptionBtn, styles.authOptionBtnSecondary]}
                onPress={signInAnonymously}
                disabled={authLoading}
              >
                <Text style={styles.authOptionIcon}>👤</Text>
                <Text style={styles.authOptionTextSecondary}>
                  {authLoading ? '处理中...' : '匿名登录'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* System Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ℹ️ 系统信息</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>后端模式</Text>
            <View style={[styles.modeBadge, styles.modeOnline]}>
              <Text style={styles.modeText}>在线模式</Text>
            </View>
          </View>
          
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
