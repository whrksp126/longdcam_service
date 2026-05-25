import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useCameraStore } from '../stores/cameraStore';
import { useAlwaysOnCamera } from '../services/alwaysOnCamera';
import { getSocket, disconnectSocket } from '../lib/socket';
import { useBackgroundCamera } from '../services/backgroundCamera';
import { setupPreviewStreamer, cleanupAllOutgoing } from '../services/previewStream';

let initialized = false;

export function useGlobalSocket() {
  const token = useAuthStore((s) => s.token);
  const deviceId = useAuthStore((s) => s.deviceId);
  const bgCamera = useBackgroundCamera();

  // Initialize on login
  useEffect(() => {
    if (!token || initialized) return;
    initialized = true;

    const socket = getSocket();
    const { fetchCameras } = useCameraStore.getState();

    useAlwaysOnCamera.getState().start().then(() => {
      if (socket.connected) {
        socket.emit('camera:activeStatusUpdate', { isActive: true });
      }
    });

    socket.on('device:online', ({ deviceId: id }) => {
      useCameraStore.getState().updateCamera(id, { isOnline: true });
    });

    socket.on('device:offline', ({ deviceId: id }) => {
      useCameraStore.getState().updateCamera(id, { isOnline: false, isInRoom: false, roomSlug: null, isCameraActive: false });
    });

    socket.on('camera:statusUpdate', ({ deviceId: id, isInRoom, roomSlug }) => {
      useCameraStore.getState().updateCamera(id, { isInRoom, roomSlug });
    });

    socket.on('camera:activeStatusUpdate', ({ deviceId: id, isActive }) => {
      useCameraStore.getState().updateCamera(id, { isCameraActive: isActive });
    });

    socket.on('camera:startRequested', ({ roomSlug }) => {
      bgCamera.startStreaming(roomSlug);
    });

    socket.on('camera:stopRequested', () => {
      bgCamera.stopStreaming();
    });

    socket.on('camera:powerOn', async () => {
      await useAlwaysOnCamera.getState().start();
      socket.emit('camera:activeStatusUpdate', { isActive: true });
    });

    socket.on('camera:powerOff', () => {
      useAlwaysOnCamera.getState().stop();
      socket.emit('camera:activeStatusUpdate', { isActive: false });
    });

    setupPreviewStreamer();
    fetchCameras(deviceId);
  }, [token]);

  // Cleanup on logout
  useEffect(() => {
    if (!token && initialized) {
      initialized = false;
      useAlwaysOnCamera.getState().stop();
      cleanupAllOutgoing();
      disconnectSocket();
    }
  }, [token]);
}
