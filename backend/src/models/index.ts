import sequelize from '../config/database';
import User from './User';
import Device from './Device';
import Room from './Room';
import RoomMember from './RoomMember';
import RoomSession from './RoomSession';
import MediaFile from './MediaFile';

User.hasMany(Device, { foreignKey: 'user_id', as: 'devices' });
Device.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Room, { foreignKey: 'owner_id', as: 'ownedRooms' });
Room.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

Room.hasMany(RoomMember, { foreignKey: 'room_id', as: 'members' });
RoomMember.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });
RoomMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Room.hasMany(RoomSession, { foreignKey: 'room_id', as: 'sessions' });
RoomSession.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });
RoomSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
RoomSession.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

Room.hasMany(MediaFile, { foreignKey: 'room_id', as: 'mediaFiles' });
MediaFile.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });
MediaFile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

export { sequelize, User, Device, Room, RoomMember, RoomSession, MediaFile };
