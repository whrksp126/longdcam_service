import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RoomSessionAttributes {
  id: string;
  room_id: string;
  user_id: string;
  device_id: string;
  socket_id: string;
  joined_at: Date;
  left_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

type RoomSessionCreationAttributes = Optional<RoomSessionAttributes, 'id' | 'joined_at' | 'left_at' | 'created_at' | 'updated_at'>;

class RoomSession extends Model<RoomSessionAttributes, RoomSessionCreationAttributes> implements RoomSessionAttributes {
  declare id: string;
  declare room_id: string;
  declare user_id: string;
  declare device_id: string;
  declare socket_id: string;
  declare joined_at: Date;
  declare left_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

RoomSession.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    room_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: 'rooms', key: 'id' },
    },
    user_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    device_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: 'devices', key: 'id' },
    },
    socket_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    joined_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    left_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'room_sessions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['room_id', 'left_at'] },
      { fields: ['socket_id'] },
    ],
  }
);

export default RoomSession;
