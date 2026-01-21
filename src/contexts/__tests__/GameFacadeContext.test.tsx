import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { GameFacadeProvider, useGameFacade } from '../GameFacadeContext';
import type { IGameFacade } from '../../services/types/IGameFacade';

function createFakeFacade(): IGameFacade {
  return {
    addListener: () => () => {},
    isHostPlayer: () => false,
    getMyUid: () => 'u1',
    getMySeatNumber: () => null,
    getStateRevision: () => 0,
    initializeAsHost: async () => {},
    joinAsPlayer: async () => {},
    leaveRoom: async () => {},
    takeSeat: async () => true,
    takeSeatWithAck: async () => ({ success: true }),
    leaveSeat: async () => true,
    leaveSeatWithAck: async () => ({ success: true }),
  };
}

const Consumer: React.FC = () => {
  const facade = useGameFacade();
  return <Text testID="uid">{facade.getMyUid() ?? 'null'}</Text>;
};

describe('GameFacadeProvider / useGameFacade', () => {
  it('throws when used without provider', () => {
    expect(() => render(<Consumer />)).toThrow(
      '[useGameFacade] Missing <GameFacadeProvider> in component tree',
    );
  });

  it('provides the explicit facade prop', () => {
    const facade = createFakeFacade();
    const ui = render(
      <GameFacadeProvider facade={facade}>
        <Consumer />
      </GameFacadeProvider>,
    );

    expect(ui.getByTestId('uid').props.children).toBe('u1');
  });
});
