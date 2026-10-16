/**
 * react-native-web prop augmentation.
 *
 * react-native-web renders `dataSet` entries as DOM `data-*` attributes
 * (its createDOMProps maps dataSet to data-*), but React Native's core
 * types do not declare the prop — and a direct `data-*` prop is silently
 * dropped by the web runtime. Declaring it here makes the supported web
 * behavior type-check. On native platforms the prop is ignored.
 */

import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    dataSet?: Record<string, string>;
  }
}
