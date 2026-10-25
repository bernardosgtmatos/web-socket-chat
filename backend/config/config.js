require('dotenv').config();
const url = process.env.DATABASE_URL;
const useSsl = /supabase/i.test(url || '') || process.env.NODE_ENV === 'production';
const sslOpts = useSsl ? { ssl: { require: true, rejectUnauthorized: false } } : {};
module.exports = {
  development: {
    use_env_variable: 'DATABASE_URL',
    url,
    dialect: 'postgres',
    dialectOptions: sslOpts,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  },
  test: {
    use_env_variable: 'DATABASE_URL',
    url,
    dialect: 'postgres',
    dialectOptions: sslOpts,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    url,
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  },
};
