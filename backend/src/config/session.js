const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

function createSessionMiddleware() {
  const url = process.env.DATABASE_URL;
  const useSsl = /supabase/i.test(url || '') || process.env.NODE_ENV === 'production';
  const pool = new Pool({
    connectionString: url,
    ssl: useSsl ? { require: true, rejectUnauthorized: false } : false,
  });
  return session({
    store: new pgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'change-me',
    resave: false,
    saveUninitialized: false,
    name: 'sid',
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  });
}

module.exports = createSessionMiddleware;
