import { Server, Socket } from 'socket.io';
import { verifyToken, JwtPayload } from '../middleware/auth';
import { mediasoupManager } from '../media/MediasoupManager';
import { generateTurnCredentials } from '../config/turn';
import { Device } from '../models';

interface Participant {
  userId: string;
  nickname: string;
  deviceId: string;
  deviceLabel: string;
  socketId: string;
  sendTransportId?: string;
  recvTransportId?: string;
  producerIds: string[];
}

const roomParticipants = new Map<string, Map<string, Participant>>();

function getRoomParticipants(roomId: string): Map<string, Participant> {
  if (!roomParticipants.has(roomId)) {
    roomParticipants.set(roomId, new Map());
  }
  return roomParticipants.get(roomId)!;
}

export function setupSocketHandlers(io: Server) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token'));
      const payload = verifyToken(token);
      (socket as any).user = payload;
      (socket as any).deviceId = socket.handshake.query.deviceId as string;
      (socket as any).deviceLabel = socket.handshake.query.deviceLabel as string || 'Unknown';
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user: JwtPayload = (socket as any).user;
    const deviceId: string = (socket as any).deviceId;
    const deviceLabel: string = (socket as any).deviceLabel;
    let currentRoomId: string | null = null;

    console.log(`Socket connected: ${socket.id} (${user.nickname}, device: ${deviceId})`);

    // --- Tier 1: Global connection tracking ---
    socket.join(`user:${user.userId}`);

    if (deviceId) {
      await Device.update(
        { is_online: true, socket_id: socket.id, last_seen_at: new Date() },
        { where: { id: deviceId, user_id: user.userId } }
      );

      socket.to(`user:${user.userId}`).emit('device:online', {
        deviceId,
        deviceLabel,
      });
    }

    // --- Camera remote control events ---
    socket.on('camera:requestStart', async ({ targetDeviceId, roomSlug }, callback) => {
      try {
        const targetDevice = await Device.findOne({
          where: { id: targetDeviceId, user_id: user.userId, is_active: true },
        });
        if (!targetDevice || !targetDevice.is_online || !targetDevice.socket_id) {
          return callback?.({ error: '대상 카메라가 오프라인입니다' });
        }

        io.to(targetDevice.socket_id).emit('camera:startRequested', {
          roomSlug,
          requestedBy: deviceId,
        });

        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ error: err.message });
      }
    });

    socket.on('camera:requestStop', async ({ targetDeviceId }, callback) => {
      try {
        const targetDevice = await Device.findOne({
          where: { id: targetDeviceId, user_id: user.userId, is_active: true },
        });
        if (!targetDevice || !targetDevice.socket_id) {
          return callback?.({ error: '대상 카메라를 찾을 수 없습니다' });
        }

        io.to(targetDevice.socket_id).emit('camera:stopRequested', {
          requestedBy: deviceId,
        });

        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ error: err.message });
      }
    });

    socket.on('camera:statusUpdate', ({ isInRoom, roomSlug }) => {
      socket.to(`user:${user.userId}`).emit('camera:statusUpdate', {
        deviceId,
        isInRoom,
        roomSlug: roomSlug || null,
      });
    });

    socket.on('camera:requestPowerOn', async ({ targetDeviceId }, callback) => {
      try {
        const targetDevice = await Device.findOne({
          where: { id: targetDeviceId, user_id: user.userId, is_active: true },
        });
        if (!targetDevice || !targetDevice.is_online || !targetDevice.socket_id) {
          return callback?.({ error: '대상 기기가 오프라인입니다' });
        }
        io.to(targetDevice.socket_id).emit('camera:powerOn');
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ error: err.message });
      }
    });

    socket.on('camera:requestPowerOff', async ({ targetDeviceId }, callback) => {
      try {
        const targetDevice = await Device.findOne({
          where: { id: targetDeviceId, user_id: user.userId, is_active: true },
        });
        if (!targetDevice || !targetDevice.is_online || !targetDevice.socket_id) {
          return callback?.({ error: '대상 기기가 오프라인입니다' });
        }
        io.to(targetDevice.socket_id).emit('camera:powerOff');
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ error: err.message });
      }
    });

    socket.on('camera:requestSwitchCamera', async ({ targetDeviceId, cameraIndex }, callback) => {
      try {
        const targetDevice = await Device.findOne({
          where: { id: targetDeviceId, user_id: user.userId, is_active: true },
        });
        if (!targetDevice || !targetDevice.is_online || !targetDevice.socket_id) {
          return callback?.({ error: '대상 기기가 오프라인입니다' });
        }
        io.to(targetDevice.socket_id).emit('camera:switchRequested', { cameraIndex });
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ error: err.message });
      }
    });

    socket.on('camera:cameraListUpdate', ({ cameraCount, activeIndex }) => {
      socket.to(`user:${user.userId}`).emit('camera:cameraListUpdate', {
        deviceId,
        cameraCount,
        activeIndex,
      });
    });

    // --- P2P preview signaling ---
    socket.on('preview:request', async ({ targetDeviceId }, callback) => {
      try {
        console.log(`[preview] request from ${deviceId} (socket:${socket.id}) for target ${targetDeviceId}`);
        if (targetDeviceId === deviceId) {
          console.log(`[preview] REJECTED: cannot preview self`);
          return callback?.({ error: 'cannot preview self' });
        }
        const target = await Device.findOne({
          where: { id: targetDeviceId, user_id: user.userId, is_active: true },
        });
        if (!target || !target.is_online || !target.socket_id) {
          console.log(`[preview] REJECTED: offline (found=${!!target}, online=${target?.is_online}, socketId=${target?.socket_id})`);
          return callback?.({ error: 'offline' });
        }
        if (target.socket_id === socket.id) {
          console.log(`[preview] REJECTED: target socket_id (${target.socket_id}) === requester socket.id (${socket.id})`);
          return callback?.({ error: 'target socket is self' });
        }
        console.log(`[preview] OK: sending preview:requested to target socket ${target.socket_id}`);
        const turnCredentials = generateTurnCredentials(user.userId);
        io.to(target.socket_id).emit('preview:requested', {
          viewerSocketId: socket.id,
          viewerDeviceId: deviceId,
          iceServers: turnCredentials.iceServers,
        });
        callback?.({ success: true, iceServers: turnCredentials.iceServers });
      } catch (err: any) {
        console.error(`[preview] ERROR:`, err);
        callback?.({ error: err.message });
      }
    });

    socket.on('preview:stop', async ({ targetDeviceId }) => {
      try {
        const target = await Device.findOne({
          where: { id: targetDeviceId, user_id: user.userId, is_active: true },
        });
        if (target?.socket_id) {
          io.to(target.socket_id).emit('preview:stopped', { viewerSocketId: socket.id });
        }
      } catch {}
    });

    socket.on('preview:offer', ({ targetSocketId, sdp }) => {
      const turnCredentials = generateTurnCredentials(user.userId);
      io.to(targetSocketId).emit('preview:offer', {
        streamerSocketId: socket.id,
        streamerDeviceId: deviceId,
        sdp,
        iceServers: turnCredentials.iceServers,
      });
    });

    socket.on('preview:noTrack', ({ targetSocketId, reason }) => {
      io.to(targetSocketId).emit('preview:noTrack', {
        streamerDeviceId: deviceId,
        reason,
      });
    });

    socket.on('preview:answer', ({ targetSocketId, sdp }) => {
      io.to(targetSocketId).emit('preview:answer', { viewerSocketId: socket.id, sdp });
    });

    socket.on('preview:ice', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('preview:ice', { fromSocketId: socket.id, candidate });
    });

    socket.on('camera:activeStatusUpdate', ({ isActive }) => {
      socket.to(`user:${user.userId}`).emit('camera:activeStatusUpdate', {
        deviceId,
        isActive,
      });
    });

    socket.on('device:listOnline', async (_, callback) => {
      try {
        const devices = await Device.findAll({
          where: { user_id: user.userId, is_active: true },
          attributes: ['id', 'camera_name', 'device_type', 'is_online', 'label'],
        });
        callback?.({ devices: devices.map((d) => d.toJSON()) });
      } catch (err: any) {
        callback?.({ error: err.message });
      }
    });

    // --- Tier 2: Room events (unchanged) ---
    socket.on('room:join', async ({ roomSlug }: { roomSlug: string }, callback) => {
      try {
        console.log(`[room:join] ${user.nickname}:${deviceId} joining ${roomSlug}`);
        const roomMedia = await mediasoupManager.getOrCreateRoom(roomSlug);
        currentRoomId = roomSlug;

        socket.join(roomSlug);

        const participants = getRoomParticipants(roomSlug);
        const participantKey = `${user.userId}:${deviceId}`;

        const participant: Participant = {
          userId: user.userId,
          nickname: user.nickname,
          deviceId,
          deviceLabel,
          socketId: socket.id,
          producerIds: [],
        };
        participants.set(participantKey, participant);

        const existingProducers: any[] = [];
        const room = mediasoupManager.getRoom(roomSlug);
        if (room) {
          for (const [producerId, producer] of room.producers) {
            const ownerEntry = [...participants.entries()].find(([_, p]) =>
              p.producerIds.includes(producerId)
            );
            if (ownerEntry) {
              existingProducers.push({
                producerId,
                userId: ownerEntry[1].userId,
                deviceId: ownerEntry[1].deviceId,
                deviceLabel: ownerEntry[1].deviceLabel,
                kind: producer.kind,
                appData: producer.appData,
              });
            }
          }
        }

        socket.to(roomSlug).emit('room:participantJoined', {
          userId: user.userId,
          nickname: user.nickname,
          deviceId,
          deviceLabel,
        });

        // Broadcast camera status to user's other devices
        socket.to(`user:${user.userId}`).emit('camera:statusUpdate', {
          deviceId,
          isInRoom: true,
          roomSlug,
        });

        const turnCredentials = generateTurnCredentials(user.userId);

        const participantList = [...participants.values()].map((p) => ({
          userId: p.userId,
          nickname: p.nickname,
          deviceId: p.deviceId,
          deviceLabel: p.deviceLabel,
        }));

        console.log(`[room:join] ${user.nickname}:${deviceId} joined OK (${participantList.length} participants, ${existingProducers.length} producers)`);
        callback({
          participants: participantList,
          existingProducers,
          iceServers: turnCredentials.iceServers,
        });
      } catch (err: any) {
        console.error(`[room:join] ERROR for ${user.nickname}:${deviceId}:`, err.message);
        callback({ error: err.message });
      }
    });

    socket.on('media:getRouterRtpCapabilities', async (_, callback) => {
      console.log(`[media:getRtpCaps] ${user.nickname}:${deviceId} room=${currentRoomId}`);
      if (!currentRoomId) return callback({ error: 'Not in a room' });
      const caps = mediasoupManager.getRouterRtpCapabilities(currentRoomId);
      callback({ rtpCapabilities: caps });
    });

    socket.on('media:createSendTransport', async (_, callback) => {
      try {
        console.log(`[media:createSendTransport] ${user.nickname}:${deviceId} room=${currentRoomId}`);
        if (!currentRoomId) return callback({ error: 'Not in a room' });
        const transportOptions = await mediasoupManager.createWebRtcTransport(currentRoomId);

        const participants = getRoomParticipants(currentRoomId);
        const key = `${user.userId}:${deviceId}`;
        const participant = participants.get(key);
        if (participant) participant.sendTransportId = transportOptions.id;

        callback(transportOptions);
      } catch (err: any) {
        callback({ error: err.message });
      }
    });

    socket.on('media:createRecvTransport', async (_, callback) => {
      try {
        console.log(`[media:createRecvTransport] ${user.nickname}:${deviceId} room=${currentRoomId}`);
        if (!currentRoomId) return callback({ error: 'Not in a room' });
        const transportOptions = await mediasoupManager.createWebRtcTransport(currentRoomId);

        const participants = getRoomParticipants(currentRoomId);
        const key = `${user.userId}:${deviceId}`;
        const participant = participants.get(key);
        if (participant) participant.recvTransportId = transportOptions.id;

        callback(transportOptions);
      } catch (err: any) {
        callback({ error: err.message });
      }
    });

    socket.on('media:connectTransport', async ({ transportId, dtlsParameters }, callback) => {
      try {
        if (!currentRoomId) return callback({ error: 'Not in a room' });
        await mediasoupManager.connectTransport(currentRoomId, transportId, dtlsParameters);
        callback({});
      } catch (err: any) {
        callback({ error: err.message });
      }
    });

    socket.on('media:produce', async ({ transportId, kind, rtpParameters, appData }, callback) => {
      try {
        if (!currentRoomId) return callback({ error: 'Not in a room' });

        const producer = await mediasoupManager.produce(
          currentRoomId,
          transportId,
          kind,
          rtpParameters,
          { ...appData, userId: user.userId, deviceId, deviceLabel }
        );

        const participants = getRoomParticipants(currentRoomId);
        const key = `${user.userId}:${deviceId}`;
        const participant = participants.get(key);
        if (participant) participant.producerIds.push(producer.id);

        socket.to(currentRoomId).emit('media:newProducer', {
          producerId: producer.id,
          userId: user.userId,
          deviceId,
          deviceLabel,
          kind: producer.kind,
          appData: producer.appData,
        });

        callback({ producerId: producer.id });
      } catch (err: any) {
        callback({ error: err.message });
      }
    });

    socket.on('media:consume', async ({ producerId, rtpCapabilities }, callback) => {
      try {
        if (!currentRoomId) return callback({ error: 'Not in a room' });

        const participants = getRoomParticipants(currentRoomId);
        const key = `${user.userId}:${deviceId}`;
        const participant = participants.get(key);
        if (!participant?.recvTransportId) return callback({ error: 'No recv transport' });

        const consumer = await mediasoupManager.consume(
          currentRoomId,
          participant.recvTransportId,
          producerId,
          rtpCapabilities
        );

        callback({
          consumerId: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          appData: consumer.appData,
        });
      } catch (err: any) {
        callback({ error: err.message });
      }
    });

    socket.on('media:resumeConsumer', async ({ consumerId }) => {
      if (!currentRoomId) return;
      await mediasoupManager.resumeConsumer(currentRoomId, consumerId);
    });

    socket.on('media:pauseConsumer', async ({ consumerId }) => {
      if (!currentRoomId) return;
      await mediasoupManager.pauseConsumer(currentRoomId, consumerId);
    });

    socket.on('media:pauseProducer', async ({ producerId }) => {
      if (!currentRoomId) return;
      await mediasoupManager.pauseProducer(currentRoomId, producerId);
      socket.to(currentRoomId).emit('media:producerPaused', { producerId });
    });

    socket.on('media:resumeProducer', async ({ producerId }) => {
      if (!currentRoomId) return;
      await mediasoupManager.resumeProducer(currentRoomId, producerId);
      socket.to(currentRoomId).emit('media:producerResumed', { producerId });
    });

    socket.on('media:closeProducer', async ({ producerId }) => {
      if (!currentRoomId) return;
      await mediasoupManager.closeProducer(currentRoomId, producerId);

      const participants = getRoomParticipants(currentRoomId);
      const key = `${user.userId}:${deviceId}`;
      const participant = participants.get(key);
      if (participant) {
        participant.producerIds = participant.producerIds.filter((id) => id !== producerId);
      }

      socket.to(currentRoomId).emit('media:producerClosed', {
        producerId,
        userId: user.userId,
        deviceId,
      });
    });

    socket.on('media:setPreferredLayers', async ({ consumerId, spatialLayer, temporalLayer }) => {
      if (!currentRoomId) return;
      await mediasoupManager.setPreferredLayers(currentRoomId, consumerId, spatialLayer, temporalLayer);
    });

    socket.on('room:leave', () => {
      handleRoomLeave();
    });

    socket.on('disconnect', (reason) => {
      handleDisconnect(reason);
    });

    function handleRoomLeave() {
      if (!currentRoomId) return;

      const participants = getRoomParticipants(currentRoomId);
      const key = `${user.userId}:${deviceId}`;
      const participant = participants.get(key);

      if (participant) {
        const transportIds: string[] = [];
        if (participant.sendTransportId) transportIds.push(participant.sendTransportId);
        if (participant.recvTransportId) transportIds.push(participant.recvTransportId);
        mediasoupManager.cleanupTransports(currentRoomId!, transportIds);

        for (const producerId of participant.producerIds) {
          socket.to(currentRoomId!).emit('media:producerClosed', {
            producerId,
            userId: user.userId,
            deviceId,
          });
        }

        participants.delete(key);
      }

      socket.to(currentRoomId!).emit('room:participantLeft', {
        userId: user.userId,
        deviceId,
      });

      // Broadcast camera status to user's other devices
      socket.to(`user:${user.userId}`).emit('camera:statusUpdate', {
        deviceId,
        isInRoom: false,
        roomSlug: null,
      });

      if (participants.size === 0) {
        mediasoupManager.closeRoom(currentRoomId!);
        roomParticipants.delete(currentRoomId!);
      }

      socket.leave(currentRoomId!);
      currentRoomId = null;
    }

    async function handleDisconnect(reason?: string) {
      handleRoomLeave();

      if (deviceId) {
        await Device.update(
          { is_online: false, socket_id: null },
          { where: { id: deviceId, user_id: user.userId } }
        );

        socket.to(`user:${user.userId}`).emit('device:offline', {
          deviceId,
        });
      }

      console.log(`Socket disconnected: ${socket.id} (${user.nickname}) reason=${reason}`);
    }
  });
}
