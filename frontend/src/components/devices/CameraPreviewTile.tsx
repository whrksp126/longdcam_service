import { useEffect, useRef, useState, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Tablet, Monitor, Camera, WifiOff, Check, RefreshCw } from 'lucide-react';
import { requestPreview, type PreviewConnection, type PreviewStatus } from '../../services/previewStream';
import { useAlwaysOnCamera } from '../../services/alwaysOnCamera';
import { emitWithAck } from '../../lib/socket';

function DeviceIcon({ type, size = 16 }: { type: string; size?: number }) {
  switch (type) {
    case 'phone': return <Smartphone size={size} />;
    case 'tablet': return <Tablet size={size} />;
    case 'desktop': return <Monitor size={size} />;
    default: return <Camera size={size} />;
  }
}

interface CameraPreviewTileProps {
  camId: string;
  cameraName: string;
  deviceType: string;
  isOnline: boolean;
  isCurrentDevice?: boolean;
  /** Current-device only: whether the user intends to join with the camera on. */
  camOn?: boolean;
  /** Remote-device lens switching (from cameraStore). */
  remoteCameraCount?: number;
  remoteCameraActiveIndex?: number;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/**
 * Selectable camera preview used in the room lobby. The current device reads the
 * always-on camera stream directly from the store (and self-heals by re-starting if the
 * track is missing); other devices pull a live P2P preview. Both support lens switching.
 */
export function CameraPreviewTile({
  camId,
  cameraName,
  deviceType,
  isOnline,
  isCurrentDevice,
  camOn = true,
  remoteCameraCount = 0,
  remoteCameraActiveIndex = 0,
  selected,
  disabled,
  onToggle,
}: CameraPreviewTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const connRef = useRef<PreviewConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('connecting');

  // Always-on store (drives the current device's preview + lens list).
  const aoStream = useAlwaysOnCamera((s) => s.stream);
  const aoError = useAlwaysOnCamera((s) => s.error);
  const availableCameras = useAlwaysOnCamera((s) => s.availableCameras);
  const activeCameraId = useAlwaysOnCamera((s) => s.activeCameraId);

  // Current device: make sure the camera is running once.
  useEffect(() => {
    if (isCurrentDevice && camOn) useAlwaysOnCamera.getState().start();
  }, [isCurrentDevice, camOn]);

  // Current device: bind the always-on stream; reflect a clear status (no endless "연결 중").
  useEffect(() => {
    if (!isCurrentDevice) return;
    if (!camOn) {
      if (videoRef.current) videoRef.current.srcObject = null;
      setStatus('no_camera');
      return;
    }
    const hasVideo = !!aoStream && aoStream.getVideoTracks().some((t) => t.readyState === 'live');
    if (videoRef.current) {
      videoRef.current.srcObject = hasVideo ? aoStream! : null;
      if (hasVideo) videoRef.current.play().catch(() => {});
    }
    setStatus(hasVideo ? 'live' : aoError ? 'failed' : 'connecting');
  }, [isCurrentDevice, camOn, aoStream, aoError]);

  const connectPreview = useCallback(() => {
    connRef.current?.close();
    connRef.current = null;
    streamRef.current = null;
    setStatus('connecting');
    connRef.current = requestPreview(
      camId,
      (stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      },
      () => {},
      (s) => setStatus(s),
    );
  }, [camId]);

  // Other devices: open a P2P preview while online.
  useEffect(() => {
    if (isCurrentDevice || !isOnline) {
      if (!isOnline) setStatus('connecting');
      return;
    }
    connectPreview();
    return () => {
      connRef.current?.close();
      connRef.current = null;
    };
  }, [isCurrentDevice, isOnline, connectPreview]);

  useEffect(() => {
    if (status === 'live' && videoRef.current && streamRef.current && !isCurrentDevice) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [status, isCurrentDevice]);

  const offline = !isOnline && !isCurrentDevice;
  const showVideo = status === 'live' && (isCurrentDevice ? camOn : isOnline);

  // Lens switching
  const localLensIndex = availableCameras.findIndex((c) => c.deviceId === activeCameraId);
  const lensCount = isCurrentDevice ? availableCameras.length : remoteCameraCount;
  const lensActive = isCurrentDevice ? localLensIndex : remoteCameraActiveIndex;

  const switchLens = (e: ReactMouseEvent, i: number) => {
    e.stopPropagation();
    if (i === lensActive) return;
    if (isCurrentDevice) {
      useAlwaysOnCamera.getState().switchCamera(availableCameras[i].deviceId).catch(() => {});
    } else {
      emitWithAck('camera:requestSwitchCamera', { targetDeviceId: camId, cameraIndex: i }).catch(() => {});
    }
  };

  const retry = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (isCurrentDevice) useAlwaysOnCamera.getState().start();
    else connectPreview();
  };

  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={() => !disabled && onToggle()}
      disabled={disabled}
      className={`relative w-full aspect-video rounded-xl overflow-hidden bg-dark-800 text-left transition-colors border-2 ${
        selected ? 'border-primary' : 'border-transparent'
      } ${offline || disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover ${isCurrentDevice ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/25">
          {offline ? (
            <div className="text-center">
              <WifiOff className="w-8 h-8 mx-auto mb-1 opacity-40" strokeWidth={1.5} />
              <p className="text-[11px]">오프라인</p>
            </div>
          ) : status === 'no_camera' ? (
            <div className="text-center">
              <Camera className="w-8 h-8 mx-auto mb-1 opacity-50" strokeWidth={1.5} />
              <p className="text-[11px] text-white/40">카메라 꺼짐</p>
            </div>
          ) : status === 'failed' ? (
            <div className="text-center">
              <button
                onClick={retry}
                className="flex items-center gap-1 mx-auto text-[11px] text-primary hover:text-primary-hover"
              >
                <RefreshCw size={12} /> 다시 시도
              </button>
            </div>
          ) : (
            <div className="text-center">
              <Camera className="w-8 h-8 mx-auto mb-1 opacity-50 animate-pulse" strokeWidth={1.5} />
              <p className="text-[11px] text-white/40">연결 중...</p>
            </div>
          )}
        </div>
      )}

      {/* LIVE badge */}
      {showVideo && (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-white/70">LIVE</span>
        </div>
      )}

      {/* Lens switcher */}
      {showVideo && lensCount > 1 && (
        <div className="absolute bottom-9 right-2 flex bg-black/60 backdrop-blur-sm rounded-full overflow-hidden">
          {Array.from({ length: lensCount }, (_, i) => (
            <span
              key={i}
              role="button"
              onClick={(e) => switchLens(e, i)}
              className={`px-2 py-0.5 text-[11px] font-bold transition-colors ${
                i === lensActive ? 'bg-primary text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              {i + 1}
            </span>
          ))}
        </div>
      )}

      {/* Selection check */}
      <div
        className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
          selected ? 'bg-primary text-white' : 'bg-black/40 text-white/40 border border-white/20'
        }`}
      >
        {selected && <Check size={14} strokeWidth={3} />}
      </div>

      {/* Name footer */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent flex items-center gap-1.5">
        <span className="text-white/70"><DeviceIcon type={deviceType} /></span>
        <span className="text-xs font-medium text-white truncate">{cameraName}</span>
        {isCurrentDevice && <span className="text-[10px] text-primary ml-auto shrink-0">이 기기</span>}
      </div>
    </motion.button>
  );
}
