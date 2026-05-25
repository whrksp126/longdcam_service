import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Tablet, Monitor, Camera } from 'lucide-react';
import { useCameraStore } from '../../stores/cameraStore';
import { useAuthStore } from '../../stores/authStore';
import { emitWithAck } from '../../lib/socket';
import { showToast } from '../common/Toast';

interface CameraControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomSlug: string;
}

function DeviceIcon({ type, size = 18 }: { type: string; size?: number }) {
  switch (type) {
    case 'phone': return <Smartphone size={size} />;
    case 'tablet': return <Tablet size={size} />;
    case 'desktop': return <Monitor size={size} />;
    default: return <Camera size={size} />;
  }
}

export function CameraControlPanel({ isOpen, onClose, currentRoomSlug }: CameraControlPanelProps) {
  const { cameras, fetchCameras } = useCameraStore();
  const { deviceId } = useAuthStore();
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchCameras(deviceId);
    }
  }, [isOpen, deviceId, fetchCameras]);

  async function handleToggleCamera(camId: string, isCurrentlyInRoom: boolean) {
    setTogglingIds((prev) => new Set(prev).add(camId));

    try {
      if (isCurrentlyInRoom) {
        await emitWithAck('camera:requestStop', { targetDeviceId: camId });
        showToast('카메라 중지 요청을 보냈습니다', 'info');
      } else {
        await emitWithAck('camera:requestStart', { targetDeviceId: camId, roomSlug: currentRoomSlug });
        showToast('카메라 시작 요청을 보냈습니다', 'info');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(camId);
        return next;
      });
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-80 max-w-full glass-strong z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="font-display font-bold text-lg">카메라 관리</h3>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cameras.map((cam) => {
                const isCurrentDevice = cam.isCurrentDevice;
                const isOffline = !cam.isOnline && !isCurrentDevice;
                const isToggling = togglingIds.has(cam.id);

                return (
                  <div
                    key={cam.id}
                    className={`rounded-xl p-3 flex items-center gap-3 ${
                      isOffline ? 'opacity-40' : 'glass'
                    }`}
                  >
                    <div className="text-white/60">
                      <DeviceIcon type={cam.deviceType} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {cam.cameraName}
                        {isCurrentDevice && (
                          <span className="text-xs text-primary ml-1">(현재)</span>
                        )}
                      </p>
                      <p className="text-xs text-white/30">
                        {isOffline ? (
                          '오프라인'
                        ) : cam.isInRoom ? (
                          <span className="text-green-400">스트리밍 중</span>
                        ) : (
                          <span className="text-yellow-400">대기 중</span>
                        )}
                      </p>
                    </div>

                    {!isCurrentDevice && !isOffline && (
                      <button
                        onClick={() => handleToggleCamera(cam.id, cam.isInRoom)}
                        disabled={isToggling}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                          cam.isInRoom
                            ? 'bg-danger/20 text-danger hover:bg-danger/30'
                            : 'bg-primary/20 text-primary hover:bg-primary/30'
                        }`}
                      >
                        {isToggling ? '...' : cam.isInRoom ? '끄기' : '켜기'}
                      </button>
                    )}
                  </div>
                );
              })}

              {cameras.length === 0 && (
                <p className="text-sm text-white/30 text-center py-8">
                  등록된 카메라가 없습니다.
                  <br />
                  다른 기기에서 로그인하면 자동으로 등록됩니다.
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
