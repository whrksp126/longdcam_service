const audioCache = new Map<string, HTMLAudioElement>();

function preload(name: string, src: string) {
  const audio = new Audio(src);
  audio.preload = 'auto';
  audioCache.set(name, audio);
}

export function initSounds() {
  preload('join', '/sounds/join.mp3');
  preload('leave', '/sounds/leave.mp3');
  preload('toggle', '/sounds/toggle.mp3');
  preload('capture', '/sounds/capture.mp3');
}

export function playSound(name: string) {
  const audio = audioCache.get(name);
  if (!audio) return;
  const clone = audio.cloneNode() as HTMLAudioElement;
  clone.volume = 0.4;
  clone.play().catch(() => {});
}
