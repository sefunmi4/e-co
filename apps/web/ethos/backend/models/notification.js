const { pool } = require('../db');

async function create({ user_id, content }) {
  const result = await pool.query(
    'INSERT INTO notifications (user_id, content) VALUES ($1, $2) RETURNING *',
    [user_id, content]
  );
  return result.rows[0];
}

module.exports = { create };
