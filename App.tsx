import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation';
import { colors } from './src/constants/theme';

export default function App() {
  console.log('App rendering...');
  return (
    <>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <AppNavigator />
    </>
  );
}
