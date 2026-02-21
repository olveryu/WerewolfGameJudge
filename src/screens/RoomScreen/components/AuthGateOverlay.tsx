/**
 * AuthGateOverlay — 首次通过直连 URL 进入房间时的登录选择界面
 *
 * 自包含 useAuth + useAuthForm hooks。仅当 needsAuth=true 时由 RoomScreen 渲染，
 * hooks 只在挂载时执行，因此不需要所有 RoomScreen 测试都 mock AuthContext。
 * 复用 HomeScreen 的 AuthStyles + LoginOptions/EmailForm 共享组件。
 * 不含游戏业务逻辑，不 import service 层。
 */
import React, { useCallback, useState } from 'react';
import { useMemo } from 'react';
import { View } from 'react-native';

import { EmailForm, LoginOptions } from '@/components/auth';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useAuthForm } from '@/hooks/useAuthForm';
import { createHomeScreenStyles } from '@/screens/HomeScreen/components';
import { useColors } from '@/theme';
import { roomScreenLog } from '@/utils/logger';

interface AuthGateOverlayProps {
  /** Called after successful login (anonymous or email) */
  onSuccess: () => void;
  /** Called when user cancels — typically navigate Home */
  onCancel: () => void;
}

export const AuthGateOverlay: React.FC<AuthGateOverlayProps> = ({ onSuccess, onCancel }) => {
  const colors = useColors();
  const styles = useMemo(() => createHomeScreenStyles(colors), [colors]);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const { loading: authLoading, error: authError } = useAuth();

  const handleAuthSuccess = useCallback(() => {
    setShowEmailForm(false);
    onSuccess();
  }, [onSuccess]);

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
    toggleSignUp,
  } = useAuthForm({ onSuccess: handleAuthSuccess, logger: roomScreenLog });

  return (
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
            onToggleMode={toggleSignUp}
            onBack={() => setShowEmailForm(false)}
            styles={styles}
            colors={colors}
          />
        ) : (
          <LoginOptions
            authLoading={authLoading}
            title="需要登录"
            subtitle="请选择登录方式以加入房间"
            onEmailLogin={() => setShowEmailForm(true)}
            onAnonymousLogin={handleAnonymousLogin}
            onCancel={onCancel}
            styles={styles}
          />
        )}
      </View>
    </View>
  );
};
