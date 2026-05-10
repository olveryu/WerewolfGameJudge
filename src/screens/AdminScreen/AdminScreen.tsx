/**
 * AdminScreen — Admin portal 管理面板
 *
 * 密码验证 → 5-tab 仪表盘（用户/房间/统计/性能/AI）。
 * 密码缓存在 MMKV，下次进入自动校验。
 * 不走 JWT auth，使用独立 X-Admin-Token 鉴权。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/PressableScale';
import { ADMIN_PASSWORD_KEY } from '@/config/storageKeys';
import { storage } from '@/lib/storage';
import { borderRadius, colors, componentSizes, spacing, typography } from '@/theme';

import { verifyAdminPassword } from './adminApi';
import { AITab } from './tabs/AITab';
import { AnalyticsTab } from './tabs/AnalyticsTab';
import { RoomsTab } from './tabs/RoomsTab';
import { StatsTab } from './tabs/StatsTab';
import { UsersTab } from './tabs/UsersTab';

type TabId = 'users' | 'rooms' | 'stats' | 'analytics' | 'ai';

const TABS: Array<{ id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'users', label: '用户', icon: 'people-outline' },
  { id: 'rooms', label: '房间', icon: 'home-outline' },
  { id: 'stats', label: '统计', icon: 'bar-chart-outline' },
  { id: 'analytics', label: '性能', icon: 'speedometer-outline' },
  { id: 'ai', label: 'AI', icon: 'sparkles-outline' },
];

export const AdminScreen: React.FC = () => {
  const navigation = useNavigation();
  const [authenticated, setAuthenticated] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('users');

  // On mount, check if cached password is still valid
  useEffect(() => {
    const cached = storage.getString(ADMIN_PASSWORD_KEY);
    if (!cached) {
      setVerifying(false);
      return;
    }
    void verifyAdminPassword(cached)
      .then((valid) => {
        if (valid) {
          setAuthenticated(true);
        } else {
          storage.remove(ADMIN_PASSWORD_KEY);
        }
      })
      .catch(() => {
        storage.remove(ADMIN_PASSWORD_KEY);
      })
      .finally(() => {
        setVerifying(false);
      });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!password.trim()) return;
    setError(null);
    setVerifying(true);
    try {
      const valid = await verifyAdminPassword(password.trim());
      if (valid) {
        storage.set(ADMIN_PASSWORD_KEY, password.trim());
        setAuthenticated(true);
      } else {
        setError('密码错误');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setVerifying(false);
    }
  }, [password]);

  if (verifying) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!authenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authCard}>
          <Ionicons name="lock-closed" size={componentSizes.icon.xl} color={colors.primary} />
          <Text style={styles.authTitle}>Admin 验证</Text>
          <TextInput
            style={styles.input}
            placeholder="输入管理密码"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => void handleSubmit()}
            autoFocus
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PressableScale style={styles.submitBtn} onPress={() => void handleSubmit()} haptic>
            <Text style={styles.submitBtnText}>确认进入</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => navigation.goBack()} haptic>
          <Ionicons name="arrow-back" size={componentSizes.icon.md} color={colors.text} />
        </PressableScale>
        <Text style={styles.headerTitle}>Admin Portal</Text>
        <View style={{ width: componentSizes.icon.md }} />
      </View>

      {/* Tab bar — underline indicator style */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <PressableScale
              key={tab.id}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              {isActive && <View style={styles.tabIndicator} />}
            </PressableScale>
          );
        })}
      </View>

      {/* Tab content */}
      <View style={styles.content}>
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'rooms' && <RoomsTab />}
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'ai' && <AITab />}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  authCard: {
    alignItems: 'center',
    padding: spacing.xlarge,
    gap: spacing.medium,
  },
  authTitle: {
    fontSize: typography.title,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  input: {
    width: '100%',
    maxWidth: 300,
    height: 48,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.medium,
    fontSize: typography.body,
    color: colors.text,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.caption,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xlarge,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.medium,
  },
  submitBtnText: {
    color: colors.textInverse,
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
  },
  headerTitle: {
    fontSize: typography.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.small,
    gap: spacing.micro,
  },
  tabLabel: {
    fontSize: typography.caption,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: spacing.small,
    right: spacing.small,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  content: {
    flex: 1,
  },
});
