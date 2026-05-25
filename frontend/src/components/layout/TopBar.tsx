import { motion } from 'framer-motion';
import { ConnectionIndicator } from '../connection/ConnectionIndicator';
import { useRoomStore } from '../../stores/roomStore';

export function TopBar() {
  const { roomName, participants } = useRoomStore();

  const uniqueUsers = new Set(participants.map((p) => p.userId)).size;
  const totalDevices = participants.length;

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-40 safe-area-pt"
    >
      <div className="glass-strong mx-3 mt-3 rounded-2xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <ConnectionIndicator />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{roomName}</h2>
            <p className="text-[11px] text-white/40">
              {uniqueUsers}명 참여 · 기기 {totalDevices}대
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
