import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { GameFacadeProvider, useGameFacade } from '@/contexts/GameFacadeContext';
import type { IGameFacade } from '@/services/types/IGameFacade';

function createFakeFacade(): IGameFacade {
  return {
    addListener: () => () => {},
    getState: () => null,
    isHostPlayer: () => false,
    getMyUid: () => 'u1',
    getMySeatNumber: () => null,
    getStateRevision: () => 0,
    initializeAsHost: async () => {},
    joinAsPlayer: async () => {},
    joinAsHost: async () => ({ success: true }),
    leaveRoom: async () => {},
    takeSeat: async () => true,
    takeSeatWithAck: async () => ({ success: true }),
    leaveSeat: async () => true,
    leaveSeatWithAck: async () => ({ success: true }),
    assignRoles: async () => ({ success: true }),
    updateTemplate: async () => ({ success: true }),
    setRoleRevealAnimation: async () => ({ success: true }),
    startNight: async () => ({ success: true }),
    restartGame: async () => ({ success: true }),
    fillWithBots: async () => ({ success: true }),
    markAllBotsViewed: async () => ({ success: true }),
    markViewedRole: async () => ({ success: true }),
    submitAction: async () => ({ success: true }),
    submitWolfVote: async () => ({ success: true }),
    submitRevealAck: async () => ({ success: true }),
    endNight: async () => ({ success: true }),
    setAudioPlaying: async () => ({ success: true }),
    fetchStateFromDB: async () => true,
    sendWolfRobotHunterStatusViewed: async () => ({ success: true }),
    addConnectionStatusListener: () => () => {},
    wasAudioInterrupted: false,
    resumeAfterRejoin: async () => {},
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
