import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RoomMemberAttributes {
  id: string;
  room_id: string;
  user_id: string;
  role: 'owner' | 'member' | 'viewer';
  invited_at: Date;
  joined_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

type RoomMemberCreationAttributes = Optional<RoomMemberAttributes, 'id' | 'role' | 'invited_at' | 'joined_at' | 'created_at' | 'updated_at'>;

class RoomMember extends Model<RoomMemberAttributes, RoomMemberCreationAttributes> implements RoomMemberAttributes {
  declare id: string;
  declare room_id: string;
  declare user_id: string;
  declare role: 'owner' | 'member' | 'viewer';
  declare invited_at: Date;
  declare joined_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

RoomMember.init(
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
    role: {
      type: DataTypes.ENUM('owner', 'member', 'viewer'),
      defaultValue: 'member',
    },
    invited_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'room_members',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['room_id'] },
      { fields: ['user_id'] },
      { unique: true, fields: ['room_id', 'user_id'] },
    ],
  }
);

export default RoomMember;
