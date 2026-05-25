import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { getDeviceFingerprint, getDeviceType } from '../lib/fingerprint';
import { showToast } from '../components/common/Toast';
import { LoadingScreen } from '../components/common/LoadingScreen';

const deviceTypeLabel: Record<string, string> = {
  phone: '휴대폰',
  tablet: '태블릿',
  desktop: '데스크톱',
  other: '기기',
};

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth, setDevice } = useAuthStore();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const token = searchParams.get('token');
    if (!token) {
      showToast('인증에 실패했습니다', 'error');
      navigate('/login');
      return;
    }

    setAuth(token, '', '');

    (async () => {
      try {
        const meRes = await api.getMe();
        setAuth(token, meRes.user.id, meRes.user.nickname, meRes.user.email);

        const fp = getDeviceFingerprint();
        const dt = getDeviceType();
        const devRes = await api.registerDevice({
          label: deviceTypeLabel[dt] || '기기',
          deviceFingerprint: fp,
          deviceType: dt,
        });
        setDevice(devRes.device.id, devRes.device.label);

        showToast(`${meRes.user.nickname}님, 환영합니다!`, 'success');
        navigate('/');
      } catch (err: any) {
        showToast(err.message || '인증 처리 중 오류가 발생했습니다', 'error');
        navigate('/login');
      }
    })();
  }, [searchParams, setAuth, setDevice, navigate]);

  return <LoadingScreen message="로그인 처리 중..." />;
}
