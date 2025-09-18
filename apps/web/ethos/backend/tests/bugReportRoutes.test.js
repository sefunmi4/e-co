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

const mockEmit = jest.fn();
jest.mock('../socket', () => ({
  getIo: () => ({ emit: mockEmit })
}));

const { pool } = require('../db');
const bugReportsRouter = require('../routes/bugReports');

const app = express();
app.use(express.json());
app.use('/api/bug_reports', bugReportsRouter);

beforeAll(async () => {
  const sql1 = fs.readFileSync(path.join(__dirname, '../migrations/001-init.sql'), 'utf8');
  const sql2 = fs.readFileSync(path.join(__dirname, '../migrations/002-realtime.sql'), 'utf8');
  const sql3 = fs.readFileSync(path.join(__dirname, '../migrations/003-bug-reports.sql'), 'utf8');
  await pool.query(sql1);
  await pool.query(sql2);
  await pool.query(sql3);
  await pool.query("INSERT INTO users (email, hashed_password) VALUES ('test@example.com','x')");
});

test('bug report CRUD and notifications', async () => {
  const token = jwt.sign({ userId: 1 }, 'secret');
  const createRes = await request(app)
    .post('/api/bug_reports')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Bug 1', description: 'desc' });
  expect(createRes.status).toBe(201);
  const id = createRes.body.id;

  const listRes = await request(app)
    .get('/api/bug_reports')
    .set('Authorization', `Bearer ${token}`);
  expect(listRes.body.length).toBe(1);

  const updateRes = await request(app)
    .put(`/api/bug_reports/${id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'in_progress' });
  expect(updateRes.body.status).toBe('in_progress');

  let notifRows = await pool.query('SELECT * FROM notifications');
  expect(notifRows.rows.length).toBe(1);
  expect(notifRows.rows[0].content).toMatch(/in_progress/);

  const closeRes = await request(app)
    .post(`/api/bug_reports/${id}/close`)
    .set('Authorization', `Bearer ${token}`);
  expect(closeRes.body.status).toBe('closed');

  notifRows = await pool.query('SELECT * FROM notifications');
  expect(notifRows.rows.length).toBe(2);
  expect(mockEmit).toHaveBeenCalled();
});
