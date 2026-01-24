/**
 * Tests for useGameRoom hook
 *
 * Focus: ACK reason transparency - ensuring takeSeatWithAck/leaveSeatWithAck
 * pass through the reason from facade without modification.
 *
 * PR8: 完全切换到 v2 facade，不再依赖 legacy GameStateService
 */

import { renderHook, act } from '@testing-library/react-native';
import React from 'react';
import { AuthService } from '../../services/infra/AuthService';
import { BroadcastService } from '../../services/BroadcastService';
import { useGameRoom } from '../useGameRoom';
import { GameFacadeProvider } from '../../contexts';
import type { IGameFacade } from '../../services/types/IGameFacade';

// Mock the services (only those actually needed)
jest.mock('../../services/infra/RoomService');
jest.mock('../../services/infra/AuthService');
jest.mock('../../services/BroadcastService');

/**
 * Tests for useGameRoom ACK reason transparency
 *
 * These tests verify that takeSeatWithAck/leaveSeatWithAck pass through
 * the reason from facade without modification.
 */
describe('useGameRoom - ACK reason transparency', () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockBroadcastService: jest.Mocked<BroadcastService>;

  // Create a mock facade for testing
  const createMockFacade = (overrides: Partial<IGameFacade> = {}): IGameFacade => ({
    addListener: jest.fn().mockReturnValue(() => {}),
    getState: jest.fn().mockReturnValue(null),
    isHostPlayer: jest.fn().mockReturnValue(false),
    getMyUid: jest.fn().mockReturnValue('player-uid'),
    getMySeatNumber: jest.fn().mockReturnValue(null),
    getStateRevision: jest.fn().mockReturnValue(0),
    initializeAsHost: jest.fn().mockResolvedValue(undefined),
    joinAsPlayer: jest.fn().mockResolvedValue(undefined),
    leaveRoom: jest.fn().mockResolvedValue(undefined),
    takeSeat: jest.fn().mockResolvedValue(true),
    takeSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    leaveSeat: jest.fn().mockResolvedValue(true),
    leaveSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
    assignRoles: jest.fn().mockResolvedValue({ success: true }),
    updateTemplate: jest.fn().mockResolvedValue({ success: true }),
    startNight: jest.fn().mockResolvedValue({ success: true }),
    restartGame: jest.fn().mockResolvedValue({ success: true }),
    markViewedRole: jest.fn().mockResolvedValue({ success: true }),
    submitAction: jest.fn().mockResolvedValue({ success: true }),
    submitWolfVote: jest.fn().mockResolvedValue({ success: true }),
    submitRevealAck: jest.fn().mockResolvedValue({ success: true }),
    advanceNight: jest.fn().mockResolvedValue({ success: true }),
    endNight: jest.fn().mockResolvedValue({ success: true }),
    setAudioPlaying: jest.fn().mockResolvedValue({ success: true }),
    requestSnapshot: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup minimal mock services
    mockAuthService = {
      waitForInit: jest.fn().mockResolvedValue(undefined),
      getCurrentUserId: jest.fn().mockReturnValue('player-uid'),
      getCurrentDisplayName: jest.fn().mockResolvedValue('Test Player'),
      getCurrentAvatarUrl: jest.fn().mockResolvedValue(null),
    } as any;

    mockBroadcastService = {
      addStatusListener: jest.fn().mockReturnValue(() => {}),
    } as any;

    (AuthService.getInstance as jest.Mock).mockReturnValue(mockAuthService);
    (BroadcastService.getInstance as jest.Mock).mockReturnValue(mockBroadcastService);
  });

  describe('takeSeatWithAck reason transparency', () => {
    it('should return { success: true, reason: undefined } when facade returns success', async () => {
      const mockFacade = createMockFacade({
        takeSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.takeSeatWithAck(1);
      });

      expect(ackResult).toEqual({ success: true, reason: undefined });
      expect(mockFacade.takeSeatWithAck).toHaveBeenCalledWith(1, 'Test Player', undefined);
    });

    it('should pass through seat_taken reason from facade', async () => {
      const mockFacade = createMockFacade({
        takeSeatWithAck: jest.fn().mockResolvedValue({ success: false, reason: 'seat_taken' }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.takeSeatWithAck(1);
      });

      expect(ackResult).toEqual({ success: false, reason: 'seat_taken' });
    });

    it('should pass through game_in_progress reason from facade', async () => {
      const mockFacade = createMockFacade({
        takeSeatWithAck: jest
          .fn()
          .mockResolvedValue({ success: false, reason: 'game_in_progress' }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.takeSeatWithAck(1);
      });

      expect(ackResult).toEqual({ success: false, reason: 'game_in_progress' });
    });

    it('should pass through invalid_seat reason from facade', async () => {
      const mockFacade = createMockFacade({
        takeSeatWithAck: jest.fn().mockResolvedValue({ success: false, reason: 'invalid_seat' }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.takeSeatWithAck(999);
      });

      expect(ackResult).toEqual({ success: false, reason: 'invalid_seat' });
    });
  });

  describe('leaveSeatWithAck reason transparency', () => {
    it('should return { success: true, reason: undefined } when facade returns success', async () => {
      const mockFacade = createMockFacade({
        leaveSeatWithAck: jest.fn().mockResolvedValue({ success: true }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.leaveSeatWithAck();
      });

      expect(ackResult).toEqual({ success: true, reason: undefined });
    });

    it('should pass through game_in_progress reason from facade', async () => {
      const mockFacade = createMockFacade({
        leaveSeatWithAck: jest
          .fn()
          .mockResolvedValue({ success: false, reason: 'game_in_progress' }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.leaveSeatWithAck();
      });

      expect(ackResult).toEqual({ success: false, reason: 'game_in_progress' });
    });

    it('should pass through not_seated reason from facade', async () => {
      const mockFacade = createMockFacade({
        leaveSeatWithAck: jest.fn().mockResolvedValue({ success: false, reason: 'not_seated' }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameFacadeProvider facade={mockFacade}>{children}</GameFacadeProvider>
      );

      const { result } = renderHook(() => useGameRoom(), { wrapper });

      let ackResult: { success: boolean; reason?: string } | undefined;
      await act(async () => {
        ackResult = await result.current.leaveSeatWithAck();
      });

      expect(ackResult).toEqual({ success: false, reason: 'not_seated' });
    });
  });
});
