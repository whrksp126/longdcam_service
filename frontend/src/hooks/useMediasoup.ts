import { useRef, useCallback } from 'react';
import { Device } from 'mediasoup-client';
import type { types } from 'mediasoup-client';
type Transport = types.Transport;
type Producer = types.Producer;
type Consumer = types.Consumer;
type RtpCapabilities = types.RtpCapabilities;
import { emitWithAck } from '../lib/socket';
import { useDeviceStore } from '../stores/deviceStore';
import { useRoomStore } from '../stores/roomStore';

export function useMediasoup() {
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map());
  const consumersRef = useRef<Map<string, Consumer>>(new Map());

  const { setAudioProducerId, setVideoProducerId, setScreenProducerId } = useDeviceStore();
  const { addConsumer, removeConsumer } = useRoomStore();

  const loadDevice = useCallback(async () => {
    const { rtpCapabilities } = await emitWithAck<{ rtpCapabilities: RtpCapabilities }>(
      'media:getRouterRtpCapabilities'
    );

    const device = new Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
    deviceRef.current = device;

    return device;
  }, []);

  const createSendTransport = useCallback(async () => {
    const transportOptions = await emitWithAck<any>('media:createSendTransport');

    const transport = deviceRef.current!.createSendTransport(transportOptions);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      emitWithAck('media:connectTransport', {
        transportId: transport.id,
        dtlsParameters,
      })
        .then(() => callback())
        .catch(errback);
    });

    transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
      emitWithAck<{ producerId: string }>('media:produce', {
        transportId: transport.id,
        kind,
        rtpParameters,
        appData,
      })
        .then(({ producerId }) => callback({ id: producerId }))
        .catch(errback);
    });

    sendTransportRef.current = transport;
    return transport;
  }, []);

  const createRecvTransport = useCallback(async () => {
    const transportOptions = await emitWithAck<any>('media:createRecvTransport');

    const transport = deviceRef.current!.createRecvTransport(transportOptions);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      emitWithAck('media:connectTransport', {
        transportId: transport.id,
        dtlsParameters,
      })
        .then(() => callback())
        .catch(errback);
    });

    recvTransportRef.current = transport;
    return transport;
  }, []);

  const produce = useCallback(async (track: MediaStreamTrack, appData: Record<string, unknown> = {}) => {
    if (!sendTransportRef.current) return null;

    const encodings = track.kind === 'video'
      ? [
          { maxBitrate: 100000, scaleResolutionDownBy: 4, rid: 'r0' },
          { maxBitrate: 300000, scaleResolutionDownBy: 2, rid: 'r1' },
          { maxBitrate: 1000000, scaleResolutionDownBy: 1, rid: 'r2' },
        ]
      : undefined;

    const producer = await sendTransportRef.current.produce({
      track,
      encodings,
      codecOptions: track.kind === 'video'
        ? { videoGoogleStartBitrate: 1000 }
        : { opusStereo: true, opusDtx: true },
      appData,
    });

    producersRef.current.set(producer.id, producer);

    if (appData.mediaType === 'screen') {
      setScreenProducerId(producer.id);
    } else if (track.kind === 'audio') {
      setAudioProducerId(producer.id);
    } else {
      setVideoProducerId(producer.id);
    }

    return producer;
  }, [setAudioProducerId, setVideoProducerId, setScreenProducerId]);

  const consume = useCallback(async (producerId: string) => {
    if (!recvTransportRef.current || !deviceRef.current) return null;

    const result = await emitWithAck<any>('media:consume', {
      producerId,
      rtpCapabilities: deviceRef.current.rtpCapabilities,
    });

    const consumer = await recvTransportRef.current.consume({
      id: result.consumerId,
      producerId: result.producerId,
      kind: result.kind,
      rtpParameters: result.rtpParameters,
    });

    consumersRef.current.set(consumer.id, consumer);

    addConsumer({
      consumerId: consumer.id,
      producerId: result.producerId,
      userId: result.appData?.userId,
      deviceId: result.appData?.deviceId,
      kind: consumer.kind as 'audio' | 'video',
      track: consumer.track,
      paused: false,
    });

    await emitWithAck('media:resumeConsumer', { consumerId: consumer.id });

    return consumer;
  }, [addConsumer]);

  const closeProducer = useCallback(async (producerId: string) => {
    const producer = producersRef.current.get(producerId);
    if (producer) {
      producer.close();
      producersRef.current.delete(producerId);
      await emitWithAck('media:closeProducer', { producerId }).catch(() => {});
    }
  }, []);

  const pauseConsumer = useCallback(async (consumerId: string) => {
    await emitWithAck('media:pauseConsumer', { consumerId }).catch(() => {});
  }, []);

  const resumeConsumer = useCallback(async (consumerId: string) => {
    await emitWithAck('media:resumeConsumer', { consumerId }).catch(() => {});
  }, []);

  const cleanup = useCallback(() => {
    for (const producer of producersRef.current.values()) {
      producer.close();
    }
    producersRef.current.clear();

    for (const consumer of consumersRef.current.values()) {
      consumer.close();
      removeConsumer(consumer.id);
    }
    consumersRef.current.clear();

    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current = null;
  }, [removeConsumer]);

  return {
    device: deviceRef,
    loadDevice,
    createSendTransport,
    createRecvTransport,
    produce,
    consume,
    closeProducer,
    pauseConsumer,
    resumeConsumer,
    cleanup,
    producersRef,
    consumersRef,
  };
}
