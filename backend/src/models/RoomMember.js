const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const RoomMember = sequelize.define('RoomMember', {
  roomId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  joinedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'room_members', timestamps: false });

module.exports = RoomMember;
