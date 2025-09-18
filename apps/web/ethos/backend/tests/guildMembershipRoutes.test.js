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
const guildRouter = require('../routes/guildMemberships');
const questsRouter = require('../routes/quests');
const guildModel = require('../models/guild');

const app = express();
app.use(express.json());
app.use('/api/guild_memberships', guildRouter);
app.use('/api/quests', questsRouter);

let guildId;

beforeAll(async () => {
  const sql1 = fs.readFileSync(path.join(__dirname, '../migrations/001-init.sql'), 'utf8');
  const sql2 = fs.readFileSync(path.join(__dirname, '../migrations/006-guild-memberships.sql'), 'utf8');
  const sql3 = fs.readFileSync(path.join(__dirname, '../migrations/007-quest-guild-id.sql'), 'utf8');
  await pool.query(sql1);
  await pool.query(sql2);
  await pool.query(sql3);
  await pool.query("INSERT INTO users (email, hashed_password) VALUES ('owner@example.com','x'),('member@example.com','x'),('stranger@example.com','x')");
  const guild = await guildModel.create({ name: 'Test Guild', description: 'desc', owner_id: 1 });
  guildId = guild.id;
});

test('membership request, approve, revoke and quest posting', async () => {
  const ownerToken = jwt.sign({ userId: 1 }, 'secret');
  const memberToken = jwt.sign({ userId: 2 }, 'secret');
  const strangerToken = jwt.sign({ userId: 3 }, 'secret');

  const reqRes = await request(app)
    .post('/api/guild_memberships')
    .set('Authorization', `Bearer ${memberToken}`)
    .send({ guild_id: guildId });
  expect(reqRes.status).toBe(201);
  expect(reqRes.body.status).toBe('pending');
  const membershipId = reqRes.body.id;

  // stranger cannot post quest
  const forbid = await request(app)
    .post('/api/quests')
    .set('Authorization', `Bearer ${strangerToken}`)
    .send({ title: 'q1', description: 'd', guild_id: guildId });
  expect(forbid.status).toBe(403);

  const approveRes = await request(app)
    .post(`/api/guild_memberships/${membershipId}/approve`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send();
  expect(approveRes.status).toBe(200);
  expect(approveRes.body.status).toBe('approved');

  const questRes = await request(app)
    .post('/api/quests')
    .set('Authorization', `Bearer ${memberToken}`)
    .send({ title: 'q1', description: 'd', guild_id: guildId });
  expect(questRes.status).toBe(201);

  const revokeRes = await request(app)
    .delete(`/api/guild_memberships/${membershipId}`)
    .set('Authorization', `Bearer ${ownerToken}`);
  expect(revokeRes.status).toBe(204);

  const questRes2 = await request(app)
    .post('/api/quests')
    .set('Authorization', `Bearer ${memberToken}`)
    .send({ title: 'q2', description: 'd', guild_id: guildId });
  expect(questRes2.status).toBe(403);
});
