import type React from 'react';

import { bindGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import { fibGameNavigation } from '@/games/fibking/navigation/fibGameNavigation';
import {
  type GameNotepadRouteParams,
  getGameNavigationRoomCode,
  parseGameNavigationRouteParams,
} from '@/games/navigation';

const EmptyScreen: React.FC = () => null;

function assertNavigationTypeContracts(): void {
  // @ts-expect-error Every supported FibKing route requires a bound screen.
  bindGameNavigation(fibGameNavigation, { config: EmptyScreen });

  bindGameNavigation(fibGameNavigation, {
    config: EmptyScreen,
    guide: EmptyScreen,
    // @ts-expect-error Unsupported routes cannot bind a screen.
    notepad: EmptyScreen,
  });
}

describe('game navigation composition', () => {
  it('binds exactly the screens supported by a game definition', () => {
    const navigation = bindGameNavigation(fibGameNavigation, {
      config: EmptyScreen,
      guide: EmptyScreen,
    });

    expect(navigation.gameType).toBe('fibking');
    expect(navigation.config).toMatchObject({ kind: 'screen', Screen: EmptyScreen });
    expect(navigation.guide).toMatchObject({ kind: 'screen', Screen: EmptyScreen });
    expect(navigation.notepad).toEqual({ kind: 'unsupported' });
  });

  it('parses supported routes and rejects unsupported capabilities', () => {
    expect(
      parseGameNavigationRouteParams('guide', { gameType: 'fibking', roomCode: '4321' }),
    ).toEqual({ gameType: 'fibking', roomCode: '4321' });
    expect(() =>
      parseGameNavigationRouteParams('notepad', {
        gameType: 'fibking',
        roomCode: '4321',
      }),
    ).toThrow('[FAIL-FAST] fibking does not support notepad navigation');
  });

  it('derives parent room identity from the selected game parser', () => {
    expect(
      getGameNavigationRoomCode('config', { gameType: 'werewolf', mode: 'create' }),
    ).toBeNull();
    expect(
      getGameNavigationRoomCode('config', {
        gameType: 'fibking',
        mode: 'edit',
        roomCode: '2468',
      }),
    ).toBe('2468');
  });

  it('excludes unsupported route params and screen bindings at compile time', () => {
    const notepadRoute: GameNotepadRouteParams = {
      gameType: 'werewolf',
      roomCode: '1234',
    };
    expect(notepadRoute.gameType).toBe('werewolf');

    const unsupportedNotepad: GameNotepadRouteParams = {
      // @ts-expect-error FibKing does not contribute a notepad route.
      gameType: 'fibking',
      roomCode: '1234',
    };
    expect(unsupportedNotepad.gameType).toBe('fibking');
    expect(assertNavigationTypeContracts).toEqual(expect.any(Function));
  });
});
