import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface MediaFileAttributes {
  id: string;
  room_id: string;
  user_id: string;
  type: 'capture' | 'recording';
  file_key: string;
  file_size: number;
  duration: number | null;
  thumbnail_key: string | null;
  created_at: Date;
  updated_at: Date;
}

type MediaFileCreationAttributes = Optional<MediaFileAttributes, 'id' | 'duration' | 'thumbnail_key' | 'created_at' | 'updated_at'>;

class MediaFile extends Model<MediaFileAttributes, MediaFileCreationAttributes> implements MediaFileAttributes {
  declare id: string;
  declare room_id: string;
  declare user_id: string;
  declare type: 'capture' | 'recording';
  declare file_key: string;
  declare file_size: number;
  declare duration: number | null;
  declare thumbnail_key: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

MediaFile.init(
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
    type: {
      type: DataTypes.ENUM('capture', 'recording'),
      allowNull: false,
    },
    file_key: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    thumbnail_key: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'media_files',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['room_id'] },
      { fields: ['user_id'] },
    ],
  }
);

export default MediaFile;
