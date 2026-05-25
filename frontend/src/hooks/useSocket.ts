import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '../lib/socket';
import { useRoomStore } from '../stores/roomStore';
import { playSound } from '../lib/sounds';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { addParticipant, removeParticipant, setReconnecting } = useRoomStore();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return socketRef.current;

    const socket = getSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setReconnecting(false);
    });

    socket.on('disconnect', () => {
      setReconnecting(true);
    });

    socket.on('reconnect', () => {
      setReconnecting(false);
    });

    socket.on('room:participantJoined', (data) => {
      addParticipant(data);
      playSound('join');
    });

    socket.on('room:participantLeft', (data) => {
      removeParticipant(data.userId, data.deviceId);
      playSound('leave');
    });

    return socket;
  }, [addParticipant, removeParticipant, setReconnecting]);

  const disconnect = useCallback(() => {
    disconnectSocket();
    socketRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { socket: socketRef, connect, disconnect };
}
