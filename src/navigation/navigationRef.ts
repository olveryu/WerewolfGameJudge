/**
 * navigationRef — navigation ref for use outside React components
 *
 * Provides a global NavigationContainerRef for non-component code (e.g. Toast onPress callbacks).
 * Official React Navigation recommended approach. No business logic.
 */
import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
