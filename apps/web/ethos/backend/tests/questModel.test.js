const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');

// create in-memory pg and mock 'pg' module
const db = newDb();
const mockPg = db.adapters.createPg();
jest.mock('pg', () => mockPg);

const { pool } = require('../db');
const questModel = require('../models/quest');

beforeAll(async () => {
  const sql1 = fs.readFileSync(path.join(__dirname, '../migrations/001-init.sql'), 'utf8');
  const sql2 = fs.readFileSync(path.join(__dirname, '../migrations/007-quest-guild-id.sql'), 'utf8');
  await pool.query(sql1);
  await pool.query(sql2);
  await pool.query("INSERT INTO users (email, hashed_password) VALUES ('a@b.com','x')");
});

test('create and fetch quest', async () => {
  const created = await questModel.create({ title: 'Test Quest', description: 'desc', user_id: 1 });
  const fetched = await questModel.get(created.id);
  expect(fetched.title).toBe('Test Quest');
  const list = await questModel.list();
  expect(list.length).toBe(1);
});
