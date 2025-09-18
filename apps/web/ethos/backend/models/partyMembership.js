const { pool } = require('../db');

async function join(party_id, user_id, role = 'member') {
  const result = await pool.query(
    'INSERT INTO party_membership (party_id, user_id, role) VALUES ($1, $2, $3) RETURNING *',
    [party_id, user_id, role]
  );
  return result.rows[0];
}

async function leave(party_id, user_id) {
  const result = await pool.query('DELETE FROM party_membership WHERE party_id = $1 AND user_id = $2', [party_id, user_id]);
  return result.rowCount > 0;
}

async function get(party_id, user_id) {
  const result = await pool.query('SELECT * FROM party_membership WHERE party_id = $1 AND user_id = $2', [party_id, user_id]);
  return result.rows[0];
}

async function promote(party_id, user_id) {
  const result = await pool.query(
    'UPDATE party_membership SET role = $3 WHERE party_id = $1 AND user_id = $2 RETURNING *',
    [party_id, user_id, 'moderator']
  );
  return result.rows[0];
}

module.exports = { join, leave, get, promote };
