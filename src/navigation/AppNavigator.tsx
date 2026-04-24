/**
 * AppNavigator - Root navigation stack for the app
 *
 * 注册所有 Screen（Home / Config / Room / Settings）并配置导航栏。
 * 通过 `linking` 配置实现 URL ↔ 导航状态双向同步（Web 刷新恢复页面）。
 * 涵盖导航栋定义、Screen 注册、header 样式配置、linking 路由映射。
 * 不包含业务逻辑，不直接调用 service。
 *
 * Web: 非首屏 screen 使用 React.lazy code splitting，减少主 bundle 体积。
 * Skia WASM 和所有 lazy screen 在首屏渲染后 requestIdleCallback 预加载。
 */
import {
  getPathFromState as defaultGetPathFromState,
  getStateFromPath as defaultGetStateFromPath,
  LinkingOptions,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { lazy, Suspense, useEffect } from 'react';
import { Platform } from 'react-native';

import { LoadingScreen } from '@/components/LoadingScreen/LoadingScreen';
import { SITE_URL } from '@/config/api';
import { reactNavigationIntegration } from '@/lib/sentryIntegrations';
import { HomeScreen } from '@/screens/HomeScreen/HomeScreen';
import { colors } from '@/theme';
import { log } from '@/utils/logger';

import { navigationRef } from './navigationRef';
import { RootStackParamList } from './types';

// ── Route-based code splitting (React Navigation recommended pattern for Web) ──
// React.lazy must be defined outside the component to avoid remounting on re-render.
// @see https://reactnavigation.org/docs/web-support
//
// Named exports → default export adapter via .then(m => ({ default: m.X }))
const BoardPickerScreen = lazy(() =>
  import('@/screens/BoardPickerScreen/BoardPickerScreen').then((m) => ({
    default: m.BoardPickerScreen,
  })),
);
const ConfigScreen = lazy(() =>
  import('@/screens/ConfigScreen/ConfigScreen').then((m) => ({ default: m.ConfigScreen })),
);
const RoomScreen = lazy(() =>
  import('@/screens/RoomScreen/RoomScreen').then((m) => ({ default: m.RoomScreen })),
);
const SettingsScreen = lazy(() =>
  import('@/screens/SettingsScreen/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);
const AnimationSettingsScreen = lazy(() =>
  import('@/screens/AnimationSettingsScreen/AnimationSettingsScreen').then((m) => ({
    default: m.AnimationSettingsScreen,
  })),
);
const MusicSettingsScreen = lazy(() =>
  import('@/screens/MusicSettingsScreen/MusicSettingsScreen').then((m) => ({
    default: m.MusicSettingsScreen,
  })),
);
const EncyclopediaScreen = lazy(() =>
  import('@/screens/EncyclopediaScreen/EncyclopediaScreen').then((m) => ({
    default: m.EncyclopediaScreen,
  })),
);
const NotepadScreen = lazy(() =>
  import('@/screens/NotepadScreen/NotepadScreen').then((m) => ({ default: m.NotepadScreen })),
);
const AvatarPickerScreen = lazy(() =>
  import('@/screens/AvatarPickerScreen/AvatarPickerScreen').then((m) => ({
    default: m.AvatarPickerScreen,
  })),
);
const UnlocksScreen = lazy(() =>
  import('@/screens/UnlocksScreen/UnlocksScreen').then((m) => ({ default: m.UnlocksScreen })),
);
const GachaScreen = lazy(() =>
  import('@/screens/GachaScreen/GachaScreen').then((m) => ({ default: m.GachaScreen })),
);
const AuthLoginScreen = lazy(() =>
  import('@/screens/AuthScreen/AuthLoginScreen').then((m) => ({ default: m.AuthLoginScreen })),
);
const AuthEmailScreen = lazy(() =>
  import('@/screens/AuthScreen/AuthEmailScreen').then((m) => ({ default: m.AuthEmailScreen })),
);
const AuthForgotPasswordScreen = lazy(() =>
  import('@/screens/AuthScreen/AuthForgotPasswordScreen').then((m) => ({
    default: m.AuthForgotPasswordScreen,
  })),
);
const AuthResetPasswordScreen = lazy(() =>
  import('@/screens/AuthScreen/AuthResetPasswordScreen').then((m) => ({
    default: m.AuthResetPasswordScreen,
  })),
);

const Stack = createNativeStackNavigator<RootStackParamList>();

const navLog = log.extend('AppNavigator');

/**
 * URL ↔ Screen 映射。刷新/直接访问 URL 时自动导航到对应页面。
 *
 * | Screen   | URL                            |
 * |----------|--------------------------------|
 * | Home     | `/`                            |
 * | Config   | `/config`                      |
 * | Room     | `/room/:roomCode?isHost=true` |
 * | Settings | `/settings`                    |
 *
 * `template` / `roleRevealAnimation` 是复杂对象或仅创建时需要，
 * 不放入 URL（通过 getPathFromState 剥离）。
 */

/** Params that are programmatic-only and should never appear in the URL. */
const TRANSIENT_PARAMS = ['template', 'roleRevealAnimation'];

/** @internal Exported for contract testing only. */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [SITE_URL, 'https://werewolfgamejudge.pages.dev'],
  config: {
    screens: {
      Home: '',
      BoardPicker: 'board-picker',
      Config: 'config',
      Room: {
        path: 'room/:roomCode',
        parse: {
          roomCode: (roomCode: string) => roomCode,
          isHost: (isHost: string) => isHost === 'true',
        },
        stringify: {
          roomCode: (roomCode: string) => roomCode,
          isHost: (isHost: boolean) => (isHost ? 'true' : 'false'),
        },
      },
      Settings: 'settings/:roomCode?',
      AnimationSettings: 'settings/animation/:roomCode?',
      MusicSettings: 'settings/music/:roomCode?',
      Encyclopedia: 'encyclopedia/:roomCode?',
      Notepad: 'notepad/:roomCode',
      AvatarPicker: 'avatar-picker',
      Unlocks: 'unlocks/:userId?',
      Gacha: 'gacha',
      AuthLogin: 'auth/login',
      AuthEmail: 'auth/email',
      AuthForgotPassword: 'auth/forgot-password',
      AuthResetPassword: 'auth/reset-password',
    },
  },
  // Rebuild navigation stack when deep-linking into screens that expect a parent.
  // e.g. /notepad/ABC123 → [Home, Room({roomCode: 'ABC123'}), Notepad({roomCode: 'ABC123'})]
  getStateFromPath(path, options) {
    const state = defaultGetStateFromPath(path, options);
    if (!state) return state;

    const routes = state.routes;
    const topRoute = routes[routes.length - 1];

    // Ensure Home is always at the bottom of the stack for deep-linked screens.
    // Without this, goBack()/cancel on directly-opened URLs would have nowhere to go.
    if (topRoute && topRoute.name !== 'Home' && routes.length === 1) {
      // Screens that can be opened from Room: inject Home + Room when roomCode is present.
      // Without roomCode, they were opened from Home — just inject Home as base.
      const ROOM_CHILD_SCREENS = new Set([
        'Notepad',
        'AnimationSettings',
        'MusicSettings',
        'Settings',
        'Encyclopedia',
      ]);
      if (ROOM_CHILD_SCREENS.has(topRoute.name)) {
        const roomCode = (topRoute.params as { roomCode?: string })?.roomCode;
        if (roomCode) {
          return {
            ...state,
            routes: [
              { name: 'Home' as const },
              { name: 'Room' as const, params: { roomCode, isHost: false } },
              topRoute,
            ],
            index: 2,
          };
        }
      }

      // All other screens: inject Home as base route
      return {
        ...state,
        routes: [{ name: 'Home' as const }, topRoute],
        index: 1,
      };
    }

    return state;
  },
  // Strip non-serializable params (template, roleRevealAnimation) from browser URL
  getPathFromState(state, options) {
    const path = defaultGetPathFromState(state, options);
    try {
      const url = new URL(path, 'http://placeholder');
      for (const key of TRANSIENT_PARAMS) {
        url.searchParams.delete(key);
      }
      return url.pathname + url.search;
    } catch {
      return path;
    }
  },
};

export const AppNavigator: React.FC = () => {
  if (__DEV__) {
    navLog.debug('render');
  }

  // Web: prefetch Skia WASM + all lazy screen chunks after first render.
  // requestIdleCallback ensures prefetch doesn't compete with first-paint rendering.
  // On native, Skia uses native bindings and screens are not code-split.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const prefetch = () => {
      // 1. Skia globals — must be set before any Skia screen module is evaluated.
      //    LoadSkiaWeb sets global.CanvasKit; NativeSkiaModule sets global.SkiaViewApi.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { version } = require('canvaskit-wasm/package.json') as { version: string };
      void import('@shopify/react-native-skia/lib/module/web').then(
        ({ LoadSkiaWeb: loadSkiaWeb }) =>
          loadSkiaWeb({
            locateFile: (file: string) =>
              `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${version}/bin/full/${file}`,
          }).then(() => import('@shopify/react-native-skia/lib/module/specs/NativeSkiaModule')),
      );

      // 2. Screen chunks — Skia-dependent screens first, then the rest.
      //    import() returns a cached promise if the module is already loaded,
      //    so React.lazy and this prefetch share the same download.
      void import('@/screens/RoomScreen/RoomScreen');
      void import('@/screens/GachaScreen/GachaScreen');
      void import('@/screens/AnimationSettingsScreen/AnimationSettingsScreen');
      void import('@/screens/ConfigScreen/ConfigScreen');
      void import('@/screens/BoardPickerScreen/BoardPickerScreen');
      void import('@/screens/SettingsScreen/SettingsScreen');
      void import('@/screens/EncyclopediaScreen/EncyclopediaScreen');
      void import('@/screens/MusicSettingsScreen/MusicSettingsScreen');
      void import('@/screens/NotepadScreen/NotepadScreen');
      void import('@/screens/AvatarPickerScreen/AvatarPickerScreen');
      void import('@/screens/UnlocksScreen/UnlocksScreen');
      void import('@/screens/AuthScreen/AuthLoginScreen');
      void import('@/screens/AuthScreen/AuthEmailScreen');
      void import('@/screens/AuthScreen/AuthForgotPasswordScreen');
      void import('@/screens/AuthScreen/AuthResetPasswordScreen');
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(prefetch);
    } else {
      // Safari <16.4 fallback
      setTimeout(prefetch, 200);
    }
  }, []);

  return (
    <NavigationContainer
      linking={linking}
      ref={navigationRef}
      onReady={() => {
        reactNavigationIntegration.registerNavigationContainer(navigationRef);
      }}
    >
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'default',
        }}
        screenLayout={({ children }) => (
          <Suspense fallback={<LoadingScreen message="加载中" />}>{children}</Suspense>
        )}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: '狼人kill电子裁判' }} />
        <Stack.Screen
          name="BoardPicker"
          component={BoardPickerScreen}
          options={{ title: '选择板子' }}
        />
        <Stack.Screen
          name="Config"
          component={ConfigScreen}
          options={{ title: '创建房间', animation: 'slide_from_bottom' }}
          getId={({ params }) => {
            if (params?.nominateMode) return 'nominate';
            if (params?.existingRoomCode) return `edit-${params.existingRoomCode}`;
            return undefined;
          }}
        />
        <Stack.Screen name="Room" component={RoomScreen} options={{ title: '房间' }} />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: '设置', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="AnimationSettings"
          component={AnimationSettingsScreen}
          options={{ title: '翻牌动画' }}
        />
        <Stack.Screen
          name="MusicSettings"
          component={MusicSettingsScreen}
          options={{ title: '音乐设置' }}
        />
        <Stack.Screen
          name="Encyclopedia"
          component={EncyclopediaScreen}
          options={{ title: '角色图鉴', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Notepad"
          component={NotepadScreen}
          options={{ title: '笔记', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="AvatarPicker"
          component={AvatarPickerScreen}
          options={{ title: '选择形象' }}
        />
        <Stack.Screen name="Unlocks" component={UnlocksScreen} options={{ title: '解锁一览' }} />
        <Stack.Screen name="Gacha" component={GachaScreen} options={{ title: '扭蛋抽奖' }} />
        {/* Auth modal screens — transparent overlay with centered card */}
        <Stack.Group
          screenOptions={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: colors.transparent },
          }}
        >
          <Stack.Screen name="AuthLogin" component={AuthLoginScreen} options={{ title: '登录' }} />
          <Stack.Screen
            name="AuthEmail"
            component={AuthEmailScreen}
            options={{ title: '邮箱认证' }}
          />
          <Stack.Screen
            name="AuthForgotPassword"
            component={AuthForgotPasswordScreen}
            options={{ title: '忘记密码' }}
          />
          <Stack.Screen
            name="AuthResetPassword"
            component={AuthResetPasswordScreen}
            options={{ title: '重置密码' }}
          />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
};
