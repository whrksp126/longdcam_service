import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RoomAttributes {
  id: string;
  name: string;
  slug: string;
  pin: string | null;
  owner_id: string;
  max_participants: number;
  allow_viewers: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

type RoomCreationAttributes = Optional<RoomAttributes, 'id' | 'pin' | 'max_participants' | 'allow_viewers' | 'is_active' | 'created_at' | 'updated_at'>;

class Room extends Model<RoomAttributes, RoomCreationAttributes> implements RoomAttributes {
  declare id: string;
  declare name: string;
  declare slug: string;
  declare pin: string | null;
  declare owner_id: string;
  declare max_participants: number;
  declare allow_viewers: boolean;
  declare is_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

Room.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    pin: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    owner_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    max_participants: {
      type: DataTypes.INTEGER,
      defaultValue: 8,
    },
    allow_viewers: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: 'rooms',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['owner_id'] },
      { unique: true, fields: ['slug'] },
    ],
  }
);

export default Room;
