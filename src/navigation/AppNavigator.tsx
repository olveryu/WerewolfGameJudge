/**
 * AppNavigator - Root navigation stack for the app
 *
 * 注册所有 Screen（Home / Config / Room / Settings）并配置导航栏。
 * 通过 `linking` 配置实现 URL ↔ 导航状态双向同步（Web 刷新恢复页面）。
 * 涵盖导航栋定义、Screen 注册、header 样式配置、linking 路由映射。
 * 不包含业务逻辑，不直接调用 service。
 */
import {
  getPathFromState as defaultGetPathFromState,
  getStateFromPath as defaultGetStateFromPath,
  LinkingOptions,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { SITE_URL } from '@/config/api';
import { AnimationSettingsScreen } from '@/screens/AnimationSettingsScreen/AnimationSettingsScreen';
import {
  AuthEmailScreen,
  AuthForgotPasswordScreen,
  AuthLoginScreen,
  AuthResetPasswordScreen,
} from '@/screens/AuthScreen';
import { AvatarPickerScreen } from '@/screens/AvatarPickerScreen/AvatarPickerScreen';
import { BoardPickerScreen } from '@/screens/BoardPickerScreen/BoardPickerScreen';
import { ConfigScreen } from '@/screens/ConfigScreen/ConfigScreen';
import { EncyclopediaScreen } from '@/screens/EncyclopediaScreen/EncyclopediaScreen';
import { HomeScreen } from '@/screens/HomeScreen/HomeScreen';
import { MusicSettingsScreen } from '@/screens/MusicSettingsScreen/MusicSettingsScreen';
import { NotepadScreen } from '@/screens/NotepadScreen/NotepadScreen';
import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
import { SettingsScreen } from '@/screens/SettingsScreen/SettingsScreen';
import { useColors } from '@/theme';
import { log } from '@/utils/logger';
import { isMiniProgram, postCurrentUrl } from '@/utils/miniProgram';

import { navigationRef } from './navigationRef';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navLog = log.extend('AppNavigator');

/**
 * URL ↔ Screen 映射。刷新/直接访问 URL 时自动导航到对应页面。
 *
 * | Screen   | URL                            |
 * |----------|--------------------------------|
 * | Home     | `/`                            |
 * | Config   | `/config`                      |
 * | Room     | `/room/:roomNumber?isHost=true` |
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
        path: 'room/:roomNumber',
        parse: {
          roomNumber: (roomNumber: string) => roomNumber,
          isHost: (isHost: string) => isHost === 'true',
        },
        stringify: {
          roomNumber: (roomNumber: string) => roomNumber,
          isHost: (isHost: boolean) => (isHost ? 'true' : 'false'),
        },
      },
      Settings: 'settings/:roomNumber?',
      AnimationSettings: 'settings/animation/:roomNumber?',
      MusicSettings: 'settings/music/:roomNumber?',
      Encyclopedia: 'encyclopedia/:roomNumber?',
      Notepad: 'notepad/:roomNumber',
      AvatarPicker: 'avatar-picker',
      AuthLogin: 'auth/login',
      AuthEmail: 'auth/email',
      AuthForgotPassword: 'auth/forgot-password',
      AuthResetPassword: 'auth/reset-password',
    },
  },
  // Rebuild navigation stack when deep-linking into screens that expect a parent.
  // e.g. /notepad/ABC123 → [Home, Room({roomNumber: 'ABC123'}), Notepad({roomNumber: 'ABC123'})]
  getStateFromPath(path, options) {
    const state = defaultGetStateFromPath(path, options);
    if (!state) return state;

    const routes = state.routes;
    const topRoute = routes[routes.length - 1];

    // Ensure Home is always at the bottom of the stack for deep-linked screens.
    // Without this, goBack()/cancel on directly-opened URLs would have nowhere to go.
    if (topRoute && topRoute.name !== 'Home' && routes.length === 1) {
      // Screens that can be opened from Room: inject Home + Room when roomNumber is present.
      // Without roomNumber, they were opened from Home — just inject Home as base.
      const ROOM_CHILD_SCREENS = new Set([
        'Notepad',
        'AnimationSettings',
        'MusicSettings',
        'Settings',
        'Encyclopedia',
      ]);
      if (ROOM_CHILD_SCREENS.has(topRoute.name)) {
        const roomNumber = (topRoute.params as { roomNumber?: string })?.roomNumber;
        if (roomNumber) {
          return {
            ...state,
            routes: [
              { name: 'Home' as const },
              { name: 'Room' as const, params: { roomNumber, isHost: false } },
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
  const colors = useColors();

  // 小程序 web-view：路由变化时通知小程序保存 URL（用于恢复上次浏览位置）
  const inMiniProgram = isMiniProgram();
  const handleStateChange = React.useCallback(() => {
    if (inMiniProgram) postCurrentUrl();
  }, [inMiniProgram]);

  return (
    <NavigationContainer
      linking={linking}
      ref={navigationRef}
      onStateChange={inMiniProgram ? handleStateChange : undefined}
    >
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'default',
        }}
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
          options={{ title: '创建房间', presentation: 'modal', animation: 'slide_from_bottom' }}
          getId={({ params }) => {
            if (params?.nominateMode) return 'nominate';
            if (params?.existingRoomNumber) return `edit-${params.existingRoomNumber}`;
            return undefined;
          }}
        />
        <Stack.Screen name="Room" component={RoomScreen} options={{ title: '房间' }} />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: '设置', presentation: 'modal', animation: 'slide_from_bottom' }}
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
          options={{ title: '角色图鉴', presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Notepad"
          component={NotepadScreen}
          options={{ title: '笔记', presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="AvatarPicker"
          component={AvatarPickerScreen}
          options={{ title: '选择形象' }}
        />
        {/* Auth modal screens — transparent overlay with centered card */}
        <Stack.Group
          screenOptions={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
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
