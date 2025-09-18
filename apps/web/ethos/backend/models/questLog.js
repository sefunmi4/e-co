const { pool } = require('../db');

async function create({ quest_id, user_id, action }) {
  const result = await pool.query(
    'INSERT INTO quest_logs (quest_id, user_id, action) VALUES ($1, $2, $3) RETURNING *',
    [quest_id, user_id, action]
  );
  return result.rows[0];
}

async function list() {
  const result = await pool.query('SELECT * FROM quest_logs ORDER BY id');
  return result.rows;
}

async function get(id) {
  const result = await pool.query('SELECT * FROM quest_logs WHERE id = $1', [id]);
  return result.rows[0];
}

async function update(id, fields) {
  const { quest_id, user_id, action } = fields;
  const result = await pool.query(
    'UPDATE quest_logs SET quest_id = COALESCE($1, quest_id), user_id = COALESCE($2, user_id), action = COALESCE($3, action) WHERE id = $4 RETURNING *',
    [quest_id, user_id, action, id]
  );
  return result.rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM quest_logs WHERE id = $1', [id]);
}

module.exports = { create, list, get, update, remove };
