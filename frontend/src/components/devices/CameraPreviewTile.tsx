import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Tablet, Monitor, Camera, WifiOff, Check, RefreshCw } from 'lucide-react';
import { requestPreview, type PreviewConnection, type PreviewStatus } from '../../services/previewStream';

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
  /** Local MediaStream for the current device (skips P2P preview). */
  localStream?: MediaStream | null;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/**
 * Selectable camera preview used in the room lobby. For the current device it shows
 * the local stream; for other devices it pulls a live P2P preview (same path as the
 * camera management page). Tapping toggles whether the camera joins the room.
 */
export function CameraPreviewTile({
  camId,
  cameraName,
  deviceType,
  isOnline,
  isCurrentDevice,
  localStream,
  selected,
  disabled,
  onToggle,
}: CameraPreviewTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const connRef = useRef<PreviewConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<PreviewStatus>(isCurrentDevice ? 'live' : 'connecting');

  // Current device: bind the provided local stream directly. Treat a stream without a
  // live video track (no webcam / ended track) as "no_camera" instead of a black frame,
  // and force play() so the element starts even if autoplay is throttled.
  useEffect(() => {
    if (!isCurrentDevice) return;
    const hasVideo = !!localStream && localStream.getVideoTracks().some((t) => t.readyState === 'live');
    if (videoRef.current) {
      videoRef.current.srcObject = hasVideo ? localStream! : null;
      if (hasVideo) videoRef.current.play().catch(() => {});
    }
    setStatus(hasVideo ? 'live' : 'no_camera');
  }, [isCurrentDevice, localStream]);

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
  const showVideo = status === 'live' && (isCurrentDevice ? !!localStream : isOnline);

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
                onClick={(e) => { e.stopPropagation(); connectPreview(); }}
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
