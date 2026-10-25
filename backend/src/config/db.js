const { Sequelize } = require('sequelize');
require('dotenv').config();

const url = process.env.DATABASE_URL;
const useSsl = /supabase/i.test(url || '') || process.env.NODE_ENV === 'production';

const sequelize = new Sequelize(url, {
  dialect: 'postgres',
  dialectOptions: useSsl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  logging: false,
});

module.exports = sequelize;
