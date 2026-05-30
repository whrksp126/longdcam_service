import { motion } from 'framer-motion';
import { ConnectionIndicator } from '../connection/ConnectionIndicator';
import { useRoomStore } from '../../stores/roomStore';

/** Slim in-room info bar. Laid out as a normal flex child (no fixed overlap). */
export function TopBar() {
  const { roomName, participants } = useRoomStore();

  const uniqueUsers = new Set(participants.map((p) => p.userId)).size;
  const totalDevices = participants.length;

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="shrink-0 safe-area-pt px-3 pt-2"
    >
      <div className="flex items-center gap-2 min-w-0 px-1">
        <ConnectionIndicator />
        <h2 className="text-sm font-semibold truncate">{roomName}</h2>
        <span className="text-[11px] text-white/35 shrink-0">
          · {uniqueUsers}명 · 기기 {totalDevices}
        </span>
      </div>
    </motion.div>
  );
}
