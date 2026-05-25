import { DataTypes, Model, Op, Optional } from 'sequelize';
import sequelize from '../config/database';

interface UserAttributes {
  id: string;
  nickname: string;
  avatar_url: string | null;
  password_hash: string | null;
  auth_provider: 'local' | 'google';
  auth_provider_id: string | null;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

type UserCreationAttributes = Optional<UserAttributes, 'id' | 'avatar_url' | 'password_hash' | 'auth_provider' | 'auth_provider_id' | 'email' | 'created_at' | 'updated_at'>;

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare nickname: string;
  declare avatar_url: string | null;
  declare password_hash: string | null;
  declare auth_provider: 'local' | 'google';
  declare auth_provider_id: string | null;
  declare email: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

User.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    nickname: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    auth_provider: {
      type: DataTypes.ENUM('local', 'google'),
      defaultValue: 'local',
    },
    auth_provider_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'users',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['email'], where: { email: { [Op.ne]: null } } },
    ],
  }
);

export default User;
