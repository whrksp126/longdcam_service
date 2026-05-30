export interface Participant {
  userId: string;
  nickname: string;
  deviceId: string;
  deviceLabel: string;
}

export interface ProducerInfo {
  producerId: string;
  userId: string;
  deviceId: string;
  deviceLabel: string;
  kind: 'audio' | 'video';
  appData: Record<string, unknown>;
}

export interface ConsumerInfo {
  consumerId: string;
  producerId: string;
  userId: string;
  deviceId: string;
  kind: 'audio' | 'video';
  track: MediaStreamTrack;
  paused: boolean;
}

export interface RoomInfo {
  id: string;
  name: string;
  slug: string;
  hasPin: boolean;
  maxParticipants: number;
  allowViewers: boolean;
}

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';

export type LayoutMode = 'grid' | 'spotlight';
