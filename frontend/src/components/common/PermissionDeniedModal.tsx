import { useState } from 'react';
import { Camera, Settings } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useAlwaysOnCamera } from '../../services/alwaysOnCamera';

interface PermissionDeniedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getBrowserName(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  if (ua.includes('firefox')) return 'firefox';
  return 'chrome';
}

export function PermissionDeniedModal({ isOpen, onClose }: PermissionDeniedModalProps) {
  const [retrying, setRetrying] = useState(false);
  const browser = getBrowserName();

  async function handleRetry() {
    setRetrying(true);
    try {
      await useAlwaysOnCamera.getState().start();
      const { errorType } = useAlwaysOnCamera.getState();
      if (!errorType) {
        onClose();
      }
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="카메라/마이크 권한 필요">
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Camera className="w-8 h-8 text-primary" />
          </div>
        </div>

        <p className="text-sm text-white/60 text-center">
          카메라와 마이크를 사용하려면 브라우저 권한을 허용해야 합니다.
        </p>

        <div className="glass rounded-btn p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-white/80">
            <Settings size={14} />
            <span>권한 설정 방법</span>
          </div>

          {browser === 'safari' ? (
            <ol className="text-xs text-white/50 space-y-1 list-decimal list-inside">
              <li>Safari 메뉴 &gt; 이 웹사이트 설정</li>
              <li>카메라, 마이크를 &quot;허용&quot;으로 변경</li>
              <li>페이지 새로고침</li>
            </ol>
          ) : browser === 'firefox' ? (
            <ol className="text-xs text-white/50 space-y-1 list-decimal list-inside">
              <li>주소창 왼쪽 자물쇠 아이콘 클릭</li>
              <li>카메라, 마이크 권한을 &quot;허용&quot;으로 변경</li>
              <li>페이지 새로고침</li>
            </ol>
          ) : (
            <ol className="text-xs text-white/50 space-y-1 list-decimal list-inside">
              <li>주소창 왼쪽 자물쇠 아이콘 클릭</li>
              <li>카메라, 마이크를 &quot;허용&quot;으로 변경</li>
              <li>아래 &quot;다시 시도&quot; 클릭</li>
            </ol>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            나중에
          </Button>
          <Button className="flex-1" loading={retrying} onClick={handleRetry}>
            다시 시도
          </Button>
        </div>
      </div>
    </Modal>
  );
}
