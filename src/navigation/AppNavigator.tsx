/**
 * AppNavigator - Root navigation stack for the app
 *
 * 注册所有 Screen（Home / Config / Room / Settings）并配置导航栈。
 *
 * ✅ 允许：导航栈定义、Screen 注册、header 样式配置
 * ❌ 禁止：业务逻辑、直接调用 service
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen/HomeScreen';
import { ConfigScreen } from '../screens/ConfigScreen/ConfigScreen';
import { RoomScreen } from '../screens/RoomScreen/RoomScreen';
import SettingsScreen from '../screens/SettingsScreen/SettingsScreen';
import { useColors } from '../theme';
import { log } from '../utils/logger';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navLog = log.extend('AppNavigator');

export const AppNavigator: React.FC = () => {
  if (__DEV__) {
    navLog.debug('render');
  }
  const colors = useColors();

  return (
    <NavigationContainer>
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

export default AppNavigator;
