import { create } from 'zustand';
import { api } from '../lib/api';

export interface CameraDevice {
  id: string;
  cameraName: string;
  label: string;
  deviceType: string;
  isOnline: boolean;
  isInRoom: boolean;
  roomSlug: string | null;
  isCameraActive: boolean;
  isCurrentDevice: boolean;
  lastSeenAt: string | null;
}

interface CameraState {
  cameras: CameraDevice[];
  loading: boolean;
  setCameras: (cameras: CameraDevice[]) => void;
  updateCamera: (deviceId: string, updates: Partial<CameraDevice>) => void;
  fetchCameras: (currentDeviceId: string | null) => Promise<void>;
}

export const useCameraStore = create<CameraState>()((set) => ({
  cameras: [],
  loading: false,

  setCameras: (cameras) => set({ cameras }),

  updateCamera: (deviceId, updates) =>
    set((state) => ({
      cameras: state.cameras.map((c) => (c.id === deviceId ? { ...c, ...updates } : c)),
    })),

  fetchCameras: async (currentDeviceId) => {
    set({ loading: true });
    try {
      const res = await api.getDevices();
      const cameras: CameraDevice[] = res.devices.map((d) => ({
        id: d.id,
        cameraName: d.camera_name || d.label,
        label: d.label,
        deviceType: d.device_type,
        isOnline: d.is_online,
        isInRoom: false,
        roomSlug: null,
        isCameraActive: false,
        isCurrentDevice: d.id === currentDeviceId,
        lastSeenAt: d.last_seen_at,
      }));
      set({ cameras, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
