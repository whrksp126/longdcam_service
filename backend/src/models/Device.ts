import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface DeviceAttributes {
  id: string;
  user_id: string;
  label: string;
  camera_name: string;
  device_fingerprint: string;
  device_type: 'phone' | 'tablet' | 'desktop' | 'other';
  is_online: boolean;
  socket_id: string | null;
  last_seen_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

type DeviceCreationAttributes = Optional<
  DeviceAttributes,
  'id' | 'camera_name' | 'is_online' | 'socket_id' | 'last_seen_at' | 'is_active' | 'created_at' | 'updated_at'
>;

class Device extends Model<DeviceAttributes, DeviceCreationAttributes> implements DeviceAttributes {
  declare id: string;
  declare user_id: string;
  declare label: string;
  declare camera_name: string;
  declare device_fingerprint: string;
  declare device_type: 'phone' | 'tablet' | 'desktop' | 'other';
  declare is_online: boolean;
  declare socket_id: string | null;
  declare last_seen_at: Date | null;
  declare is_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

Device.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    user_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    camera_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: '',
    },
    device_fingerprint: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    device_type: {
      type: DataTypes.ENUM('phone', 'tablet', 'desktop', 'other'),
      defaultValue: 'other',
    },
    is_online: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    socket_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
    },
    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'devices',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id'] },
      { unique: true, fields: ['user_id', 'device_fingerprint'] },
    ],
  }
);

export default Device;
