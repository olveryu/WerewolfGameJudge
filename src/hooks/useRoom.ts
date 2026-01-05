import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, createRoom as createRoomModel } from '../models/Room';
import { RoomService } from '../services/RoomService';
import { GameTemplate } from '../models/Template';

export const useRoom = (roomNumber?: string) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roomService = useRef(RoomService.getInstance());

  // Subscribe to room changes
  useEffect(() => {
    if (!roomNumber) return;

    setLoading(true);
    const unsubscribe = roomService.current.subscribeToRoom(roomNumber, (updatedRoom) => {
      setRoom(updatedRoom);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomNumber]);

  const createRoom = useCallback(
    async (hostId: string, template: GameTemplate) => {
      setLoading(true);
      setError(null);
      try {
        const roomNum = await roomService.current.generateRoomNumber();
        const newRoom = createRoomModel(hostId, roomNum, template);
        await roomService.current.createRoom(roomNum, newRoom);
        setRoom(newRoom);
        return newRoom;
      } catch {
        setError('Failed to create room');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateRoom = useCallback(
    async (updates: Partial<Room>) => {
      if (!room) return;

      setError(null);
      try {
        const updatedRoom = { ...room, ...updates };
        await roomService.current.updateRoom(room.roomNumber, updatedRoom);
      } catch {
        setError('Failed to update room');
      }
    },
    [room]
  );

  const endRoom = useCallback(async () => {
    if (!room) return;

    try {
      await roomService.current.deleteRoom(room.roomNumber);
    } catch {
      setError('Failed to end room');
    }
  }, [room]);

  const joinRoom = useCallback(async (roomNum: string) => {
    setLoading(true);
    setError(null);
    try {
      const foundRoom = await roomService.current.getRoom(roomNum);
      if (foundRoom) {
        setRoom(foundRoom);
        return foundRoom;
      } else {
        setError('Room not found');
        return null;
      }
    } catch {
      setError('Failed to join room');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    room,
    loading,
    error,
    createRoom,
    updateRoom,
    endRoom,
    joinRoom,
    setRoom,
  };
};
