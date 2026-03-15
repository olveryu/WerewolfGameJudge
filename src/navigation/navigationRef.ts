/**
 * navigationRef — 组件外导航引用
 *
 * 提供全局 NavigationContainerRef，供非组件代码（如 Toast onPress）调用导航。
 * React Navigation 官方推荐方案。不含业务逻辑。
 */
import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
