import { create } from 'zustand';

interface LocalStream {
  producerId: string | null;
  track: MediaStreamTrack | null;
  enabled: boolean;
}

interface DeviceState {
  audioInput: LocalStream;
  videoInput: LocalStream;
  screenShare: LocalStream;
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;

  setAudioTrack: (track: MediaStreamTrack | null) => void;
  setVideoTrack: (track: MediaStreamTrack | null) => void;
  setScreenTrack: (track: MediaStreamTrack | null) => void;
  setAudioProducerId: (id: string | null) => void;
  setVideoProducerId: (id: string | null) => void;
  setScreenProducerId: (id: string | null) => void;
  toggleMic: () => void;
  toggleCam: () => void;
  setScreenSharing: (v: boolean) => void;
  reset: () => void;
}

const emptyStream = (): LocalStream => ({ producerId: null, track: null, enabled: true });

export const useDeviceStore = create<DeviceState>((set) => ({
  audioInput: emptyStream(),
  videoInput: emptyStream(),
  screenShare: emptyStream(),
  isMicOn: true,
  isCamOn: true,
  isScreenSharing: false,

  setAudioTrack: (track) =>
    set((s) => ({ audioInput: { ...s.audioInput, track } })),
  setVideoTrack: (track) =>
    set((s) => ({ videoInput: { ...s.videoInput, track } })),
  setScreenTrack: (track) =>
    set((s) => ({ screenShare: { ...s.screenShare, track } })),
  setAudioProducerId: (id) =>
    set((s) => ({ audioInput: { ...s.audioInput, producerId: id } })),
  setVideoProducerId: (id) =>
    set((s) => ({ videoInput: { ...s.videoInput, producerId: id } })),
  setScreenProducerId: (id) =>
    set((s) => ({ screenShare: { ...s.screenShare, producerId: id } })),

  toggleMic: () =>
    set((s) => {
      const next = !s.isMicOn;
      if (s.audioInput.track) s.audioInput.track.enabled = next;
      return { isMicOn: next };
    }),
  toggleCam: () =>
    set((s) => {
      const next = !s.isCamOn;
      if (s.videoInput.track) s.videoInput.track.enabled = next;
      return { isCamOn: next };
    }),
  setScreenSharing: (v) => set({ isScreenSharing: v }),

  reset: () =>
    set({
      audioInput: emptyStream(),
      videoInput: emptyStream(),
      screenShare: emptyStream(),
      isMicOn: true,
      isCamOn: true,
      isScreenSharing: false,
    }),
}));
