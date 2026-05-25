import * as mediasoup from 'mediasoup';
import { types as mediasoupTypes } from 'mediasoup';
import { mediasoupConfig } from '../config/mediasoup';

interface RoomMedia {
  router: mediasoupTypes.Router;
  transports: Map<string, mediasoupTypes.WebRtcTransport>;
  producers: Map<string, mediasoupTypes.Producer>;
  consumers: Map<string, mediasoupTypes.Consumer>;
}

class MediasoupManager {
  private workers: mediasoupTypes.Worker[] = [];
  private nextWorkerIdx = 0;
  private rooms: Map<string, RoomMedia> = new Map();

  async init() {
    for (let i = 0; i < mediasoupConfig.numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        rtcMinPort: mediasoupConfig.worker.rtcMinPort,
        rtcMaxPort: mediasoupConfig.worker.rtcMaxPort,
        logLevel: mediasoupConfig.worker.logLevel,
        logTags: mediasoupConfig.worker.logTags,
      });

      worker.on('died', () => {
        console.error(`mediasoup worker ${worker.pid} died, restarting...`);
        setTimeout(() => this.replaceWorker(i), 2000);
      });

      this.workers.push(worker);
      console.log(`mediasoup worker ${worker.pid} started`);
    }
  }

  private async replaceWorker(index: number) {
    const worker = await mediasoup.createWorker({
      rtcMinPort: mediasoupConfig.worker.rtcMinPort,
      rtcMaxPort: mediasoupConfig.worker.rtcMaxPort,
      logLevel: mediasoupConfig.worker.logLevel,
      logTags: mediasoupConfig.worker.logTags,
    });
    worker.on('died', () => {
      console.error(`mediasoup worker ${worker.pid} died, restarting...`);
      setTimeout(() => this.replaceWorker(index), 2000);
    });
    this.workers[index] = worker;
    console.log(`mediasoup worker replaced: pid ${worker.pid}`);
  }

  private getNextWorker(): mediasoupTypes.Worker {
    const worker = this.workers[this.nextWorkerIdx];
    this.nextWorkerIdx = (this.nextWorkerIdx + 1) % this.workers.length;
    return worker;
  }

  async getOrCreateRoom(roomId: string): Promise<RoomMedia> {
    let room = this.rooms.get(roomId);
    if (room) return room;

    const worker = this.getNextWorker();
    const router = await worker.createRouter({
      mediaCodecs: mediasoupConfig.router.mediaCodecs,
    });

    room = {
      router,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };

    this.rooms.set(roomId, room);
    console.log(`Room ${roomId} created on worker ${worker.pid}`);
    return room;
  }

  getRoom(roomId: string): RoomMedia | undefined {
    return this.rooms.get(roomId);
  }

  async createWebRtcTransport(roomId: string) {
    const room = await this.getOrCreateRoom(roomId);

    const transport = await room.router.createWebRtcTransport({
      listenIps: mediasoupConfig.webRtcTransport.listenIps,
      enableUdp: mediasoupConfig.webRtcTransport.enableUdp,
      enableTcp: mediasoupConfig.webRtcTransport.enableTcp,
      preferUdp: mediasoupConfig.webRtcTransport.preferUdp,
      initialAvailableOutgoingBitrate: mediasoupConfig.webRtcTransport.initialAvailableOutgoingBitrate,
    });

    if (mediasoupConfig.webRtcTransport.maxIncomingBitrate) {
      await transport.setMaxIncomingBitrate(mediasoupConfig.webRtcTransport.maxIncomingBitrate);
    }

    room.transports.set(transport.id, transport);

    transport.on('routerclose', () => {
      room!.transports.delete(transport.id);
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }

  async connectTransport(roomId: string, transportId: string, dtlsParameters: mediasoupTypes.DtlsParameters) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const transport = room.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');

    await transport.connect({ dtlsParameters });
  }

  async produce(
    roomId: string,
    transportId: string,
    kind: mediasoupTypes.MediaKind,
    rtpParameters: mediasoupTypes.RtpParameters,
    appData: Record<string, unknown>
  ) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const transport = room.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');

    const producer = await transport.produce({ kind, rtpParameters, appData });

    room.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      room.producers.delete(producer.id);
    });

    return producer;
  }

  async consume(
    roomId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: mediasoupTypes.RtpCapabilities
  ) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume');
    }

    const transport = room.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    room.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      room.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      room.consumers.delete(consumer.id);
    });

    return consumer;
  }

  async closeProducer(roomId: string, producerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const producer = room.producers.get(producerId);
    if (producer) {
      producer.close();
      room.producers.delete(producerId);
    }
  }

  async pauseProducer(roomId: string, producerId: string) {
    const room = this.rooms.get(roomId);
    const producer = room?.producers.get(producerId);
    if (producer) await producer.pause();
  }

  async resumeProducer(roomId: string, producerId: string) {
    const room = this.rooms.get(roomId);
    const producer = room?.producers.get(producerId);
    if (producer) await producer.resume();
  }

  async pauseConsumer(roomId: string, consumerId: string) {
    const room = this.rooms.get(roomId);
    const consumer = room?.consumers.get(consumerId);
    if (consumer) await consumer.pause();
  }

  async resumeConsumer(roomId: string, consumerId: string) {
    const room = this.rooms.get(roomId);
    const consumer = room?.consumers.get(consumerId);
    if (consumer) await consumer.resume();
  }

  async setPreferredLayers(roomId: string, consumerId: string, spatialLayer: number, temporalLayer?: number) {
    const room = this.rooms.get(roomId);
    const consumer = room?.consumers.get(consumerId);
    if (consumer && consumer.type === 'simulcast') {
      await consumer.setPreferredLayers({ spatialLayer, temporalLayer });
    }
  }

  cleanupTransports(roomId: string, transportIds: string[]) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const id of transportIds) {
      const transport = room.transports.get(id);
      if (transport) {
        transport.close();
        room.transports.delete(id);
      }
    }
  }

  closeRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.router.close();
    this.rooms.delete(roomId);
    console.log(`Room ${roomId} closed`);
  }

  getRouterRtpCapabilities(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return room.router.rtpCapabilities;
  }
}

export const mediasoupManager = new MediasoupManager();
