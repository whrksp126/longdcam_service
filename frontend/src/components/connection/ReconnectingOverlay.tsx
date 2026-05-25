import { motion, AnimatePresence } from 'framer-motion';
import { useRoomStore } from '../../stores/roomStore';

export function ReconnectingOverlay() {
  const { isReconnecting } = useRoomStore();

  return (
    <AnimatePresence>
      {isReconnecting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-dark-900/80 backdrop-blur-md flex flex-col items-center justify-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-3 border-white/10 border-t-primary rounded-full mb-4"
            style={{ borderWidth: 3 }}
          />
          <p className="text-white/70 font-medium">다시 연결하는 중...</p>
          <p className="text-white/30 text-sm mt-1">네트워크 상태를 확인해주세요</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
