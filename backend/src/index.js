require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const createSessionMiddleware = require('./config/session');
const { attachUser } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const setupSocket = require('./socket');
const sequelize = require('./config/db');

const app = express();
const server = http.createServer(app);

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

const sessionMiddleware = createSessionMiddleware();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(attachUser);

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.use(errorHandler);

const io = setupSocket(server, sessionMiddleware);

const PORT = process.env.PORT || 3001;
(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
  } catch (e) {
    console.error('DB connection failed:', e.message);
  }
  server.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });
})();

module.exports = { app, server, io };
