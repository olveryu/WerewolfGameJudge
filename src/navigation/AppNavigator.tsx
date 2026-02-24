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
  LinkingOptions,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { ConfigScreen } from '@/screens/ConfigScreen/ConfigScreen';
import { HomeScreen } from '@/screens/HomeScreen/HomeScreen';
import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
import { SettingsScreen } from '@/screens/SettingsScreen/SettingsScreen';
import { useColors } from '@/theme';
import { log } from '@/utils/logger';

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

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      Home: '',
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
      Settings: 'settings',
    },
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

  return (
    <NavigationContainer linking={linking} ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: '狼人杀' }} />
        <Stack.Screen name="Config" component={ConfigScreen} options={{ title: '创建房间' }} />
        <Stack.Screen name="Room" component={RoomScreen} options={{ title: '房间' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
