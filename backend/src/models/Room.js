const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Room = sequelize.define('Room', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  isPrivate: { type: DataTypes.BOOLEAN, defaultValue: false },
  createdBy: { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'rooms', timestamps: true });

module.exports = Room;
