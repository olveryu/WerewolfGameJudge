/**
 * why-did-you-render — 开发环境无效 re-render 检测
 *
 * 必须在 index.ts 最顶部、React import 之前引入。
 * 生产环境 __DEV__ 为 false，不会执行任何逻辑，零开销。
 *
 * 使用方式：
 * 1. 全局自动追踪所有 React.memo / PureComponent（已开启 trackAllPureComponents）
 * 2. 对普通函数组件，在组件定义后标记：
 *    MyComponent.whyDidYouRender = true;
 *
 * @see https://github.com/welldone-software/why-did-you-render
 */
import React from 'react';

if (__DEV__) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: true,
  });
}
