const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

jest.mock('../socket', () => ({
  getIo: () => ({ emit: jest.fn() })
}));

const db = newDb();
const mockPg = db.adapters.createPg();
jest.mock('pg', () => mockPg);

const { pool } = require('../db');
const membershipsRouter = require('../routes/partyMemberships');
const messagesRouter = require('../routes/partyMessages');

const app = express();
app.use(express.json());
app.use('/api/party_memberships', membershipsRouter);
app.use('/api/party_messages', messagesRouter);

beforeAll(async () => {
  let sql = fs.readFileSync(path.join(__dirname, '../migrations/001-init.sql'), 'utf8');
  await pool.query(sql);
  sql = fs.readFileSync(path.join(__dirname, '../migrations/002-realtime.sql'), 'utf8');
  await pool.query(sql);
  sql = fs.readFileSync(path.join(__dirname, '../migrations/005-party-membership.sql'), 'utf8');
  await pool.query(sql);
  await pool.query("INSERT INTO users (email, hashed_password) VALUES ('mod@example.com','x'),('user@example.com','x')");
  await pool.query("INSERT INTO party_membership (party_id, user_id, role) VALUES (1, 1, 'moderator')");
});

test('join and leave party', async () => {
  const token = jwt.sign({ userId: 2 }, 'secret');
  const joinRes = await request(app)
    .post('/api/party_memberships')
    .set('Authorization', `Bearer ${token}`)
    .send({ party_id: 1 });
  expect(joinRes.status).toBe(201);

  const leaveRes = await request(app)
    .delete('/api/party_memberships/1')
    .set('Authorization', `Bearer ${token}`);
  expect(leaveRes.status).toBe(204);
});

test('moderator can edit and delete messages', async () => {
  const tokenMod = jwt.sign({ userId: 1 }, 'secret');
  const tokenUser = jwt.sign({ userId: 2 }, 'secret');
  await request(app)
    .post('/api/party_memberships')
    .set('Authorization', `Bearer ${tokenUser}`)
    .send({ party_id: 1 });

  const createRes = await request(app)
    .post('/api/party_messages')
    .set('Authorization', `Bearer ${tokenUser}`)
    .send({ party_id: 1, message: 'hello' });
  const msgId = createRes.body.id;
  expect(createRes.status).toBe(201);

  const editRes = await request(app)
    .put(`/api/party_messages/${msgId}`)
    .set('Authorization', `Bearer ${tokenMod}`)
    .send({ message: 'edited' });
  expect(editRes.status).toBe(200);
  expect(editRes.body.message).toBe('edited');

  const delRes = await request(app)
    .delete(`/api/party_messages/${msgId}`)
    .set('Authorization', `Bearer ${tokenMod}`);
  expect(delRes.status).toBe(204);
});
