import { useRoomStore } from '../../stores/roomStore';
import type { ConnectionQuality } from '../../types/room';

const qualityConfig: Record<ConnectionQuality, { color: string; label: string; pulse: boolean }> = {
  excellent: { color: 'bg-success', label: '매우 좋음', pulse: false },
  good: { color: 'bg-success', label: '좋음', pulse: false },
  fair: { color: 'bg-warning', label: '보통', pulse: false },
  poor: { color: 'bg-danger', label: '불안정', pulse: true },
  disconnected: { color: 'bg-dark-500', label: '연결 끊김', pulse: true },
};

export function ConnectionIndicator() {
  const { connectionQuality } = useRoomStore();
  const config = qualityConfig[connectionQuality];

  return (
    <div className="flex items-center gap-1.5" title={config.label}>
      <div className={`w-2.5 h-2.5 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`} />
    </div>
  );
}
