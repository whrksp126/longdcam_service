import { motion } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff,
  LayoutGrid, Maximize2, GalleryHorizontalEnd, PhoneOff, Cctv, Clapperboard,
} from 'lucide-react';
import { useDeviceStore } from '../../stores/deviceStore';
import { useUIStore } from '../../stores/uiStore';
import { playSound } from '../../lib/sounds';

interface BottomBarProps {
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreen: () => void;
  onLeave: () => void;
  onSwitchLayout: () => void;
  onOpenCameraPanel?: () => void;
  onOpenTheater?: () => void;
  isTheaterActive?: boolean;
}

const layoutIcons: Record<string, typeof LayoutGrid> = {
  grid: LayoutGrid,
  spotlight: Maximize2,
  carousel: GalleryHorizontalEnd,
};

export function BottomBar({ onToggleMic, onToggleCam, onToggleScreen, onLeave, onSwitchLayout, onOpenCameraPanel, onOpenTheater, isTheaterActive }: BottomBarProps) {
  const { isMicOn, isCamOn, isScreenSharing } = useDeviceStore();
  const { layoutMode } = useUIStore();

  const LayoutIcon = layoutIcons[layoutMode] || LayoutGrid;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-40 safe-area-pb"
    >
      <div className="glass-strong mx-3 mb-3 rounded-2xl px-4 py-3 flex items-center justify-center gap-3">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => { onToggleMic(); playSound('toggle'); }}
          className={`btn-icon ${isMicOn ? 'bg-dark-600 hover:bg-dark-500' : 'bg-danger hover:bg-red-600'}`}
          title={isMicOn ? '마이크 끄기' : '마이크 켜기'}
        >
          {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => { onToggleCam(); playSound('toggle'); }}
          className={`btn-icon ${isCamOn ? 'bg-dark-600 hover:bg-dark-500' : 'bg-danger hover:bg-red-600'}`}
          title={isCamOn ? '카메라 끄기' : '카메라 켜기'}
        >
          {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onToggleScreen}
          className={`btn-icon ${isScreenSharing ? 'bg-secondary text-dark-900 hover:bg-secondary-hover' : 'bg-dark-600 hover:bg-dark-500'}`}
          title="화면 공유"
        >
          {isScreenSharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}
        </motion.button>

        {onOpenCameraPanel && (
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onOpenCameraPanel}
            className="btn-icon bg-dark-600 hover:bg-dark-500"
            title="카메라 관리"
          >
            <Cctv size={20} />
          </motion.button>
        )}

        {onOpenTheater && (
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => { onOpenTheater(); playSound('toggle'); }}
            className={`btn-icon ${isTheaterActive ? 'bg-primary text-white hover:bg-primary-hover' : 'bg-dark-600 hover:bg-dark-500'}`}
            title="함께보기"
          >
            <Clapperboard size={20} />
          </motion.button>
        )}

        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onSwitchLayout}
          className="btn-icon bg-dark-600 hover:bg-dark-500"
          title="레이아웃 변경"
        >
          <LayoutIcon size={20} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onLeave}
          className="btn-icon bg-danger hover:bg-red-600"
          title="나가기"
        >
          <PhoneOff size={20} />
        </motion.button>
      </div>
    </motion.div>
  );
}
