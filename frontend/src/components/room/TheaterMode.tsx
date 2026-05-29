import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tv, Film, Play, Pause, X, Loader2, MonitorPlay } from 'lucide-react';
import type { TheaterState, TheaterSource, TheaterAction } from '../../hooks/useWatchSync';
import { api } from '../../lib/api';

interface TheaterModeProps {
  theater: TheaterState | null;
  isHost: boolean;
  onStart: (source: TheaterSource) => void;
  onStop: () => void;
  onControl: (action: TheaterAction, time?: number) => void;
  onClose: () => void;
}

const DRIFT_THRESHOLD = 0.7; // seconds
const HEARTBEAT_MS = 4000;

// --- YouTube IFrame API loader (once) ---
let ytApiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    w.onYouTubeIframeAPIReady = () => resolve(w.YT);
  });
  return ytApiPromise;
}

function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null;
    const v = u.searchParams.get('v');
    if (v) return v;
    const m = u.pathname.match(/\/(embed|shorts)\/([\w-]{11})/);
    if (m) return m[2];
  } catch {
    /* not a url */
  }
  return null;
}

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TheaterMode({ theater, isHost, onStart, onStop, onControl, onClose }: TheaterModeProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 bg-dark-900/95 backdrop-blur-sm flex flex-col"
    >
      {theater ? (
        <TheaterPlayer
          theater={theater}
          isHost={isHost}
          onStop={onStop}
          onControl={onControl}
          onClose={onClose}
        />
      ) : (
        <SourcePicker onStart={onStart} onClose={onClose} />
      )}
    </motion.div>
  );
}

// --- Source picker ---
function SourcePicker({ onStart, onClose }: { onStart: (s: TheaterSource) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'youtube' | 'library'>('youtube');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [library, setLibrary] = useState<{ key: string; name: string; size: number }[]>([]);
  const [loadingLib, setLoadingLib] = useState(false);
  const [libError, setLibError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== 'library' || library.length > 0) return;
    setLoadingLib(true);
    api
      .getMediaLibrary()
      .then((r) => setLibrary(r.items))
      .catch((e) => setLibError(e.message || '라이브러리를 불러오지 못했습니다'))
      .finally(() => setLoadingLib(false));
  }, [tab]);

  const submitYouTube = () => {
    const id = parseYouTubeId(url);
    if (!id) {
      setError('유효한 유튜브 링크가 아닙니다');
      return;
    }
    onStart({ type: 'youtube', src: id });
  };

  const pickLibrary = async (key: string, name: string) => {
    try {
      const { url: signed } = await api.getMediaUrl(key);
      onStart({ type: 'video', src: signed, title: name });
    } catch (e: any) {
      setLibError(e.message || '재생 URL을 가져오지 못했습니다');
    }
  };

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <MonitorPlay size={20} className="text-primary" /> 함께보기
        </h2>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="btn-icon bg-dark-700 hover:bg-dark-600">
          <X size={18} />
        </motion.button>
      </div>

      <div className="flex gap-2 mb-4">
        {(['youtube', 'library'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-btn text-sm font-medium transition-colors ${
              tab === t ? 'bg-primary text-white' : 'bg-dark-700 text-white/60 hover:bg-dark-600'
            }`}
          >
            {t === 'youtube' ? <Tv size={16} /> : <Film size={16} />}
            {t === 'youtube' ? '유튜브' : '홈서버 영상'}
          </button>
        ))}
      </div>

      {tab === 'youtube' ? (
        <div className="space-y-3">
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && submitYouTube()}
            placeholder="유튜브 링크 또는 영상 ID 붙여넣기"
            className="w-full bg-dark-700 border border-white/10 rounded-btn px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
          />
          {error && <p className="text-danger text-xs">{error}</p>}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={submitYouTube}
            className="w-full bg-primary hover:bg-primary-hover rounded-btn py-3 font-semibold transition-colors"
          >
            함께보기 시작
          </motion.button>
        </div>
      ) : (
        <div className="flex-1 overflow-auto -mx-1 px-1">
          {loadingLib ? (
            <div className="flex items-center justify-center py-12 text-white/40">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : libError ? (
            <p className="text-danger text-sm py-6 text-center">{libError}</p>
          ) : library.length === 0 ? (
            <p className="text-white/40 text-sm py-12 text-center">홈서버에 영상이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {library.map((item) => (
                <motion.button
                  key={item.key}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => pickLibrary(item.key, item.name)}
                  className="w-full flex items-center gap-3 bg-dark-700 hover:bg-dark-600 rounded-btn px-4 py-3 text-left transition-colors"
                >
                  <Film size={18} className="text-secondary shrink-0" />
                  <span className="text-sm font-medium truncate">{item.name}</span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Player + sync ---
function TheaterPlayer({
  theater,
  isHost,
  onStop,
  onControl,
  onClose,
}: {
  theater: TheaterState;
  isHost: boolean;
  onStop: () => void;
  onControl: (action: TheaterAction, time?: number) => void;
  onClose: () => void;
}) {
  const { source } = theater;
  const ytRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytHostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState(0);
  const [duration, setDuration] = useState(0);

  // imperative player adapter
  const getTime = useCallback(() => {
    if (source.type === 'youtube') return ytRef.current?.getCurrentTime?.() ?? 0;
    return videoRef.current?.currentTime ?? 0;
  }, [source.type]);
  const getDuration = useCallback(() => {
    if (source.type === 'youtube') return ytRef.current?.getDuration?.() ?? 0;
    return videoRef.current?.duration ?? 0;
  }, [source.type]);
  const isPaused = useCallback(() => {
    if (source.type === 'youtube') {
      // 1 = playing, 3 = buffering
      const st = ytRef.current?.getPlayerState?.();
      return st !== 1 && st !== 3;
    }
    return videoRef.current?.paused ?? true;
  }, [source.type]);
  const play = useCallback(() => {
    if (source.type === 'youtube') ytRef.current?.playVideo?.();
    else videoRef.current?.play().catch(() => {});
  }, [source.type]);
  const pause = useCallback(() => {
    if (source.type === 'youtube') ytRef.current?.pauseVideo?.();
    else videoRef.current?.pause();
  }, [source.type]);
  const seek = useCallback((t: number) => {
    if (source.type === 'youtube') ytRef.current?.seekTo?.(t, true);
    else if (videoRef.current) videoRef.current.currentTime = t;
  }, [source.type]);

  // build YouTube player
  useEffect(() => {
    if (source.type !== 'youtube') return;
    let destroyed = false;
    loadYouTubeApi().then((YT) => {
      if (destroyed || !ytHostRef.current) return;
      ytRef.current = new YT.Player(ytHostRef.current, {
        videoId: source.src,
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: () => setReady(true),
        },
      });
    });
    return () => {
      destroyed = true;
      try { ytRef.current?.destroy?.(); } catch { /* noop */ }
      ytRef.current = null;
      setReady(false);
    };
  }, [source.type, source.src]);

  // HTML5 video ready
  useEffect(() => {
    if (source.type !== 'video') return;
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => { setReady(true); setDuration(v.duration || 0); };
    v.addEventListener('loadedmetadata', onLoaded);
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, [source.type, source.src]);

  // poll position for the scrubber
  useEffect(() => {
    const id = setInterval(() => {
      setPos(getTime());
      const d = getDuration();
      if (d && d !== duration) setDuration(d);
    }, 500);
    return () => clearInterval(id);
  }, [getTime, getDuration, duration]);

  // apply remote state (everyone) — drift-corrected
  useEffect(() => {
    if (!ready) return;
    const target = theater.time;
    if (Math.abs(getTime() - target) > DRIFT_THRESHOLD) seek(target);
    if (theater.playing && isPaused()) play();
    else if (!theater.playing && !isPaused()) pause();
  }, [ready, theater.playing, theater.time, getTime, isPaused, play, pause, seek]);

  // host heartbeat keeps everyone aligned while playing
  useEffect(() => {
    if (!isHost || !ready || !theater.playing) return;
    const id = setInterval(() => onControl('seek', getTime()), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [isHost, ready, theater.playing, onControl, getTime]);

  const togglePlay = () => {
    if (theater.playing) onControl('pause', getTime());
    else onControl('play', getTime());
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 shrink-0">
        <span className="text-sm font-medium text-white/70 flex items-center gap-2 truncate">
          {source.type === 'youtube' ? <Tv size={16} className="text-primary" /> : <Film size={16} className="text-secondary" />}
          {source.title || (source.type === 'youtube' ? '유튜브 함께보기' : '함께보기')}
        </span>
        <div className="flex items-center gap-2">
          {isHost && (
            <button onClick={onStop} className="text-xs text-white/60 hover:text-danger transition-colors px-2 py-1">
              종료
            </button>
          )}
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="btn-icon bg-dark-700 hover:bg-dark-600">
            <X size={18} />
          </motion.button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center bg-black relative">
        {source.type === 'youtube' ? (
          <div className="w-full h-full">
            <div ref={ytHostRef} className="w-full h-full" />
          </div>
        ) : (
          <video
            ref={videoRef}
            src={source.src}
            playsInline
            className="w-full h-full object-contain"
          />
        )}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-white/40">
            <Loader2 size={28} className="animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 p-3">
        {isHost ? (
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={togglePlay}
              className="btn-icon bg-primary hover:bg-primary-hover text-white shrink-0"
            >
              {theater.playing ? <Pause size={20} /> : <Play size={20} />}
            </motion.button>
            <span className="text-xs text-white/50 tabular-nums w-10 text-right">{fmt(pos)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.5}
              value={Math.min(pos, duration || 0)}
              onChange={(e) => {
                const t = parseFloat(e.target.value);
                setPos(t);
                onControl('seek', t);
              }}
              className="flex-1 accent-primary"
            />
            <span className="text-xs text-white/50 tabular-nums w-10">{fmt(duration)}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs text-white/50 py-1.5">
            <AnimatePresence>
              {theater.playing && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-2 h-2 rounded-full bg-secondary"
                />
              )}
            </AnimatePresence>
            호스트가 재생을 제어하고 있습니다
          </div>
        )}
      </div>
    </div>
  );
}
