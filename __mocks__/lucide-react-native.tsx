/**
 * Mock for lucide-react-native — returns Text stubs for all icon imports.
 */
import React from 'react';
import { Text } from 'react-native';

const handler: ProxyHandler<object> = {
  get(_target, prop) {
    if (typeof prop === 'string' && prop[0] === prop[0].toUpperCase()) {
      // Return a stub component for any PascalCase export (icon component)
      const IconStub = (props: Record<string, unknown>) => (
        <Text testID={`lucide-${String(prop)}`}>{String(props.size ?? 24)}</Text>
      );
      IconStub.displayName = `Lucide${String(prop)}`;
      return IconStub;
    }
    return undefined;
  },
};

module.exports = new Proxy({}, handler);
