require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const { authenticateToken } = require('./auth');
const { runMigrations } = require('./migrate');
const { init } = require('./socket');

const questsRouter = require('./routes/quests');
const guildsRouter = require('./routes/guilds');
const questLogsRouter = require('./routes/questLogs');
const notificationsRouter = require('./routes/notifications');
const partyMessagesRouter = require('./routes/partyMessages');
const partyMembershipsRouter = require('./routes/partyMemberships');
const bugReportsRouter = require('./routes/bugReports');
const teamApplicationsRouter = require('./routes/teamApplications');
const questLikesRouter = require('./routes/questLikes');
const questCommentsRouter = require('./routes/questComments');
const guildMembershipsRouter = require('./routes/guildMemberships');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = init(server);
io.on('connection', () => {
  console.log('client connected');
});

// run migrations on startup
runMigrations().catch(err => {
  console.error('Failed to run migrations', err);
  process.exit(1);
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.send('ok');
  } catch (err) {
    res.status(500).send('db error');
  }
});

app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, hashed_password) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, hashed]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'email already registered' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'internal server error' });
    }
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }
  try {
    const result = await pool.query(
      'SELECT id, email, hashed_password FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const valid = await bcrypt.compare(password, user.hashed_password);
    if (!valid) return res.status(401).json({ error: 'invalid credentials' });
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// entity routes
app.use('/api/quests', questsRouter);
app.use('/api/guilds', guildsRouter);
app.use('/api/quest_logs', questLogsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/party_memberships', partyMembershipsRouter);
app.use('/api/party_messages', partyMessagesRouter);
app.use('/api/bug_reports', bugReportsRouter);
app.use('/api/team_applications', teamApplicationsRouter);
app.use('/api/quest_likes', questLikesRouter);
app.use('/api/quest_comments', questCommentsRouter);
app.use('/api/guild_memberships', guildMembershipsRouter);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
