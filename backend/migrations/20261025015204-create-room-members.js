'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('room_members', {
      roomId: { type: Sequelize.UUID, allowNull: false, primaryKey: true, references: { model: 'rooms', key: 'id' }, onDelete: 'CASCADE' },
      userId: { type: Sequelize.UUID, allowNull: false, primaryKey: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      joinedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('room_members');
  },
};
