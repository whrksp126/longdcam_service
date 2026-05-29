import { useEffect, useState } from 'react';
import { getSocket, emitWithAck } from '../lib/socket';
import { useAuthStore } from '../stores/authStore';

/**
 * Watch-together sync. Playback runs locally on every client (true 4K, ~0 bandwidth);
 * only play/pause/seek timestamps travel over Socket.IO. The server keeps the room's
 * shared state and a single "host" who is allowed to drive it.
 */

export interface TheaterSource {
  type: 'youtube' | 'video';
  src: string; // youtube: video id, video: presigned URL
  title?: string;
}

export interface TheaterState {
  source: TheaterSource;
  playing: boolean;
  time: number;
  hostKey: string | null;
}

export type TheaterAction = 'play' | 'pause' | 'seek';

export function useWatchSync() {
  const [theater, setTheater] = useState<TheaterState | null>(null);
  const userId = useAuthStore((s) => s.userId);
  const deviceId = useAuthStore((s) => s.deviceId);
  const myKey = `${userId}:${deviceId}`;

  useEffect(() => {
    const socket = getSocket();
    const onState = (s: TheaterState | null) => setTheater(s);
    socket.on('theater:state', onState);
    emitWithAck<{ state: TheaterState | null }>('theater:getState')
      .then((r) => setTheater(r.state))
      .catch(() => {});
    return () => {
      socket.off('theater:state', onState);
    };
  }, []);

  // The starter is host; an empty host (host left) is open for takeover.
  const isHost = !theater || theater.hostKey === myKey || theater.hostKey === null;

  const start = (source: TheaterSource) => emitWithAck('theater:start', { source });
  const stop = () => getSocket().emit('theater:stop');
  const control = (action: TheaterAction, time?: number) =>
    getSocket().emit('theater:control', { action, time });

  return { theater, isHost, myKey, start, stop, control };
}
