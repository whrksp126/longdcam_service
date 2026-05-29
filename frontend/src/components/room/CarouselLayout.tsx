import { useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { FeedCard } from './FeedCard';

interface FeedItem {
  id: string;
  track: MediaStreamTrack | null;
  label: string;
  deviceLabel: string;
  isMuted?: boolean;
  isLocal?: boolean;
  isScreen?: boolean;
}

interface CarouselLayoutProps {
  feeds: FeedItem[];
}

export function CarouselLayout({ feeds }: CarouselLayoutProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const paginate = useCallback(
    (newDirection: number) => {
      setDirection(newDirection);
      setCurrentIndex((prev) => {
        const next = prev + newDirection;
        if (next < 0) return feeds.length - 1;
        if (next >= feeds.length) return 0;
        return next;
      });
    },
    [feeds.length]
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const swipeThreshold = 50;
      if (info.offset.x < -swipeThreshold) {
        paginate(1);
      } else if (info.offset.x > swipeThreshold) {
        paginate(-1);
      }
    },
    [paginate]
  );

  if (feeds.length === 0) return null;

  const current = feeds[currentIndex];

  return (
    <div className="w-full h-full relative overflow-hidden">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={current.id}
          custom={direction}
          initial={{ x: direction > 0 ? '100%' : '-100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction > 0 ? '-100%' : '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          className="absolute inset-0"
        >
          <FeedCard
            track={current.track}
            label={current.label}
            deviceLabel={current.deviceLabel}
            isMuted={current.isMuted}
            isLocal={current.isLocal}
            isScreen={current.isScreen}
            consumerId={current.isLocal ? undefined : current.id}
            className="w-full h-full rounded-none"
          />
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      {feeds.length > 1 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {feeds.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > currentIndex ? 1 : -1);
                setCurrentIndex(i);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                i === currentIndex ? 'bg-white w-6' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
