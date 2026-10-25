const sequelize = require('../config/db');
const User = require('./User');
const Room = require('./Room');
const Message = require('./Message');
const RoomMember = require('./RoomMember');

User.hasMany(Room, { foreignKey: 'createdBy', as: 'rooms' });
Room.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Room.hasMany(Message, { foreignKey: 'roomId', as: 'messages' });
Message.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

User.hasMany(Message, { foreignKey: 'userId', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'userId', as: 'author' });

Room.hasMany(RoomMember, { foreignKey: 'roomId', as: 'members' });
RoomMember.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

User.hasMany(RoomMember, { foreignKey: 'userId', as: 'memberships' });
RoomMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = { sequelize, User, Room, Message, RoomMember };
