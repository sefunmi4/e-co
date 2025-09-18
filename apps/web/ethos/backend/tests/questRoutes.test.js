const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

// setup in-memory pg and mock
const db = newDb();
const mockPg = db.adapters.createPg();
jest.mock('pg', () => mockPg);

const { pool } = require('../db');
const questRouter = require('../routes/quests');

const app = express();
app.use(express.json());
app.use('/api/quests', questRouter);

beforeAll(async () => {
  const sql1 = fs.readFileSync(path.join(__dirname, '../migrations/001-init.sql'), 'utf8');
  const sql2 = fs.readFileSync(path.join(__dirname, '../migrations/007-quest-guild-id.sql'), 'utf8');
  await pool.query(sql1);
  await pool.query(sql2);
  await pool.query("INSERT INTO users (email, hashed_password) VALUES ('test@example.com','x')");
});

test('quest router CRUD', async () => {
  const token = jwt.sign({ userId: 1 }, 'secret');
  const createRes = await request(app)
    .post('/api/quests')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Quest 1', description: 'desc', user_id: 1 });
  expect(createRes.status).toBe(201);
  const questId = createRes.body.id;

  const listRes = await request(app)
    .get('/api/quests')
    .set('Authorization', `Bearer ${token}`);
  expect(listRes.body.length).toBe(1);

  const singleRes = await request(app)
    .get(`/api/quests/${questId}`)
    .set('Authorization', `Bearer ${token}`);
  expect(singleRes.body.title).toBe('Quest 1');
});
