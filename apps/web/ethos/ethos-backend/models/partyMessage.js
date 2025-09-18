const { pool } = require('../db');

async function create({ party_id, user_id, message }) {
  const result = await pool.query(
    'INSERT INTO party_messages (party_id, user_id, message) VALUES ($1, $2, $3) RETURNING *',
    [party_id, user_id, message]
  );
  return result.rows[0];
}

async function get(id) {
  const result = await pool.query('SELECT * FROM party_messages WHERE id = $1', [id]);
  return result.rows[0];
}

async function update(id, fields) {
  const { message } = fields;
  const result = await pool.query(
    'UPDATE party_messages SET message = COALESCE($1, message) WHERE id = $2 RETURNING *',
    [message, id]
  );
  return result.rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM party_messages WHERE id = $1', [id]);
}

module.exports = { create, get, update, remove };
