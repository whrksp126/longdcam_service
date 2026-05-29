import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup } from 'framer-motion';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useMediasoup } from '../hooks/useMediasoup';
import { useRoomStore } from '../stores/roomStore';
import { useDeviceStore } from '../stores/deviceStore';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { useCameraStore } from '../stores/cameraStore';
import { emitWithAck } from '../lib/socket';
import { api } from '../lib/api';
import { useAlwaysOnCamera } from '../services/alwaysOnCamera';
import { GridLayout } from '../components/room/GridLayout';
import { SpotlightLayout } from '../components/room/SpotlightLayout';
import { CarouselLayout } from '../components/room/CarouselLayout';
import { TopBar } from '../components/layout/TopBar';
import { BottomBar } from '../components/layout/BottomBar';
import { ReconnectingOverlay } from '../components/connection/ReconnectingOverlay';
import { LoadingScreen } from '../components/common/LoadingScreen';
import { CameraControlPanel } from '../components/room/CameraControlPanel';
import { TheaterMode } from '../components/room/TheaterMode';
import { useWatchSync } from '../hooks/useWatchSync';
import { Button } from '../components/common/Button';
import { showToast } from '../components/common/Toast';
import { Smartphone, Tablet, Monitor, Camera, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { initSounds, playSound } from '../lib/sounds';
import type { Participant, ProducerInfo } from '../types/room';

type RoomPhase = 'lobby' | 'connecting' | 'inRoom';

export function RoomPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { nickname, deviceId } = useAuthStore();
  const {
    setRoom, clearRoom, setParticipants, setConnecting, isConnecting, consumers,
  } = useRoomStore();
  const { isMicOn, isCamOn, setVideoTrack, setAudioTrack,
    setScreenSharing, isScreenSharing, setScreenTrack, reset: resetDevice,
  } = useDeviceStore();
  const { layoutMode, setLayoutMode, spotlightProducerId, setSpotlightProducer } = useUIStore();
  const { cameras, fetchCameras } = useCameraStore();

  const { connect, disconnect } = useSocket();
  const {
    loadDevice, createSendTransport, createRecvTransport,
    produce, consume, closeProducer, cleanup: cleanupMedia,
    producersRef, consumersRef,
  } = useMediasoup();

  const { theater, isHost, start: startTheater, stop: stopTheater, control: theaterControl } = useWatchSync();
  const [theaterPanelOpen, setTheaterPanelOpen] = useState(false);
  const [theaterHidden, setTheaterHidden] = useState(false);

  // When someone starts a session, surface it for everyone.
  useEffect(() => {
    if (theater) {
      setTheaterHidden(false);
      setTheaterPanelOpen(false);
    }
  }, [!!theater]);

  const showTheater = !theaterHidden && (!!theater || theaterPanelOpen);

  const handleOpenTheater = useCallback(() => {
    if (theater) setTheaterHidden((h) => !h);
    else setTheaterPanelOpen(true);
  }, [theater]);

  const [phase, setPhase] = useState<RoomPhase>('lobby');
  const [showCameraPanel, setShowCameraPanel] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [localScreenTrack, setLocalScreenTrack] = useState<MediaStreamTrack | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const joinedRef = useRef(false);

  // Lobby state
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [lobbyMicOn, setLobbyMicOn] = useState(true);
  const [lobbyCamOn, setLobbyCamOn] = useState(true);
  const [selectedCameras, setSelectedCameras] = useState<Set<string>>(new Set());
  const [needsPin, setNeedsPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [roomJoined, setRoomJoined] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);

  // Check if room requires PIN and if we need to join first
  useEffect(() => {
    if (!slug) return;
    const inviteToken = searchParams.get('invite');

    (async () => {
      try {
        const roomInfo = await api.getRoom(slug);
        if (roomInfo.room.hasPin && !inviteToken) {
          setNeedsPin(true);
        } else {
          await api.joinRoom(slug, undefined, inviteToken || undefined);
          setRoomJoined(true);
        }
      } catch (err: any) {
        if (err.message === 'PIN required') {
          setNeedsPin(true);
        } else {
          // Already a member, proceed
          setRoomJoined(true);
        }
      }
    })();
  }, [slug, searchParams]);

  // Use always-on camera for lobby preview
  useEffect(() => {
    if (phase !== 'lobby' || !roomJoined) return;

    fetchCameras(deviceId);

    const alwaysOn = useAlwaysOnCamera.getState();
    if (alwaysOn.stream && alwaysOn.isActive) {
      setPreviewStream(alwaysOn.stream);
    } else {
      alwaysOn.start().then(() => {
        setPreviewStream(useAlwaysOnCamera.getState().stream);
      });
    }
  }, [phase, roomJoined]);

  // Initialize selected cameras (all online by default)
  useEffect(() => {
    if (cameras.length > 0 && selectedCameras.size === 0) {
      const onlineCams = new Set(cameras.filter((c) => c.isOnline || c.isCurrentDevice).map((c) => c.id));
      setSelectedCameras(onlineCams);
    }
  }, [cameras]);

  // Preview video ref
  useEffect(() => {
    if (previewRef.current && previewStream) {
      previewRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  async function handlePinSubmit() {
    if (!slug || !pinInput) return;
    try {
      await api.joinRoom(slug, pinInput);
      setRoomJoined(true);
      setNeedsPin(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }

  function toggleCamera(camId: string) {
    setSelectedCameras((prev) => {
      const next = new Set(prev);
      if (next.has(camId)) {
        next.delete(camId);
      } else {
        next.add(camId);
      }
      return next;
    });
  }

  async function handleJoinFromLobby() {
    setPreviewStream(null);
    setPhase('connecting');

    // Request remote cameras to start
    for (const camId of selectedCameras) {
      const cam = cameras.find((c) => c.id === camId);
      if (cam && !cam.isCurrentDevice && cam.isOnline) {
        emitWithAck('camera:requestStart', { targetDeviceId: camId, roomSlug: slug }).catch(() => {});
      }
    }

    await joinRoom();
  }

  const joinRoom = useCallback(async () => {
    if (!slug || joinedRef.current) return;
    joinedRef.current = true;
    setConnecting(true);

    try {
      initSounds();
      const socket = connect();

      const result = await emitWithAck<{
        participants: Participant[];
        existingProducers: ProducerInfo[];
        iceServers: any[];
      }>('room:join', { roomSlug: slug });

      setRoom(slug, slug);
      setParticipants(result.participants);

      await loadDevice();
      await createSendTransport();
      await createRecvTransport();

      const shouldStreamCurrent = selectedCameras.has(deviceId || '');

      if (shouldStreamCurrent !== false) {
        // Use always-on camera stream if available, otherwise get new one
        const alwaysOn = useAlwaysOnCamera.getState();
        let stream = alwaysOn.stream;

        if (!stream || !stream.active) {
          try {
            await alwaysOn.start();
            stream = useAlwaysOnCamera.getState().stream;
          } catch {
            // fallback
          }
        }

        if (!stream && navigator.mediaDevices?.getUserMedia) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            });
          } catch {
            showToast('카메라/마이크 접근이 거부되었습니다', 'error');
          }
        }

        if (stream) {
          const audioTrack = stream.getAudioTracks()[0];
          const videoTrack = stream.getVideoTracks()[0];

          if (audioTrack) {
            localAudioTrackRef.current = audioTrack;
            setAudioTrack(audioTrack);
            const audioProducer = await produce(audioTrack, { mediaType: 'audio' });
            if (!lobbyMicOn && audioProducer) {
              audioTrack.stop();
              localAudioTrackRef.current = null;
              setAudioTrack(null);
              useDeviceStore.setState({ isMicOn: false });
              emitWithAck('media:pauseProducer', { producerId: audioProducer.id }).catch(() => {});
            }
          }

          if (videoTrack) {
            setLocalVideoTrack(videoTrack);
            setVideoTrack(videoTrack);
            const videoProducer = await produce(videoTrack, { mediaType: 'video' });
            if (!lobbyCamOn && videoProducer) {
              videoTrack.stop();
              setLocalVideoTrack(null);
              setVideoTrack(null);
              useDeviceStore.setState({ isCamOn: false });
              emitWithAck('media:pauseProducer', { producerId: videoProducer.id }).catch(() => {});
            }
          }
        }
      }

      for (const producer of result.existingProducers) {
        await consume(producer.producerId);
      }

      socket.on('media:newProducer', async (data: ProducerInfo) => {
        await consume(data.producerId);
      });

      // dynacast: cap how many simulcast layers we send to what viewers watch.
      // setMaxSpatialLayer caps the RTCRtpSender without disabling the track, so
      // our own self-view stays live.
      socket.on('media:producerSendChange', (data: { producerId: string; maxSpatialLayer: number }) => {
        const producer = producersRef.current.get(data.producerId);
        if (!producer || producer.kind !== 'video') return;
        producer.setMaxSpatialLayer(data.maxSpatialLayer).catch(() => {});
      });

      socket.on('media:producerClosed', (data: { producerId: string }) => {
        for (const [consumerId, consumer] of consumersRef.current) {
          if (consumer.producerId === data.producerId) {
            consumer.close();
            consumersRef.current.delete(consumerId);
          }
        }
        useRoomStore.getState().removeConsumersByProducerId(data.producerId);
      });

      playSound('join');
      setConnecting(false);
      setPhase('inRoom');
    } catch (err: any) {
      showToast(err.message || '방 참여에 실패했습니다', 'error');
      setConnecting(false);
      navigate('/');
    }
  }, [slug, connect, loadDevice, createSendTransport, createRecvTransport, produce, consume,
    setRoom, setParticipants, setConnecting, setAudioTrack, setVideoTrack, navigate,
    lobbyMicOn, lobbyCamOn, selectedCameras, deviceId]);

  useEffect(() => {
    return () => {
      // Don't stop always-on camera tracks - they belong to the app
      cleanupMedia();
      disconnect();
      clearRoom();
      resetDevice();
      joinedRef.current = false;
    };
  }, []);

  const handleToggleMic = useCallback(async () => {
    const { audioInput, isMicOn: currentMicOn } = useDeviceStore.getState();
    const audioProducerId = audioInput.producerId;

    if (currentMicOn) {
      if (audioInput.track) audioInput.track.stop();
      setAudioTrack(null);
      localAudioTrackRef.current = null;
      useDeviceStore.setState({ isMicOn: false });
      if (audioProducerId) {
        emitWithAck('media:pauseProducer', { producerId: audioProducerId }).catch(() => {});
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        const newAudioTrack = stream.getAudioTracks()[0];
        if (newAudioTrack && audioProducerId) {
          const producer = producersRef.current.get(audioProducerId);
          if (producer) {
            await producer.replaceTrack({ track: newAudioTrack });
          }
          localAudioTrackRef.current = newAudioTrack;
          setAudioTrack(newAudioTrack);
          emitWithAck('media:resumeProducer', { producerId: audioProducerId }).catch(() => {});
        }
        useDeviceStore.setState({ isMicOn: true });
      } catch {
        showToast('마이크를 다시 시작할 수 없습니다', 'error');
      }
    }
  }, [setAudioTrack]);

  const handleToggleCam = useCallback(async () => {
    const { videoInput, isCamOn: currentCamOn } = useDeviceStore.getState();
    const videoProducerId = videoInput.producerId;

    if (currentCamOn) {
      if (videoInput.track) videoInput.track.stop();
      setVideoTrack(null);
      setLocalVideoTrack(null);
      useDeviceStore.setState({ isCamOn: false });
      if (videoProducerId) {
        emitWithAck('media:pauseProducer', { producerId: videoProducerId }).catch(() => {});
      }
    } else {
      try {
        const alwaysOn = useAlwaysOnCamera.getState();
        const currentCamId = alwaysOn.activeCameraId;
        await alwaysOn.start(currentCamId || undefined);
        const newStream = useAlwaysOnCamera.getState().stream;
        const newVideoTrack = newStream?.getVideoTracks()[0];

        if (newVideoTrack && videoProducerId) {
          const producer = producersRef.current.get(videoProducerId);
          if (producer) {
            await producer.replaceTrack({ track: newVideoTrack });
          }
          setVideoTrack(newVideoTrack);
          setLocalVideoTrack(newVideoTrack);
          emitWithAck('media:resumeProducer', { producerId: videoProducerId }).catch(() => {});
        }
        useDeviceStore.setState({ isCamOn: true });
      } catch {
        showToast('카메라를 다시 시작할 수 없습니다', 'error');
      }
    }
  }, [setVideoTrack]);

  const handleToggleScreen = useCallback(async () => {
    if (isScreenSharing) {
      const screenProducerId = useDeviceStore.getState().screenShare.producerId;
      if (screenProducerId) {
        await closeProducer(screenProducerId);
      }
      localScreenTrack?.stop();
      setLocalScreenTrack(null);
      setScreenTrack(null);
      setScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const videoTrack = stream.getVideoTracks()[0];
        setLocalScreenTrack(videoTrack);
        setScreenTrack(videoTrack);
        setScreenSharing(true);
        await produce(videoTrack, { mediaType: 'screen' });

        videoTrack.onended = () => {
          handleToggleScreen();
        };
      } catch {
        showToast('화면 공유가 취소되었습니다', 'info');
      }
    }
  }, [isScreenSharing, localScreenTrack, produce, closeProducer, setScreenTrack, setScreenSharing]);

  const handleLeave = useCallback(() => {
    emitWithAck('room:leave', {}).catch(() => {});
    navigate('/');
  }, [navigate]);

  const handleSwitchLayout = useCallback(() => {
    const modes: ('grid' | 'spotlight' | 'carousel')[] = ['grid', 'spotlight', 'carousel'];
    const currentIdx = modes.indexOf(layoutMode);
    setLayoutMode(modes[(currentIdx + 1) % modes.length]);
  }, [layoutMode, setLayoutMode]);

  const feeds = useMemo(() => {
    const items: any[] = [];

    if (localVideoTrack && isCamOn) {
      items.push({
        id: 'local-video',
        track: localVideoTrack,
        label: nickname || '나',
        deviceLabel: '이 기기',
        isMuted: !isMicOn,
        isLocal: true,
      });
    }

    if (localScreenTrack) {
      items.push({
        id: 'local-screen',
        track: localScreenTrack,
        label: nickname || '나',
        deviceLabel: '화면 공유',
        isLocal: true,
        isScreen: true,
      });
    }

    for (const consumer of consumers) {
      if (consumer.kind === 'video') {
        items.push({
          id: consumer.consumerId,
          track: consumer.track,
          label: consumer.userId,
          deviceLabel: consumer.deviceId,
          isMuted: false,
          isLocal: false,
          isScreen: false,
        });
      }
    }

    if (items.length === 0 && !isCamOn) {
      items.push({
        id: 'local-placeholder',
        track: null,
        label: nickname || '나',
        deviceLabel: '카메라 꺼짐',
        isMuted: !isMicOn,
        isLocal: true,
      });
    }

    return items;
  }, [consumers, nickname, isMicOn, isCamOn, localVideoTrack, localScreenTrack]);

  // --- PIN required screen ---
  if (needsPin) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-4">
          <h2 className="text-xl font-display font-bold text-center mb-6">방 비밀번호 입력</h2>
          <input
            type="text"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
            placeholder="4~6자리 숫자"
            className="w-full bg-dark-700 border border-white/10 rounded-btn px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors text-center text-2xl tracking-widest"
            inputMode="numeric"
            autoFocus
          />
          <Button className="w-full" size="lg" onClick={handlePinSubmit}>
            확인
          </Button>
          <button
            onClick={() => navigate('/')}
            className="w-full text-sm text-white/40 hover:text-white/60 text-center"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // --- Lobby phase ---
  if (phase === 'lobby') {
    if (!roomJoined) {
      return <LoadingScreen message="방 정보를 가져오는 중..." />;
    }

    function DeviceIcon({ type }: { type: string }) {
      switch (type) {
        case 'phone': return <Smartphone size={18} />;
        case 'tablet': return <Tablet size={18} />;
        case 'desktop': return <Monitor size={18} />;
        default: return <Camera size={18} />;
      }
    }

    return (
      <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-md space-y-6">
          <h2 className="text-xl font-display font-bold text-center">방 입장 준비</h2>

          {/* Camera preview */}
          <div className="relative aspect-video bg-dark-800 rounded-xl overflow-hidden">
            {previewStream && lobbyCamOn ? (
              <video
                ref={previewRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover mirror"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-dark-700 flex items-center justify-center text-3xl font-bold text-white/30">
                  {nickname?.[0]?.toUpperCase()}
                </div>
              </div>
            )}
          </div>

          {/* Mic / Cam toggles */}
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setLobbyMicOn(!lobbyMicOn)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                lobbyMicOn ? 'bg-dark-700 text-white' : 'bg-danger text-white'
              }`}
            >
              {lobbyMicOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button
              onClick={() => setLobbyCamOn(!lobbyCamOn)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                lobbyCamOn ? 'bg-dark-700 text-white' : 'bg-danger text-white'
              }`}
            >
              {lobbyCamOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
          </div>

          {/* Camera list */}
          {cameras.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
                내 카메라
              </h3>
              <div className="space-y-2">
                {cameras.map((cam) => {
                  const isSelected = selectedCameras.has(cam.id);
                  const isDisabled = !cam.isOnline && !cam.isCurrentDevice;

                  return (
                    <button
                      key={cam.id}
                      onClick={() => !isDisabled && toggleCamera(cam.id)}
                      disabled={isDisabled}
                      className={`w-full glass rounded-btn p-3 flex items-center gap-3 transition-colors text-left ${
                        isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'
                      } ${isSelected && !isDisabled ? 'border border-primary/50' : 'border border-transparent'}`}
                    >
                      <div className="text-white/60"><DeviceIcon type={cam.deviceType} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {cam.cameraName}
                          {cam.isCurrentDevice && (
                            <span className="text-xs text-primary ml-2">(현재 기기)</span>
                          )}
                        </p>
                        <p className="text-xs text-white/30">
                          {cam.isOnline || cam.isCurrentDevice ? (
                            <span className="text-green-400">온라인</span>
                          ) : (
                            <span>오프라인</span>
                          )}
                        </p>
                      </div>
                      <div
                        className={`w-10 h-6 rounded-full transition-colors flex items-center ${
                          isSelected && !isDisabled ? 'bg-primary justify-end' : 'bg-dark-600 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white mx-1" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Join button */}
          <Button className="w-full" size="lg" onClick={handleJoinFromLobby}>
            참여하기
          </Button>

          <button
            onClick={() => navigate('/')}
            className="w-full text-sm text-white/40 hover:text-white/60 text-center"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // --- Connecting phase ---
  if (phase === 'connecting' || isConnecting) {
    return <LoadingScreen message="방에 참여하는 중..." />;
  }

  // --- In-room phase ---
  return (
    <div className="h-screen w-screen bg-dark-900 flex flex-col overflow-hidden">
      <TopBar />

      <div className="flex-1 pt-16 pb-20">
        <LayoutGroup>
          {layoutMode === 'grid' && (
            <GridLayout
              feeds={feeds}
              onFeedClick={(id) => {
                setLayoutMode('spotlight');
                setSpotlightProducer(id);
              }}
            />
          )}
          {layoutMode === 'spotlight' && (
            <SpotlightLayout
              feeds={feeds}
              spotlightId={spotlightProducerId}
              onFeedClick={(id) => setSpotlightProducer(id)}
            />
          )}
          {layoutMode === 'carousel' && <CarouselLayout feeds={feeds} />}
        </LayoutGroup>

        <AnimatePresence>
          {showTheater && (
            <TheaterMode
              theater={theater}
              isHost={isHost}
              onStart={(source) => startTheater(source).catch(() => showToast('함께보기를 시작할 수 없습니다', 'error'))}
              onStop={() => { stopTheater(); setTheaterPanelOpen(false); }}
              onControl={theaterControl}
              onClose={() => (theater ? setTheaterHidden(true) : setTheaterPanelOpen(false))}
            />
          )}
        </AnimatePresence>
      </div>

      <BottomBar
        onToggleMic={handleToggleMic}
        onToggleCam={handleToggleCam}
        onToggleScreen={handleToggleScreen}
        onLeave={handleLeave}
        onSwitchLayout={handleSwitchLayout}
        onOpenCameraPanel={() => setShowCameraPanel(true)}
        onOpenTheater={handleOpenTheater}
        isTheaterActive={!!theater}
      />

      <CameraControlPanel
        isOpen={showCameraPanel}
        onClose={() => setShowCameraPanel(false)}
        currentRoomSlug={slug || ''}
      />

      <ReconnectingOverlay />
    </div>
  );
}
