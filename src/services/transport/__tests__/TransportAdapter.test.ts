/**
 * TransportAdapter Unit Tests
 */

import { TransportAdapter } from '../TransportAdapter';
import type { TransportListener } from '../TransportAdapter';
import type { BroadcastService } from '../BroadcastService';
import type { GameState } from '../../v2/store/types';

function createMockBroadcastService(): jest.Mocked<BroadcastService> {
  return {
    broadcastAsHost: jest.fn().mockResolvedValue(undefined),
    sendToHost: jest.fn().mockResolvedValue(undefined),
    // Add other methods as needed for the interface
  } as unknown as jest.Mocked<BroadcastService>;
}

function createMinimalState(): GameState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-1',
    status: 'unseated',
    templateRoles: ['villager', 'wolf', 'seer'],
    players: { 0: null, 1: null, 2: null },
    currentActionerIndex: -1,
    isAudioPlaying: false,
  };
}

describe('TransportAdapter', () => {
  describe('broadcastState (Host)', () => {
    it('should call broadcastAsHost with STATE_UPDATE message', async () => {
      const mockService = createMockBroadcastService();
      const adapter = new TransportAdapter(mockService, true);
      const state = createMinimalState();

      await adapter.broadcastState(state, 1);

      expect(mockService.broadcastAsHost).toHaveBeenCalledWith({
        type: 'STATE_UPDATE',
        state,
        revision: 1,
      });
    });

    it('should throw when called by non-host', async () => {
      const mockService = createMockBroadcastService();
      const adapter = new TransportAdapter(mockService, false);
      const state = createMinimalState();

      await expect(adapter.broadcastState(state, 1)).rejects.toThrow(
        'Only host can broadcast state',
      );
    });
  });

  describe('sendToHost (Player)', () => {
    it('should call sendToHost on BroadcastService', async () => {
      const mockService = createMockBroadcastService();
      const adapter = new TransportAdapter(mockService, false);
      const message = { type: 'JOIN' as const, seat: 0, uid: 'test-uid', displayName: 'Test' };

      await adapter.sendToHost(message);

      expect(mockService.sendToHost).toHaveBeenCalledWith(message);
    });

    it('should throw when called by host', async () => {
      const mockService = createMockBroadcastService();
      const adapter = new TransportAdapter(mockService, true);
      const message = { type: 'JOIN' as const, seat: 0, uid: 'test-uid', displayName: 'Test' };

      await expect(adapter.sendToHost(message)).rejects.toThrow('Host cannot send to host');
    });
  });

  describe('subscribe/notify', () => {
    it('should add and notify listeners on state update', () => {
      const mockService = createMockBroadcastService();
      const adapter = new TransportAdapter(mockService, true);
      const listener: TransportListener = {
        onStateUpdate: jest.fn(),
      };

      adapter.subscribe(listener);
      const state = createMinimalState();
      adapter.notifyStateUpdate(state, 1);

      expect(listener.onStateUpdate).toHaveBeenCalledWith(state, 1);
    });

    it('should notify listeners on player message', () => {
      const mockService = createMockBroadcastService();
      const adapter = new TransportAdapter(mockService, true);
      const listener: TransportListener = {
        onPlayerMessage: jest.fn(),
      };

      adapter.subscribe(listener);
      const message = { type: 'JOIN' as const, seat: 0, uid: 'test-uid', displayName: 'Test' };
      adapter.notifyPlayerMessage(message, 'sender-uid');

      expect(listener.onPlayerMessage).toHaveBeenCalledWith(message, 'sender-uid');
    });

    it('should notify listeners on connection change', () => {
      const mockService = createMockBroadcastService();
      const adapter = new TransportAdapter(mockService, true);
      const listener: TransportListener = {
        onConnectionChange: jest.fn(),
      };

      adapter.subscribe(listener);
      adapter.notifyConnectionChange(true);

      expect(listener.onConnectionChange).toHaveBeenCalledWith(true);
    });

    it('should return unsubscribe function', () => {
      const mockService = createMockBroadcastService();
      const adapter = new TransportAdapter(mockService, true);
      const listener: TransportListener = {
        onStateUpdate: jest.fn(),
      };

      const unsubscribe = adapter.subscribe(listener);
      unsubscribe();

      const state = createMinimalState();
      adapter.notifyStateUpdate(state, 1);

      expect(listener.onStateUpdate).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const mockService = createMockBroadcastService();
      const adapter = new TransportAdapter(mockService, true);
      const listener1: TransportListener = { onStateUpdate: jest.fn() };
      const listener2: TransportListener = { onStateUpdate: jest.fn() };

      adapter.subscribe(listener1);
      adapter.subscribe(listener2);

      const state = createMinimalState();
      adapter.notifyStateUpdate(state, 1);

      expect(listener1.onStateUpdate).toHaveBeenCalled();
      expect(listener2.onStateUpdate).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should clear all listeners', async () => {
      const mockService = createMockBroadcastService();
      const adapter = new TransportAdapter(mockService, true);
      const listener: TransportListener = { onStateUpdate: jest.fn() };

      adapter.subscribe(listener);
      await adapter.disconnect();

      const state = createMinimalState();
      adapter.notifyStateUpdate(state, 1);

      expect(listener.onStateUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getListeners', () => {
    it('should return readonly set of listeners', () => {
      const mockService = createMockBroadcastService();
      const adapter = new TransportAdapter(mockService, true);
      const listener: TransportListener = { onStateUpdate: jest.fn() };

      adapter.subscribe(listener);
      const listeners = adapter.getListeners();

      expect(listeners.size).toBe(1);
      expect(listeners.has(listener)).toBe(true);
    });
  });
});
