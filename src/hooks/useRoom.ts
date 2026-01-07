import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, createRoom as createRoomModel, RoomStatus } from '../models/Room';
import { RoomService } from '../services/RoomService';
import { GameTemplate } from '../models/Template';

// Calculate a "progress score" for a room state during ongoing game
// Higher score = more progress in the game
const calculateProgressScore = (room: Room): number => {
  // Primary: action index (each action increases by 1000)
  // Secondary: wolf votes count (each vote increases by 1)
  return room.currentActionerIndex * 1000 + room.wolfVotes.size;
};

export const useRoom = (roomNumber?: string) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roomService = useRef(RoomService.getInstance());
  
  // Track the highest progress score to prevent out-of-order updates
  const highestProgressScore = useRef<number>(-1);

  // Subscribe to room changes
  useEffect(() => {
    if (!roomNumber) return;

    // Reset tracking when room changes
    highestProgressScore.current = -1;
    
    setLoading(true);
    const unsubscribe = roomService.current.subscribeToRoom(roomNumber, (updatedRoom) => {
      if (!updatedRoom) {
        setRoom(null);
        setLoading(false);
        return;
      }
      
      // During ongoing game, only accept updates with non-decreasing progress
      // This prevents out-of-order Supabase real-time updates from causing UI flickering
      if (updatedRoom.roomStatus === RoomStatus.ongoing) {
        const newScore = calculateProgressScore(updatedRoom);
        
        if (newScore < highestProgressScore.current) {
          // Ignore this stale update
          console.log(`[useRoom] Ignoring stale update: score ${newScore} < ${highestProgressScore.current}, actionerIndex=${updatedRoom.currentActionerIndex}, wolfVotes=${updatedRoom.wolfVotes.size}`);
          return;
        }
        
        console.log(`[useRoom] Accepting update: score ${newScore} >= ${highestProgressScore.current}, actionerIndex=${updatedRoom.currentActionerIndex}, wolfVotes=${updatedRoom.wolfVotes.size}`);
        highestProgressScore.current = newScore;
      } else {
        // When game is not ongoing, reset tracking
        highestProgressScore.current = -1;
      }
      
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
    endRoom,
    joinRoom,
    setRoom,
  };
};
