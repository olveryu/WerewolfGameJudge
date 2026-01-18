import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen/HomeScreen';
import { ConfigScreen } from '../screens/ConfigScreen/ConfigScreen';
import { RoomScreen } from '../screens/RoomScreen/RoomScreen';
import SettingsScreen from '../screens/SettingsScreen/SettingsScreen';
import { useColors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  console.log('AppNavigator rendering...');
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
