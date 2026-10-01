/**
 * AdminScreen — Admin portal dashboard
 *
 * JWT identity check on entry → 7-tab dashboard (users/rooms/stats/analytics/requests/AI/games).
 * Access is granted by the worker when the caller is an admin (users.is_admin)
 * or a super admin (ADMIN_USER_IDS allowlist). No standalone admin password.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type React from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/PressableScale';
import { AdminApiError, getAdminWhoAmI } from '@/features/admin/services/adminApi';
import { borderRadius, colors, componentSizes, spacing, typography } from '@/theme';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

import { AITab } from './tabs/AITab';
import { AnalyticsTab } from './tabs/AnalyticsTab';
import { GamesTab } from './tabs/GamesTab';
import { RequestTrafficTab } from './tabs/RequestTrafficTab';
import { RoomsTab } from './tabs/RoomsTab';
import { StatsTab } from './tabs/StatsTab';
import { UsersTab } from './tabs/UsersTab';

type TabId = 'users' | 'rooms' | 'stats' | 'analytics' | 'requests' | 'ai' | 'games';

const TABS: Array<{ id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'users', label: '用户', icon: 'people-outline' },
  { id: 'rooms', label: '房间', icon: 'home-outline' },
  { id: 'stats', label: '统计', icon: 'bar-chart-outline' },
  { id: 'analytics', label: '性能', icon: 'speedometer-outline' },
  { id: 'requests', label: '请求', icon: 'pulse-outline' },
  { id: 'ai', label: 'AI', icon: 'sparkles-outline' },
  { id: 'games', label: '游戏', icon: 'game-controller-outline' },
];
const adminScreenLog = log.extend('AdminScreen');

type GateState = 'checking' | 'allowed' | 'login-required' | 'forbidden' | 'error';

/** Admin portal screen. */
export const AdminScreen: React.FC = () => {
  const navigation = useNavigation();
  const [gate, setGate] = useState<GateState>('checking');
  const [activeTab, setActiveTab] = useState<TabId>('users');

  const checkAccess = useCallback(async () => {
    setGate('checking');
    try {
      await getAdminWhoAmI();
      setGate('allowed');
    } catch (cause: unknown) {
      if (cause instanceof AdminApiError && cause.status === 401) {
        setGate('login-required');
        return;
      }
      if (cause instanceof AdminApiError && cause.status === 403) {
        setGate('forbidden');
        return;
      }
      handleError(cause, {
        label: '验证管理员身份',
        logger: adminScreenLog,
        feedback: false,
      });
      setGate('error');
    }
  }, []);

  // Re-check whenever the screen gains focus (e.g. back from the login screen).
  useFocusEffect(
    useCallback(() => {
      void checkAccess();
    }, [checkAccess]),
  );

  if (gate === 'checking') {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (gate !== 'allowed') {
    const copy =
      gate === 'login-required'
        ? { title: '需要登录', message: '请先登录后再进入 Admin Portal' }
        : gate === 'forbidden'
          ? { title: '无管理员权限', message: '当前账号没有管理员权限' }
          : { title: '验证失败', message: '网络错误，请重试' };
    return (
      <SafeAreaView style={styles.centered}>
        <View style={styles.gateCard}>
          <Ionicons name="lock-closed" size={componentSizes.icon.xl} color={colors.primary} />
          <Text style={styles.gateTitle}>{copy.title}</Text>
          <Text style={styles.gateMessage}>{copy.message}</Text>
          {gate === 'login-required' ? (
            <PressableScale
              style={styles.primaryBtn}
              onPress={() =>
                navigation.navigate('AuthLogin', {
                  loginTitle: '管理员登录',
                  loginSubtitle: '登录后进入 Admin Portal',
                })
              }
              haptic
            >
              <Text style={styles.primaryBtnText}>去登录</Text>
            </PressableScale>
          ) : (
            <PressableScale style={styles.primaryBtn} onPress={() => void checkAccess()} haptic>
              <Text style={styles.primaryBtnText}>重试</Text>
            </PressableScale>
          )}
          <PressableScale onPress={() => navigation.goBack()} haptic>
            <Text style={styles.backLink}>返回</Text>
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
        {activeTab === 'requests' && <RequestTrafficTab />}
        {activeTab === 'ai' && <AITab />}
        {activeTab === 'games' && <GamesTab />}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  gateCard: {
    alignItems: 'center',
    padding: spacing.xlarge,
    gap: spacing.medium,
  },
  gateTitle: {
    fontSize: typography.title,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  gateMessage: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xlarge,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.medium,
  },
  primaryBtnText: {
    color: colors.textInverse,
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
  },
  backLink: {
    color: colors.primary,
    fontSize: typography.body,
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
