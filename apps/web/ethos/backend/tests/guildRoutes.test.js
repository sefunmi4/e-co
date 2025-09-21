const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

const db = newDb();
const mockPg = db.adapters.createPg();
jest.mock('pg', () => mockPg);

const { pool } = require('../db');
const guildRouter = require('../routes/guilds');

const app = express();
app.use(express.json());
app.use('/api/guilds', guildRouter);

beforeAll(async () => {
  const sql1 = fs.readFileSync(path.join(__dirname, '../migrations/001-init.sql'), 'utf8');
  const sql2 = fs.readFileSync(path.join(__dirname, '../migrations/006-guild-memberships.sql'), 'utf8');
  await pool.query(sql1);
  await pool.query(sql2);
  await pool.query("INSERT INTO users (email, hashed_password) VALUES ('owner@example.com','x')");
});

test('guild creator becomes owner and gains approved membership', async () => {
  const token = jwt.sign({ userId: 1 }, 'secret');

  const res = await request(app)
    .post('/api/guilds')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Server Guild', description: 'desc', owner_id: 999 });

  expect(res.status).toBe(201);
  expect(res.body.name).toBe('Server Guild');
  expect(res.body.owner_id).toBe(1);

  const guildRow = await pool.query('SELECT owner_id FROM guilds WHERE id = $1', [res.body.id]);
  expect(guildRow.rows[0].owner_id).toBe(1);

  const membershipRows = await pool.query('SELECT * FROM guild_memberships WHERE guild_id = $1', [res.body.id]);
  expect(membershipRows.rows).toHaveLength(1);
  expect(membershipRows.rows[0].user_id).toBe(1);
  expect(membershipRows.rows[0].role).toBe('owner');
  expect(membershipRows.rows[0].status).toBe('approved');
});
