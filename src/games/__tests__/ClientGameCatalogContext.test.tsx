import { render } from '@testing-library/react-native';
import type React from 'react';
import { Text } from 'react-native';

import { ClientGameCatalogProvider, useClientGameModule } from '@/games/ClientGameCatalogContext';
import { createTestClientGameCatalog } from '@/test-utils/clientGameCatalog';

const Consumer: React.FC = () => {
  const module = useClientGameModule('werewolf');
  return <Text testID="gameType">{module.gameType}</Text>;
};

describe('ClientGameCatalogProvider', () => {
  it('fails fast when used without the composition-root provider', () => {
    expect(() => render(<Consumer />)).toThrow('[FAIL-FAST] Missing ClientGameCatalogProvider');
  });

  it('returns the requested game module', () => {
    const ui = render(
      <ClientGameCatalogProvider catalog={createTestClientGameCatalog()}>
        <Consumer />
      </ClientGameCatalogProvider>,
    );

    expect(ui.getByTestId('gameType').props.children).toBe('werewolf');
  });
});
