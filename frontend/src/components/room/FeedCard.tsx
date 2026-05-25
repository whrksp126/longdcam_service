import { useRef, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { MicOff, Monitor } from 'lucide-react';

interface FeedCardProps {
  track: MediaStreamTrack | null;
  label: string;
  deviceLabel: string;
  isMuted?: boolean;
  isLocal?: boolean;
  isScreen?: boolean;
  className?: string;
  onClick?: () => void;
}

export const FeedCard = memo(function FeedCard({
  track,
  label,
  deviceLabel,
  isMuted,
  isLocal,
  isScreen,
  className = '',
  onClick,
}: FeedCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current || !track) return;
    const stream = new MediaStream([track]);
    videoRef.current.srcObject = stream;
  }, [track]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`feed-card relative group cursor-pointer ${className}`}
      onClick={onClick}
    >
      {track ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || track.kind === 'video'}
          className={`w-full h-full object-cover ${isLocal && !isScreen ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-dark-800">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-2xl font-bold text-white/50">
            {label[0]?.toUpperCase()}
          </div>
        </div>
      )}

      {/* Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{label}</span>
          <span className="text-xs text-white/40 truncate">{deviceLabel}</span>
          {isMuted && (
            <span className="ml-auto bg-danger/80 rounded-full w-5 h-5 flex items-center justify-center">
              <MicOff size={12} />
            </span>
          )}
          {isScreen && (
            <span className="bg-secondary/80 rounded-full px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
              <Monitor size={10} /> 화면공유
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});
