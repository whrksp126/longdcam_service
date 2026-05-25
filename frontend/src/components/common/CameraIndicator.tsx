import { useState, useEffect } from 'react';
import { useAlwaysOnCamera } from '../../services/alwaysOnCamera';
import { PermissionDeniedModal } from './PermissionDeniedModal';

export function CameraIndicator() {
  const { isActive, error, errorType } = useAlwaysOnCamera();
  const [showPermModal, setShowPermModal] = useState(false);

  useEffect(() => {
    if (errorType === 'permission') {
      setShowPermModal(true);
    }
  }, [errorType]);

  useEffect(() => {
    if (!error) {
      setShowPermModal(false);
    }
  }, [error]);

  if (error) {
    return (
      <>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-danger/90 text-white text-xs text-center py-1.5 px-4 cursor-pointer"
          onClick={() => errorType === 'permission' && setShowPermModal(true)}
        >
          카메라 오류: {error}
          {errorType === 'permission' && (
            <span className="ml-2 underline">권한 설정</span>
          )}
        </div>
        <PermissionDeniedModal
          isOpen={showPermModal}
          onClose={() => setShowPermModal(false)}
        />
      </>
    );
  }

  if (!isActive) return null;

  return (
    <div className="fixed top-0 right-0 z-50 m-3">
      <div className="flex items-center gap-1.5 bg-dark-800/80 backdrop-blur-sm rounded-full px-3 py-1.5">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs text-white/70">카메라 활성</span>
      </div>
    </div>
  );
}
