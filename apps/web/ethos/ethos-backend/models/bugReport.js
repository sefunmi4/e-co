const { pool } = require('../db');

async function create({ user_id, title, description }) {
  const result = await pool.query(
    'INSERT INTO bug_reports (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
    [user_id, title, description]
  );
  return result.rows[0];
}

async function list() {
  const result = await pool.query('SELECT * FROM bug_reports ORDER BY id');
  return result.rows;
}

async function update(id, fields) {
  const { title, description, status } = fields;
  const result = await pool.query(
    'UPDATE bug_reports SET title = COALESCE($1, title), description = COALESCE($2, description), status = COALESCE($3, status) WHERE id = $4 RETURNING *',
    [title, description, status, id]
  );
  return result.rows[0];
}

async function close(id) {
  const result = await pool.query(
    'UPDATE bug_reports SET status = $1 WHERE id = $2 RETURNING *',
    ['closed', id]
  );
  return result.rows[0];
}

module.exports = { create, list, update, close };
