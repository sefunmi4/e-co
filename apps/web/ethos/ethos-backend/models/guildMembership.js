const { pool } = require('../db');

async function request(guild_id, user_id, role = 'member') {
  const result = await pool.query(
    'INSERT INTO guild_memberships (guild_id, user_id, role, status) VALUES ($1, $2, $3, $4) RETURNING *',
    [guild_id, user_id, role, 'pending']
  );
  return result.rows[0];
}

async function addApproved(guild_id, user_id, role = 'member') {
  const result = await pool.query(
    'INSERT INTO guild_memberships (guild_id, user_id, role, status) VALUES ($1, $2, $3, $4) RETURNING *',
    [guild_id, user_id, role, 'approved']
  );
  return result.rows[0];
}

async function approve(id, role = 'member') {
  const result = await pool.query(
    'UPDATE guild_memberships SET status = $2, role = $3 WHERE id = $1 RETURNING *',
    [id, 'approved', role]
  );
  return result.rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM guild_memberships WHERE id = $1', [id]);
}

async function get(guild_id, user_id) {
  const result = await pool.query(
    'SELECT * FROM guild_memberships WHERE guild_id = $1 AND user_id = $2',
    [guild_id, user_id]
  );
  return result.rows[0];
}

async function list(filters = {}) {
  const conditions = [];
  const values = [];
  let idx = 1;
  if (filters.guild_id) {
    conditions.push(`gm.guild_id = $${idx++}`);
    values.push(filters.guild_id);
  }
  if (filters.user_id) {
    conditions.push(`gm.user_id = $${idx++}`);
    values.push(filters.user_id);
  }
  if (filters.user_email) {
    conditions.push(`u.email = $${idx++}`);
    values.push(filters.user_email);
  }
  if (filters.status) {
    conditions.push(`gm.status = $${idx++}`);
    values.push(filters.status);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const result = await pool.query(
    `SELECT gm.*, u.email as user_email FROM guild_memberships gm JOIN users u ON gm.user_id = u.id ${where} ORDER BY gm.id`,
    values
  );
  return result.rows;
}

async function findById(id) {
  const result = await pool.query('SELECT * FROM guild_memberships WHERE id = $1', [id]);
  return result.rows[0];
}

module.exports = { request, approve, remove, get, list, addApproved, findById };
